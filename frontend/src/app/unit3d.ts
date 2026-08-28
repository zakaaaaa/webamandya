/*
 * unit3d.ts — penampil 3D unit photobooth.
 *
 * Model asalnya GLB Hunyuan3D 1,5 juta segitiga + tekstur 4096². Diringkas
 * jadi 65 ribu segitiga + baseColor 1024² lalu disimpan sebagai berkas biner
 * di /public/unit, bukan base64 di dalam HTML: browser bisa meng-cache-nya
 * dan halamannya tetap ramping.
 *
 * Digambar dengan WebGL polos. Mesh cuma butuh posisi, normal, dan UV, jadi
 * tidak ada pustaka 3D sama sekali.
 *
 * GANTI MODEL: jalankan glb-prep.js pada GLB baru, lalu tulis ulang berkas
 * di /public/unit dengan keluarannya.
 */

export type UnitTune = {
  roll: number      // condong: puncak ke kiri (+) / ke kanan (−)
  yaw: number       // arah hadap; pusat ayunan. 0 = tepat dari depan
  pitch: number     // sudut pandang: tunduk (−) / dongak (+)
  sway: number      // lebar ayunan otomatis. 0 = diam total
  speed: number     // kecepatan ayunan
  zoom: number      // jarak kamera: makin KECIL, model makin BESAR
  scroll: number    // putaran tambahan sepanjang satu layar gulir. 0 = mati
  refAsp: number    // aspek kanvas acuan untuk koreksi pembingkaian
}

type MountCfg = {
  host: HTMLElement
  canvas: HTMLCanvasElement
  hint?: HTMLElement | null
  tune: UnitTune
}

const VS =
  'attribute vec3 aPos;attribute vec3 aNrm;attribute vec2 aUV;' +
  'uniform mat4 uMVP;uniform mat4 uM;uniform vec2 uUVfix;' +
  'varying vec3 vN;varying vec2 vUV;' +
  'void main(){vN=mat3(uM)*aNrm;' +
  'vUV=aUV*uUVfix.x+uUVfix.y;' +
  'gl_Position=uMVP*vec4(aPos,1.0);}'

/* Pencahayaan netral: key + fill + hemi. Tanpa rim light berwarna — warnanya
   sudah datang dari tekstur booth itu sendiri. */
const FS =
  'precision mediump float;' +
  'varying vec3 vN;varying vec2 vUV;' +
  'uniform sampler2D uTex;' +
  'void main(){' +
  'vec3 N=normalize(vN);if(!gl_FrontFacing)N=-N;' +
  'float key=max(dot(N,normalize(vec3(-0.5,0.78,0.86))),0.0);' +
  'float fill=max(dot(N,normalize(vec3(0.85,0.10,0.42))),0.0);' +
  'float hemi=N.y*0.5+0.5;' +
  'vec3 base=texture2D(uTex,vUV).rgb;' +
  'float k=0.56+0.40*key+0.13*fill+0.11*hemi;' +
  'gl_FragColor=vec4(base*k,1.0);}'

/* ── Matriks 4×4 (kolom-mayor) ── */
function mul(a: Float32Array, b: Float32Array) {
  const o = new Float32Array(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++)
      o[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  return o
}
const persp = (f: number, a: number, n: number, fa: number) => {
  const t = 1 / Math.tan(f / 2)
  return new Float32Array([t / a, 0, 0, 0, 0, t, 0, 0, 0, 0, (fa + n) / (n - fa), -1, 0, 0, (2 * fa * n) / (n - fa), 0])
}
const rotY = (a: number) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]) }
const rotX = (a: number) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]) }
const rotZ = (a: number) => { const c = Math.cos(a), s = Math.sin(a); return new Float32Array([c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]) }
const trans = (t: number[]) => new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, t[0],t[1],t[2],1])

const FOV = (30 * Math.PI) / 180

type Mesh = {
  POS: Float32Array; NRM: Int8Array; UV: Uint16Array; IDX: Uint16Array
  ctr: number[]; rad: number; uvMin: number; uvSpan: number
  tex: HTMLImageElement
}

let meshPromise: Promise<Mesh> | null = null

/* Diambil sekali lalu dipakai bersama kedua penampil. */
function loadMesh(): Promise<Mesh> {
  if (meshPromise) return meshPromise
  meshPromise = (async () => {
    const ambil = (n: string) => fetch('/unit/' + n).then(r => {
      if (!r.ok) throw new Error('gagal memuat /unit/' + n)
      return r.arrayBuffer()
    })
    const [meta, pos, nrm, uv, idx] = await Promise.all([
      fetch('/unit/meta.json').then(r => r.json()),
      ambil('pos.bin'), ambil('nrm.bin'), ambil('uv.bin'), ambil('idx.bin'),
    ])
    const POS = new Float32Array(pos)
    const mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
    for (let i = 0; i < POS.length; i += 3)
      for (let k = 0; k < 3; k++) {
        if (POS[i + k] < mn[k]) mn[k] = POS[i + k]
        if (POS[i + k] > mx[k]) mx[k] = POS[i + k]
      }
    const tex = await new Promise<HTMLImageElement>((res, rej) => {
      const im = new Image()
      im.onload = () => res(im)
      im.onerror = () => rej(new Error('gagal memuat tekstur unit'))
      im.src = '/unit/tex.jpg'
    })
    return {
      POS,
      NRM: new Int8Array(nrm),
      UV: new Uint16Array(uv),
      IDX: new Uint16Array(idx),
      ctr: [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2],
      rad: Math.max(mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]) / 2,
      uvMin: meta.uvMin, uvSpan: meta.uvSpan, tex,
    }
  })()
  return meshPromise
}

/* Satu instans penampil. Tiap kanvas punya konteks WebGL sendiri karena
   konteks tidak bisa dibagi antar kanvas; array mesh-nya dipakai bersama. */
function mount(cfg: MountCfg, m: Mesh): (() => void) | null {
  const { host, canvas: cv, tune: TUNE } = cfg
  const gl = (cv.getContext('webgl', { antialias: true, alpha: true, premultipliedAlpha: false, depth: true })
    || cv.getContext('experimental-webgl')) as WebGLRenderingContext | null
  if (!gl) { host.style.display = 'none'; return null }

  const sh = (t: number, src: string) => {
    const s = gl.createShader(t)!
    gl.shaderSource(s, src); gl.compileShader(s)
    return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null
  }
  const vs = sh(gl.VERTEX_SHADER, VS), fs = sh(gl.FRAGMENT_SHADER, FS)
  if (!vs || !fs) { host.style.display = 'none'; return null }
  const prog = gl.createProgram()!
  gl.attachShader(prog, vs); gl.attachShader(prog, fs); gl.linkProgram(prog)
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { host.style.display = 'none'; return null }
  gl.useProgram(prog)

  const aPos = gl.getAttribLocation(prog, 'aPos')
  const aNrm = gl.getAttribLocation(prog, 'aNrm')
  const aUV = gl.getAttribLocation(prog, 'aUV')
  const uMVP = gl.getUniformLocation(prog, 'uMVP')
  const uM = gl.getUniformLocation(prog, 'uM')
  const uTex = gl.getUniformLocation(prog, 'uTex')
  const uUVfix = gl.getUniformLocation(prog, 'uUVfix')

  const buf = (target: number, data: ArrayBufferView) => {
    const b = gl.createBuffer()
    gl.bindBuffer(target, b); gl.bufferData(target, data, gl.STATIC_DRAW)
    return b
  }
  const bPos = buf(gl.ARRAY_BUFFER, m.POS)
  const bNrm = buf(gl.ARRAY_BUFFER, m.NRM)
  const bUV = buf(gl.ARRAY_BUFFER, m.UV)
  buf(gl.ELEMENT_ARRAY_BUFFER, m.IDX)

  gl.enable(gl.DEPTH_TEST)
  gl.clearColor(0, 0, 0, 0)

  /* UV glTF berawal kiri-atas, sama dengan urutan baris gambar, jadi
     UNPACK_FLIP_Y harus tetap false. */
  const tex = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, tex)
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 0)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, m.tex)
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE)

  let yaw = TUNE.yaw, pitch = TUNE.pitch, vel = 0
  let dragging = false, lastX = 0, lastY = 0, idleAt = 0, touched = false
  let asp = 1, alive = true
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  /* Putaran mengikuti gulir, diukur dari posisi unit terhadap layar (bukan
     scrollY halaman) supaya benar berapa pun tinggi section. */
  let spinScroll = 0, spinTarget = 0
  const measureScroll = () => {
    if (!TUNE.scroll) { spinTarget = 0; return }
    const r = host.getBoundingClientRect()
    const h = Math.max(r.height, 1)
    const p = (window.innerHeight * 0.5 - (r.top + h * 0.5)) / h
    spinTarget = Math.max(-1.4, Math.min(1.4, p)) * TUNE.scroll
  }
  if (TUNE.scroll) { measureScroll(); spinScroll = spinTarget }

  const resize = () => {
    const r = cv.getBoundingClientRect()
    if (!r.width || !r.height) return false
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const w = Math.max(1, Math.round(r.width * dpr))
    const h = Math.max(1, Math.round(r.height * dpr))
    if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h }
    gl.viewport(0, 0, w, h)
    asp = r.width / r.height
    return true
  }

  const draw = () => {
    if (!resize()) return
    gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT)

    /* Pembingkaian dihitung dari tinggi kanvas. Di kanvas yang lebih ramping
       daripada acuan, bidang pandang mendatar ikut menyempit dan model
       terpotong lurus di sisi kiri/kanan — kamera dimundurkan sebandingnya. */
    const fit = Math.min(1, asp / TUNE.refAsp)
    const dist = (m.rad / Math.sin(FOV / 2)) * TUNE.zoom / fit

    const M = mul(mul(mul(rotZ(TUNE.roll), rotY(yaw + spinScroll)), rotX(pitch)),
                  trans([-m.ctr[0], -m.ctr[1], -m.ctr[2]]))
    const V = new Float32Array([1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,-dist,1])
    const P = persp(FOV, asp, dist * 0.05, dist * 4)
    gl.useProgram(prog)
    gl.uniformMatrix4fv(uMVP, false, mul(mul(P, V), M))
    gl.uniformMatrix4fv(uM, false, M)
    gl.uniform2f(uUVfix, m.uvSpan, m.uvMin)
    gl.activeTexture(gl.TEXTURE0)
    gl.bindTexture(gl.TEXTURE_2D, tex)
    gl.uniform1i(uTex, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, bPos)
    gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 3, gl.FLOAT, false, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, bNrm)
    gl.enableVertexAttribArray(aNrm); gl.vertexAttribPointer(aNrm, 3, gl.BYTE, true, 0, 0)
    gl.bindBuffer(gl.ARRAY_BUFFER, bUV)
    gl.enableVertexAttribArray(aUV); gl.vertexAttribPointer(aUV, 2, gl.UNSIGNED_SHORT, true, 0, 0)
    gl.drawElements(gl.TRIANGLES, m.IDX.length, gl.UNSIGNED_SHORT, 0)
  }

  /* Berhenti menggambar saat di luar layar: dua konteks WebGL yang jalan
     terus-menerus itu boros baterai tanpa ada yang melihat. */
  let visible = true
  const io = 'IntersectionObserver' in window
    ? new IntersectionObserver(en => { visible = en[0].isIntersecting })
    : null
  io?.observe(host)

  const frame = () => {
    if (!alive) return
    if (visible) {
      if (TUNE.scroll) spinScroll += (spinTarget - spinScroll) * 0.12
      if (!dragging) {
        if (Math.abs(vel) > 0.0004) { yaw += vel; vel *= 0.94 }
        else if (!reduce && TUNE.sway !== 0 && Date.now() > idleAt) {
          const target = TUNE.yaw + Math.sin((Date.now() / 1000) * TUNE.speed) * TUNE.sway
          let d = target - yaw
          while (d > Math.PI) d -= Math.PI * 2
          while (d < -Math.PI) d += Math.PI * 2
          yaw += d * 0.02
        }
      }
      draw()
    }
    requestAnimationFrame(frame)
  }

  const down = (e: PointerEvent) => {
    dragging = true; idleAt = Date.now() + 2800
    lastX = e.clientX; lastY = e.clientY
    if (!touched && cfg.hint) { touched = true; cfg.hint.textContent = 'PINDAI SELURUH SISI' }
    cv.setPointerCapture?.(e.pointerId)
  }
  const move = (e: PointerEvent) => {
    if (!dragging) return
    const dx = e.clientX - lastX, dy = e.clientY - lastY
    lastX = e.clientX; lastY = e.clientY
    yaw += dx * 0.009; vel = dx * 0.009
    pitch = Math.max(-0.5, Math.min(0.5, pitch + dy * 0.006))
    e.preventDefault()
  }
  const up = () => { dragging = false; idleAt = Date.now() + 2800 }

  cv.addEventListener('pointerdown', down)
  cv.addEventListener('pointermove', move)
  cv.addEventListener('pointerup', up)
  cv.addEventListener('pointercancel', up)
  window.addEventListener('resize', draw)
  if (TUNE.scroll) {
    window.addEventListener('scroll', measureScroll, { passive: true })
    window.addEventListener('resize', measureScroll)
  }

  requestAnimationFrame(frame)

  return () => {
    alive = false
    io?.disconnect()
    cv.removeEventListener('pointerdown', down)
    cv.removeEventListener('pointermove', move)
    cv.removeEventListener('pointerup', up)
    cv.removeEventListener('pointercancel', up)
    window.removeEventListener('resize', draw)
    window.removeEventListener('scroll', measureScroll)
    window.removeEventListener('resize', measureScroll)
    gl.getExtension('WEBGL_lose_context')?.loseContext()
  }
}

export const HERO_TUNE: UnitTune = {
  roll: 0.5, yaw: 0.11, pitch: 0.05, sway: 0.5,
  speed: 0.38, zoom: 0.96, scroll: 0.9, refAsp: 0.95,
}

export const SPEC_TUNE: UnitTune = {
  roll: 0, yaw: -0.5, pitch: -0.03, sway: 0.45,
  speed: 0.26, zoom: 1.1, scroll: 0, refAsp: 1.05,
}

/* Dipanggil dari useEffect. Mengembalikan fungsi pembersih untuk dua penampil. */
export function mountUnits(targets: MountCfg[]): () => void {
  let cleanups: Array<() => void> = []
  let batal = false
  loadMesh().then(m => {
    if (batal) return
    cleanups = targets.map(t => mount(t, m)).filter(Boolean) as Array<() => void>
  }).catch(() => {
    targets.forEach(t => { t.host.style.display = 'none' })
  })
  return () => { batal = true; cleanups.forEach(c => c()) }
}
