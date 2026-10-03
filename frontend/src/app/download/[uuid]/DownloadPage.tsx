'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Download, Check, Loader2, Film, Sparkles, AlertCircle, Printer, Bell, BellOff } from 'lucide-react'
import { DOWNLOAD_CSS } from './download.css'

// pending    = mesin belum mulai
// processing = mesin sedang merender/mengunggah
// ready      = file sudah bisa diunduh
// failed     = sudah dicoba dan gagal
type MediaStatus = 'pending' | 'processing' | 'ready' | 'failed' | null

type Session = {
  id: string
  transaction_code: string
  payment_status: string
  created_at: string
  result_url: string | null
  gif_url?: string | null
  gif_status?: MediaStatus
  video_url?: string | null
  video_status?: MediaStatus
  clients: { name: string; email: string } | null
  devices: { device_name: string } | null
  print_status?: PrintStatus
  print_sheets_done?: number | null
  print_sheets_total?: number | null
  print_eta_seconds?: number | null
  print_reason?: string | null
  print_started_at?: string | null
}
type Photo = { photo_url: string; photo_order: number }

// Progres cetak, dilaporkan mesin photobooth dari antrian spooler Windows.
// queued   = job sudah dikirim, belum terlihat di antrian
// printing = job ada di antrian, printer sedang bekerja
// done     = job lepas dari antrian; data cetakan habis diterima printer
// stuck    = printer butuh ditolong (kertas habis, macet, antrian di-pause)
// failed   = sudah terlalu lama dan tidak juga selesai
// null     = sesi ini memang tidak mencetak apa pun
type PrintStatus = 'queued' | 'printing' | 'done' | 'stuck' | 'failed' | null

type PrintState = {
  status: PrintStatus
  sheetsDone: number
  sheetsTotal: number
  etaSeconds: number | null
  reason: string | null
  startedAt: string | null
}

// Selama mesin masih bekerja, halaman menanyakan statusnya berkala supaya
// pelanggan melihat hasilnya muncul sendiri tanpa perlu refresh manual.
const POLL_INTERVAL_MS  = 4000
const POLL_MAX_ATTEMPTS = 75 // ~5 menit, lalu berhenti agar tidak polling selamanya

// ── Kalibrasi indikator progres ──────────────────────────────────────────
// Diukur dari 10 sesi produksi yang selesai penuh sejak 21 Agustus 2026,
// dihitung dari foto terakhir tersimpan sampai media terakhir siap:
//   5,6 · 6,1 · 8,4 · 9,6 · 12,4 · 32,1 · 40,1 · 49,0 · 78,7 · 303,6 detik
//   → median 32 detik, rata-rata tanpa outlier 27 detik.
//
// Browser pelanggan TIDAK bisa tahu persentase unggahan yang sebenarnya:
// mesin photobooth yang mengunggah ke R2, dan yang tersimpan di database
// hanya status per media, tanpa angka progres. Jadi angka pada cincin
// digerakkan waktu, TAPI setiap langkah nyata (foto → strip → GIF → video)
// mengunci lantainya, dan angkanya tidak pernah menyentuh 100% sebelum
// filenya benar-benar ada.
const STEP_TAU_MS   = 11000  // kecepatan merayap dalam satu langkah
const SLOW_AFTER_MS = 90000  // lewat ini, akui bahwa prosesnya lebih lama
const CREEP_CEILING = 95     // pagar: tanpa bukti file siap, berhenti di sini

// ── Indikator CETAK ──────────────────────────────────────────────────────
// Sumbernya antrian spooler Windows di mesin photobooth, bukan sensor di
// dalam printer: yang diketahui hanya job masih di antrian atau sudah lepas.
// Persentase digerakkan WAKTU terhadap perkiraan yang dikirim app
// (print_eta_seconds), dengan jumlah lembar yang sudah lepas sebagai lantai.
const PRINT_CEILING = 96
// Panjang: pelanggan bisa memesan beberapa lembar, dan batas polling media
// (~5 menit) terlalu pendek untuk itu.
const PRINT_POLL_MAX_ATTEMPTS = 300 // ~20 menit @ 4 detik

// Layout sama persis Flutter
const LAYOUTS: Record<number, {
  topPadding:number; bottomPadding:number
  leftPadding:number; rightPadding:number
  horizontalSpacing:number; verticalSpacing:number
  cols:number
}> = {
  3: { topPadding:59,  bottomPadding:59,  leftPadding:10, rightPadding:10, horizontalSpacing:20, verticalSpacing:10,  cols:1 },
  4: { topPadding:25,  bottomPadding:40,  leftPadding:10, rightPadding:5,  horizontalSpacing:5,  verticalSpacing:13,  cols:2 },
}

// ── Progres media: foto yang pelan-pelan "muncul" ────────────────────────
// Angkanya tetap dari kalibrasi di atas; fotonya bergerak dari buram & gelap
// ke jelas mengikuti persentase, supaya menunggu terasa bagian dari hasilnya.
function DevelopingCard({
  percent, caption, hint, photoUrl, steps, currentKey,
}: {
  percent:number; caption:string; hint?:string; photoUrl:string|null
  steps:{ key:string; label:string; done:boolean }[]; currentKey?:string
}) {
  const p = percent / 100
  return (
    <div className="kartu masuk-2">
      <div className="muncul">
        <div className="muncul-foto">
          <div className="gbr">
            {photoUrl && (
              <img src={photoUrl} alt="" style={{
                opacity: 0.08 + p * 0.92,
                filter:`sepia(${(1 - p).toFixed(2)}) blur(${((1 - p) * 5).toFixed(1)}px) brightness(${(0.45 + p * 0.55).toFixed(2)})`,
              }}/>
            )}
          </div>
          <p className="persen">{percent}%</p>
        </div>
        <div style={{ minWidth:0 }}>
          <h3>{caption}</h3>
          {hint && <p className="teks">{hint}</p>}
        </div>
      </div>
      <ul className="langkah">
        {steps.map(s => (
          <li key={s.key} className={s.done ? 'selesai' : s.key === currentKey ? 'jalan' : ''}>
            {s.done ? <Check size={12} strokeWidth={3.5}/> : s.key === currentKey ? <Loader2 size={11} className="muter"/> : null}
            {s.label}
          </li>
        ))}
      </ul>
    </div>
  )
}

// ── Printer & lembar yang keluar ─────────────────────────────────────────
// Lembar turun dari mulut printer mengikuti persentase cetak (digerakkan
// waktu terhadap print_eta_seconds, berlantai lembar yang sudah lepas dari
// antrian). Kalimatnya tetap tidak mengklaim "kertas sudah keluar" sebelum
// mesin melaporkan selesai.
function PrintCard({
  status, sheetsDone, sheetsTotal, percent, remainSec, reason,
  soundArmed, onArmSound, sheetSrc, photoUrls, justDone,
}: {
  status: PrintStatus
  sheetsDone: number
  sheetsTotal: number
  percent: number
  remainSec: number | null
  reason: string | null
  soundArmed: boolean
  onArmSound: () => void
  sheetSrc: string | null
  photoUrls: string[]
  justDone: boolean
}) {
  if (!status) return null

  const running = status === 'queued' || status === 'printing'
  const trouble = status === 'stuck' || status === 'failed'
  const done    = status === 'done'
  const total   = Math.max(1, sheetsTotal)
  const multi   = sheetsTotal > 1

  const sheet = (
    <div className="lembar">
      {sheetSrc
        ? <img src={sheetSrc} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
        : <div className="lembar-grid">{photoUrls.slice(0, 4).flatMap(u => [u, u]).slice(0, 8).map((u, i) => (
            <img key={i} src={u} alt="" style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top' }}/>
          ))}</div>}
    </div>
  )

  // Ringkas: halaman dibuka ulang lama setelah cetakan selesai.
  if (done && !justDone) {
    return (
      <div className="kartu cetak-ringkas masuk-2">
        <div className="mini">{sheet}</div>
        <div style={{ minWidth:0 }}>
          <h3 className="lab">Cetakan sudah selesai</h3>
          <p className="teks">{multi ? `${sheetsTotal} lembar sudah dicetak. ` : ''}Belum diambil? Cek di printer, ya.</p>
        </div>
      </div>
    )
  }

  const p      = done ? 1 : percent / 100
  const idx    = done ? total - 1 : Math.min(total - 1, Math.max(sheetsDone, Math.floor(p * total)))
  const within = done ? 1 : Math.max(status === 'queued' ? 0.02 : 0.05, Math.min(1, p * total - idx))

  const sisa = remainSec == null ? null
    : remainSec > 90 ? `±${Math.round(remainSec / 60)} menit lagi`
    : remainSec > 20 ? `±${Math.round(remainSec / 10) * 10} detik lagi`
    :                  'sedikit lagi'

  // Teks Bristol: tanpa huruf "b" (lihat download.css.ts).
  const title = done              ? 'Sudah tercetak!'
              : status === 'stuck'  ? 'Cetakan tertahan'
              : status === 'failed' ? 'Cetakan terhenti'
              : status === 'queued' ? 'Masuk antrean…'
              :                       'Lagi dicetak…'

  const body = done
      ? (multi ? `${sheetsTotal} lembar sudah keluar. ` : '') + 'Silakan ambil hasil cetakmu di printer.'
    : trouble
      ? (reason ?? 'Cetakan berhenti sebelum selesai.') + ' Tunjukkan layar ini ke petugas di lokasi.'
    : 'Kamu boleh duduk dulu — halaman ini yang akan memberi tahu.'

  return (
    <div className="cetak masuk-2">
      <div className={`printer ${running ? 'jalan' : ''}`}>
        <div className="printer-baki"><span/></div>
        <div className="printer-badan">
          <div className="printer-layar lab">{done ? 'OK' : trouble ? '!' : `${percent}%`}</div>
          <span className="printer-merk lab">PK·PRINT</span>
          <span className={`led ${done ? 'ok' : trouble ? 'awas' : 'jalan'}`}/>
          <div className="printer-mulut"/>
        </div>
        <div className="keluar">
          <div className="keluar-bayang" aria-hidden><span className="lab">keluar di sini</span></div>
          <div className="lembar-gerak" style={{ transform:`translateY(${(-(1 - within) * 100).toFixed(2)}%)` }}>
            {sheet}
          </div>
        </div>
        {(done || trouble) && (
          <div className={`stiker st-ambil ${trouble ? 'awas' : ''}`}>
            <div className="stiker-isi">
              <span className="lab">{done ? 'Ambil di' : 'Panggil'}</span>
              <span className="disp">{done ? 'printer!' : 'petugas'}</span>
            </div>
          </div>
        )}
        {multi && <span className="hitung-lembar lab">lembar {Math.min(idx + 1, total)}/{total}</span>}
      </div>

      <h2 className={`cetak-judul ${done ? 'ok' : ''}`}>{title}</h2>
      {running && <p className="cetak-angka lab">{percent}%{sisa ? ` · ${sisa}` : ''}</p>}
      <p className="cetak-ket teks">{body}</p>

      {/* Browser memblokir suara yang tidak berasal dari sentuhan
          pelanggan, jadi izinnya harus diminta SEKARANG — selagi
          cetakan masih jalan — bukan nanti saat sudah selesai. */}
      {running && (
        <button className={`tombol garis kecil bunyi ${soundArmed ? 'siap' : ''}`} onClick={onArmSound} disabled={soundArmed}>
          {soundArmed ? <Bell size={14}/> : <BellOff size={14}/>}
          {soundArmed ? 'Nanti dibunyikan' : 'Bunyikan saat selesai'}
        </button>
      )}
      {running && soundArmed && (
        <p className="teks" style={{ fontSize:12, color:'rgba(252,233,206,.7)', lineHeight:1.5, margin:'10px auto 0', maxWidth:300 }}>
          Biarkan halaman ini terbuka. Kalau layar HP terkunci, bunyinya
          bisa ikut tertahan — statusnya tetap benar begitu HP dibuka lagi.
        </p>
      )}
    </div>
  )
}

// ── Satu blok hasil ──────────────────────────────────────────────────────
function Section({ title, meta, children }: { title:string; meta?:string; children:React.ReactNode }) {
  return (
    <section className="blok">
      <h2 className="sub-judul">{title}</h2>
      {meta && <span className="sub-ket lab">{meta}</span>}
      {children}
    </section>
  )
}

export default function DownloadPage({
  session, photos, uuid, frameWidth, frameHeight
}: {
  session: Session; photos: Photo[]; uuid: string
  frameWidth: number; frameHeight: number
}) {
  // Status media yang diperbarui lewat polling; nilai awal dari server render.
  const [media, setMedia] = useState({
    result_url:   session.result_url,
    gif_url:      session.gif_url ?? null,
    gif_status:   (session.gif_status ?? null) as MediaStatus,
    video_url:    session.video_url ?? null,
    video_status: (session.video_status ?? null) as MediaStatus,
  })
  // Progres cetak. Nilai awal dari render server supaya pelanggan yang baru
  // membuka QR di tengah cetakan langsung melihat kartunya, tanpa menunggu
  // polling pertama.
  const [printState, setPrintState] = useState<PrintState>({
    status:     (session.print_status ?? null) as PrintStatus,
    sheetsDone:  session.print_sheets_done  ?? 0,
    sheetsTotal: session.print_sheets_total ?? 0,
    etaSeconds:  session.print_eta_seconds  ?? null,
    reason:      session.print_reason       ?? null,
    startedAt:   session.print_started_at   ?? null,
  })
  const [lightbox, setLightbox]       = useState<string|null>(null)
  const [downloading, setDownloading] = useState<string|null>(null)
  const [gifUrl, setGifUrl]           = useState<string|null>(null)
  const [gifLoading, setGifLoading]   = useState(false)
  const [gifProgress, setGifProgress] = useState(0)
  const [gifError, setGifError]       = useState<string|null>(null)
  const [gifFrame, setGifFrame]       = useState(0)
  const gifGenRef                     = useRef(false)

  const clientName = session.clients?.name ?? 'Photobooth'
  const photoCount = photos.length
  const layout     = LAYOUTS[photoCount] ?? LAYOUTS[4]
  const cols       = layout.cols
  const rows       = Math.ceil(photoCount / cols)

  // Cell size calculation — sama persis Flutter canvas render
  const cellW = (frameWidth  - layout.leftPadding - layout.rightPadding  - (cols-1)*layout.horizontalSpacing) / cols
  const cellH = (frameHeight - layout.topPadding  - layout.bottomPadding - (rows-1)*layout.verticalSpacing)   / rows

  // Scale down untuk preview di layar
  const MAX_PREVIEW_W = 320
  const previewScale  = Math.min(1, MAX_PREVIEW_W / frameWidth)
  const previewW      = frameWidth  * previewScale
  const previewH      = frameHeight * previewScale

  // GIF dari server (dirakit di mesin) selalu diutamakan: jauh lebih cepat
  // daripada merakit ulang di HP pelanggan, dan hasilnya konsisten.
  const serverGifUrl    = media.gif_status === 'ready' ? media.gif_url : null
  const effectiveGifUrl = serverGifUrl ?? gifUrl

  // Media yang memang diharapkan muncul untuk sesi ini. Status 'failed'
  // dihitung sebagai selesai — bukan sesuatu yang masih perlu ditunggu.
  // Sebelumnya sesi lama yang gagal menampilkan spinner "sedang dirender"
  // selamanya karena tidak pernah ada yang menghentikannya.
  const gifExpected   = photoCount > 1 && media.gif_status != null && media.gif_status !== 'failed'
  const videoExpected = media.video_status != null && media.video_status !== 'failed'

  const steps = [
    { key:'photos', label:'Foto',        done: photoCount > 0,                 show: true },
    { key:'strip',  label:'Photo strip', done: !!media.result_url,             show: true },
    { key:'gif',    label:'GIF animasi', done: media.gif_status === 'ready',   show: gifExpected },
    { key:'video',  label:'Video',       done: media.video_status === 'ready', show: videoExpected },
  ].filter(s => s.show)

  const doneCount    = steps.filter(s => s.done).length
  const allDone      = doneCount === steps.length
  const currentStep  = steps.find(s => !s.done)
  const stillWorking = !allDone

  const printRunning = printState.status === 'queued' || printState.status === 'printing'

  // Polling status selama mesin masih bekerja ATAU printer masih mencetak.
  // Keduanya harus ikut: media biasanya beres dalam ~30 detik, sementara
  // cetakan 4R baru selesai menit-menitan kemudian — dulu polling berhenti
  // duluan dan progres cetaknya membeku di layar pelanggan.
  useEffect(() => {
    if (!stillWorking && !printRunning) return
    const maxAttempts = printRunning ? PRINT_POLL_MAX_ATTEMPTS : POLL_MAX_ATTEMPTS
    let attempts = 0
    let cancelled = false

    const tick = async () => {
      attempts++
      try {
        const res = await fetch(`/api/session-media/${uuid}`, { cache: 'no-store' })
        if (!res.ok) return
        const d = await res.json()
        if (cancelled) return
        setMedia({
          result_url:   d.result_url ?? null,
          gif_url:      d.gif_url ?? null,
          gif_status:   d.gif_status ?? null,
          video_url:    d.video_url ?? null,
          video_status: d.video_status ?? null,
        })
        setPrintState({
          status:      (d.print_status ?? null) as PrintStatus,
          sheetsDone:   d.print_sheets_done  ?? 0,
          sheetsTotal:  d.print_sheets_total ?? 0,
          etaSeconds:   d.print_eta_seconds  ?? null,
          reason:       d.print_reason       ?? null,
          startedAt:    d.print_started_at   ?? null,
        })
      } catch {
        // Jaringan pelanggan bisa naik-turun — diamkan, percobaan berikutnya jalan.
      }
      if (attempts >= maxAttempts) clearInterval(iv)
    }

    const iv = setInterval(tick, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(iv) }
  }, [stillWorking, printRunning, uuid])

  // ── Angka pada cincin ──────────────────────────────────────────────────
  const [now, setNow] = useState(0)
  const stepSinceRef  = useRef(0)
  const openedAtRef   = useRef(0)

  // Jam baru berjalan setelah komponen terpasang di browser, supaya render
  // di server dan render pertama di klien menghasilkan HTML yang sama.
  useEffect(() => {
    const t = Date.now()
    stepSinceRef.current = t
    openedAtRef.current  = t
    setNow(t)
  }, [])

  useEffect(() => { stepSinceRef.current = Date.now() }, [doneCount])

  useEffect(() => {
    if (!stillWorking && !printRunning) return
    const iv = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(iv)
  }, [stillWorking, printRunning])

  const total    = Math.max(steps.length, 1)
  const floorPct = (doneCount / total) * 100
  const slicePct = (1 / total) * 100
  const inStepMs = stepSinceRef.current ? Math.max(0, now - stepSinceRef.current) : 0
  const creep    = slicePct * (1 - Math.exp(-inStepMs / STEP_TAU_MS))
  const percent  = allDone ? 100 : Math.min(CREEP_CEILING, Math.round(floorPct + creep))

  const takingLong =
    stillWorking && openedAtRef.current > 0 && (now - openedAtRef.current) > SLOW_AFTER_MS

  // ── Angka pada batang cetak ────────────────────────────────────────────
  // Waktu mulai diambil dari server (print_started_at), bukan dari saat
  // halaman ini dibuka: pelanggan sering baru scan QR setelah cetakan jalan
  // beberapa saat, dan menghitung dari nol membuat batangnya berjalan jauh
  // lebih lambat daripada printernya. Jam HP yang meleset dijaga oleh clamp
  // di bawah supaya tidak pernah menghasilkan waktu negatif atau lompat.
  const printEta = printState.etaSeconds && printState.etaSeconds > 0
    ? printState.etaSeconds : null
  const printStartMs = printState.startedAt ? Date.parse(printState.startedAt) : NaN
  const printElapsed = (now > 0 && Number.isFinite(printStartMs))
    ? Math.max(0, Math.min((now - printStartMs) / 1000, (printEta ?? 600) * 1.5))
    : 0

  // Lantai dari lembar yang sudah lepas dari antrian — inilah satu-satunya
  // bagian yang benar-benar terukur. Sisanya rayapan waktu.
  const printFloor = printState.sheetsTotal > 0
    ? (printState.sheetsDone / printState.sheetsTotal) * 100 : 0
  const printByTime = printEta ? (printElapsed / printEta) * 100 : 0
  const printPercent = printState.status === 'done'
    ? 100
    : Math.min(PRINT_CEILING, Math.round(Math.max(printFloor, printByTime)))
  const printRemain = printEta ? Math.max(0, Math.round(printEta - printElapsed)) : null

  // ── Penanda selesai: bunyi + getar ─────────────────────────────────────
  // Browser TIDAK mengizinkan suara yang tidak berakar pada sentuhan
  // pelanggan. Jadi AudioContext-nya dibuat dan di-resume saat pelanggan
  // menekan tombol lonceng (atau menyentuh halaman), lalu disimpan untuk
  // dibunyikan nanti — beberapa menit kemudian — saat cetakan selesai.
  const audioRef = useRef<AudioContext|null>(null)
  const [soundArmed, setSoundArmed] = useState(false)

  const armSound = useCallback(async () => {
    try {
      const Ctor = window.AudioContext
        ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      const ctx = audioRef.current ?? new Ctor()
      audioRef.current = ctx
      if (ctx.state === 'suspended') await ctx.resume()
      setSoundArmed(ctx.state === 'running')
    } catch {
      // HP yang memblokir audio tetap dapat penanda visual — jangan ribut.
    }
  }, [])

  const playChime = useCallback(() => {
    const ctx = audioRef.current
    if (!ctx || ctx.state !== 'running') return
    try {
      const t0 = ctx.currentTime
      // Tiga nada naik, cukup menonjol di ruangan ramai tanpa mengagetkan.
      ;[880, 1174.7, 1568].forEach((freq, i) => {
        const at   = t0 + i * 0.17
        const osc  = ctx.createOscillator()
        const gain = ctx.createGain()
        osc.type = 'sine'
        osc.frequency.value = freq
        gain.gain.setValueAtTime(0.0001, at)
        gain.gain.exponentialRampToValueAtTime(0.3, at + 0.02)
        gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.32)
        osc.connect(gain)
        gain.connect(ctx.destination)
        osc.start(at)
        osc.stop(at + 0.34)
      })
    } catch {
      // Tidak ada yang perlu dilakukan kalau audio ditolak di tengah jalan.
    }
  }, [])

  // Bunyi hanya pada PERPINDAHAN ke selesai. Halaman yang dibuka saat
  // cetakannya memang sudah selesai tidak boleh ikut berbunyi.
  const prevPrintStatus = useRef<PrintStatus>(printState.status)
  const [printJustDone, setPrintJustDone] = useState(false)

  useEffect(() => {
    const prev = prevPrintStatus.current
    prevPrintStatus.current = printState.status
    if (printState.status !== 'done' || prev === 'done' || prev == null) return
    playChime()
    // Getar hanya ada di Android; iOS Safari tidak mendukungnya sama sekali.
    try { navigator.vibrate?.([180, 90, 180]) } catch { /* diabaikan */ }
    setPrintJustDone(true)
  }, [printState.status, playChime])

  // Kalau pelanggan sedang membuka aplikasi lain, judul tab yang berkedip
  // adalah satu-satunya penanda yang masih terlihat.
  useEffect(() => {
    if (!printJustDone) return
    const original = document.title
    let on = false
    const iv = setInterval(() => {
      if (document.hidden) {
        on = !on
        document.title = on ? 'Cetakan selesai!' : original
      } else {
        document.title = original
      }
    }, 900)
    const stop = setTimeout(() => setPrintJustDone(false), 120000)
    return () => {
      clearInterval(iv); clearTimeout(stop); document.title = original
    }
  }, [printJustDone])

  // Pratinjau slideshow kecil selama GIF belum ada.
  useEffect(() => {
    if (effectiveGifUrl || photos.length < 2) return
    const iv = setInterval(() => setGifFrame(f => (f+1) % photos.length), 700)
    return () => clearInterval(iv)
  }, [effectiveGifUrl, photos.length])

  // Rakit GIF di browser HANYA sebagai cadangan — kalau mesin gagal membuatnya
  // atau sesi ini dari versi lama yang belum mengunggah GIF. Dulu jalan
  // otomatis begitu tab GIF dibuka; sekarang pelanggan yang memutuskan,
  // supaya HP kentang tidak dipaksa bekerja tanpa diminta.
  const loadScript = (src:string) => new Promise<void>((res,rej)=>{
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s = document.createElement('script'); s.src = src; s.onload = () => res(); s.onerror = rej
    document.head.appendChild(s)
  })

  const generateGif = async () => {
    if (gifGenRef.current) return
    gifGenRef.current = true
    setGifLoading(true); setGifProgress(0); setGifError(null)
    try {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js')
      const GIF = (window as any).GIF

      // Browser memblokir Web Worker dari external URL meski CORS OK.
      // Solusi: fetch dulu script-nya, buat Blob URL, pakai sebagai workerScript.
      const workerRes = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
      if (!workerRes.ok) throw new Error(`Worker fetch failed: ${workerRes.status}`)
      const workerBlob = await workerRes.blob()
      const workerUrl  = URL.createObjectURL(workerBlob)

      const size = 400
      const gif  = new GIF({ workers:2, quality:8, width:size, height:size, workerScript: workerUrl })

      let loaded = 0
      const images: HTMLImageElement[] = []
      for (const p of photos) {
        await new Promise<void>(res => {
          const im = new Image(); im.crossOrigin = 'anonymous'
          im.onload  = () => { images.push(im); loaded++; setGifProgress(Math.round((loaded/photos.length)*60)); res() }
          im.onerror = () => {
            // Ulangi tanpa crossOrigin sebagai cadangan (kasus CORS pinggiran)
            const im2 = new Image()
            im2.onload  = () => { images.push(im2); loaded++; setGifProgress(Math.round((loaded/photos.length)*60)); res() }
            im2.onerror = () => { loaded++; res() }
            im2.src = p.photo_url + '?t=' + Date.now()
          }
          im.src = p.photo_url
        })
      }

      if (images.length === 0) {
        setGifError('Gagal memuat foto')
        setGifLoading(false)
        gifGenRef.current = false
        URL.revokeObjectURL(workerUrl)
        return
      }

      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')!
      for (const im of images) {
        ctx.clearRect(0,0,size,size)
        const r = im.naturalWidth/im.naturalHeight
        let sx=0, sy=0, sw=im.naturalWidth, sh=im.naturalHeight
        if (r>1) { sw=sh; sx=(im.naturalWidth-sw)/2 } else { sh=sw; sy=0 }
        ctx.drawImage(im,sx,sy,sw,sh,0,0,size,size)
        gif.addFrame(canvas,{delay:800,copy:true})
      }

      gif.on('progress',(p:number)=>setGifProgress(60+Math.round(p*40)))
      gif.on('finished',(blob:Blob)=>{
        URL.revokeObjectURL(workerUrl)
        setGifUrl(URL.createObjectURL(blob))
        setGifLoading(false)
        setGifProgress(100)
      })
      gif.render()

    } catch(e) {
      console.error('GIF error:', e)
      setGifError('Gagal membuat GIF')
      setGifLoading(false)
      gifGenRef.current = false
    }
  }

  // ── Unduhan ────────────────────────────────────────────────────────────
  // Berkas hasil ada di CDN R2 (domain berbeda dari halaman ini), jadi
  // membacanya lewat fetch butuh izin CORS. Aturan CORS-nya sudah dipasang
  // di bucket, TAPI objek yang terlanjur di-cache Cloudflare sebelum itu
  // masih disajikan tanpa header CORS — dan permintaan seperti itu ditolak
  // browser tanpa suara. Dulu kegagalannya cuma masuk console.error,
  // sehingga tombolnya terlihat "berputar lalu tidak terjadi apa-apa".
  const saveBlob = (blob:Blob, filename:string) => {
    const href = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = href
    a.download = filename
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    // Jangan dilepas seketika: sebagian browser membatalkan unduhan yang
    // baru saja dimulai kalau URL objeknya langsung dicabut.
    setTimeout(() => URL.revokeObjectURL(href), 60000)
  }

  const fetchBlob = async (url:string) => {
    const res = await fetch(url, { mode:'cors' })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.blob()
  }

  /** Kembalikan true kalau berkas benar-benar tersimpan sebagai unduhan. */
  const downloadOne = async (url:string, filename:string) => {
    try {
      saveBlob(await fetchBlob(url), filename)
      return true
    } catch {
      // Percobaan kedua dengan pemecah cache: memaksa Cloudflare mengambil
      // ulang dari R2, dan salinan segar itu selalu membawa header CORS.
      try {
        const sep = url.includes('?') ? '&' : '?'
        saveBlob(await fetchBlob(`${url}${sep}cb=${Date.now()}`), filename)
        return true
      } catch {
        // Pilihan terakhir: buka berkasnya supaya pelanggan masih bisa
        // menyimpannya manual, alih-alih dibiarkan menatap spinner.
        window.open(url, '_blank', 'noopener')
        return false
      }
    }
  }

  const handleDownload = async (url:string, filename:string, key:string) => {
    setDownloading(key)
    await downloadOne(url, filename)
    setTimeout(()=>setDownloading(null), 800)
  }

  const downloadAllPhotos = async () => {
    setDownloading('all-photos')
    for (let i = 0; i < photos.length; i++) {
      await downloadOne(photos[i].photo_url, `foto_${i+1}_${uuid.slice(0,8)}.jpg`)
      await new Promise(r => setTimeout(r, 350))
    }
    setDownloading(null)
  }

  // Cap tanggal satu baris, mis. "20 Sep 2026 · 21.25 WIB".
  const formatDate = (d:string) => {
    const t = new Date(d)
    const tgl = t.toLocaleDateString('id-ID', { day:'numeric', month:'short', year:'numeric', timeZone:'Asia/Jakarta' })
    const jam = t.toLocaleTimeString('id-ID', { hour:'2-digit', minute:'2-digit', timeZone:'Asia/Jakarta' })
    return `${tgl} · ${jam} WIB`
  }

  const busy = (key:string) => downloading === key

  // ── Pengaduan ──────────────────────────────────────────────────────────
  // Dikirim langsung ke backend VPS (bukan lewat route Next.js) karena di
  // sanalah token Telegram dan kredensial SMTP disimpan.
  const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://api.pabrikenangan.my.id'

  const REASONS = [
    { key:'foto_tidak_muncul',  label:'Foto tidak muncul' },
    { key:'foto_tidak_lengkap', label:'Foto tidak lengkap' },
    { key:'hasil_salah',        label:'Hasil tidak sesuai' },
    { key:'lainnya',            label:'Lainnya' },
  ]

  const [reportOpen, setReportOpen]   = useState(false)
  const [reportSent, setReportSent]   = useState<string|null>(null)
  const [reportBusy, setReportBusy]   = useState(false)
  const [reportError, setReportError] = useState<string|null>(null)
  const [form, setForm] = useState({
    email: '',
    whatsapp: '',
    // Kalau memang tidak ada foto sama sekali, keluhannya sudah jelas —
    // jangan suruh pelanggan memilih yang sudah kita tahu jawabannya.
    reason: photoCount === 0 ? 'foto_tidak_muncul' : 'foto_tidak_lengkap',
  })

  const submitReport = async () => {
    const email = form.email.trim()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setReportError('Alamat emailnya sepertinya belum benar.')
      return
    }
    setReportBusy(true); setReportError(null)
    try {
      const res = await fetch(`${API_BASE}/api/complaints`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transaction_code: uuid,
          email,
          whatsapp: form.whatsapp.trim() || undefined,
          reason: form.reason,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setReportError(data?.message || 'Gagal mengirim laporan. Coba lagi sebentar lagi.')
        return
      }
      setReportSent(data?.message || 'Laporan kamu sudah kami terima.')
      setReportOpen(false)
    } catch {
      setReportError('Tidak bisa terhubung ke server. Cek koneksi kamu, lalu coba lagi.')
    } finally {
      setReportBusy(false)
    }
  }

  // Strip dirakit ulang di browser dengan layout pixel-perfect sama Flutter —
  // dipakai hanya selama strip final belum diunggah mesin.
  const StripPreview = () => (
    <div style={{ position:'relative', width:frameWidth, height:frameHeight, background:'#150C09', overflow:'hidden' }}>
      {photos.slice(0,photoCount).map((p,i)=>{
        const col = i % cols
        const row = Math.floor(i / cols)
        const x = layout.leftPadding + col*(cellW+layout.horizontalSpacing)
        const y = layout.topPadding  + row*(cellH+layout.verticalSpacing)
        return (
          <div key={i} style={{ position:'absolute', left:x, top:y, width:cellW, height:cellH, overflow:'hidden' }}>
            <img src={p.photo_url} alt="" crossOrigin="anonymous"
              style={{ width:'100%', height:'100%', objectFit:'cover', objectPosition:'center top', display:'block' }}/>
          </div>
        )
      })}
    </div>
  )

  const gifBusyServer = media.gif_status === 'processing' || media.gif_status === 'pending'
  const gifPreviewSrc = effectiveGifUrl ?? photos[gifFrame]?.photo_url ?? null

  return (
    <>
      <style>{DOWNLOAD_CSS}</style>

      <div className="dw">
        <div className="sinar" aria-hidden/>
        <div className="isi">

          {/* ── KEPALA ── */}
          <header className="kepala">
            {/* Co-branding dengan mitra d'Logok */}
            <div className="logo-duo">
              <img className="logo-pk" src="/dlogok/logo-pk.webp" alt="Pabrik Kenangan"/>
              <span className="kali" aria-hidden>×</span>
              <img className="logo-dl" src="/dlogok/logo-dlogok-putih.webp" alt="d'Logok — Warmindo, Games and Working Space"/>
            </div>
            {/* Teks Bristol: tanpa huruf "b". */}
            <h1 className="judul">
              {allDone
                ? <><span>Fotomu</span><span>sudah jadi!</span></>
                : <><span>Lagi</span><span>disiapin…</span></>}
            </h1>
            <span className="tanggal lab">{formatDate(session.created_at)}</span>
          </header>

          {/* ── PROGRES MEDIA ── */}
          {stillWorking && (
            <div style={{ marginTop:28 }}>
              <DevelopingCard
                percent={percent}
                photoUrl={photos[0]?.photo_url ?? null}
                steps={steps}
                currentKey={currentStep?.key}
                caption={
                  takingLong
                    ? 'Agak lebih lama dari biasanya'
                    : currentStep
                      ? `Menyiapkan ${currentStep.label.toLowerCase()}…`
                      : 'Menyiapkan hasil…'
                }
                hint={
                  takingLong
                    ? 'Halaman ini memperbarui dirinya sendiri — tidak perlu di-refresh. Yang sudah jadi tetap bisa diunduh di bawah.'
                    : 'Biasanya sekitar 30 detik. Halaman ini memperbarui dirinya sendiri.'
                }
              />
            </div>
          )}

          {/* ── PROGRES CETAK ── */}
          {printState.status && (
            <div style={{ marginTop:32 }}>
              <PrintCard
                status={printState.status}
                sheetsDone={printState.sheetsDone}
                sheetsTotal={printState.sheetsTotal}
                percent={printPercent}
                remainSec={printRemain}
                reason={printState.reason}
                soundArmed={soundArmed}
                onArmSound={armSound}
                sheetSrc={media.result_url}
                photoUrls={photos.map(p => p.photo_url)}
                justDone={printJustDone}
              />
            </div>
          )}

          {/* ── PHOTO STRIP ── */}
          <Section title="Photo strip" meta={media.result_url ? 'hasil final dengan frame' : 'pratinjau sementara'}>
            {media.result_url ? (
              <div className="utama" style={{ maxWidth:previewW + 20 }}>
                <div className="stiker st-hasil" aria-hidden>
                  <div className="stiker-isi"><span className="lab">Siap</span><span className="disp">simpan!</span></div>
                </div>
                <button onClick={()=>setLightbox(media.result_url!)} aria-label="Perbesar photo strip">
                  <img src={media.result_url} alt="Photo strip"/>
                </button>
              </div>
            ) : photos.length > 0 ? (
              <div className="utama" style={{ width:previewW + 20 }}>
                <div style={{ width:previewW, height:previewH, overflow:'hidden', borderRadius:4 }}>
                  <div style={{ transform:`scale(${previewScale})`, transformOrigin:'top left' }}>
                    <StripPreview/>
                  </div>
                </div>
              </div>
            ) : (
              <div className="kartu" style={{ marginTop:20, padding:'40px 20px', textAlign:'center' }}>
                <Loader2 size={24} className="muter" style={{ margin:'0 auto' }}/>
                <p className="lab" style={{ marginTop:10, fontSize:12 }}>Foto belum masuk</p>
              </div>
            )}

            <button
              className="tombol kuning"
              style={{ marginTop:26 }}
              disabled={!media.result_url || busy('strip')}
              onClick={()=>handleDownload(media.result_url!, `photobooth_strip_${uuid.slice(0,8)}.png`, 'strip')}>
              {busy('strip')
                ? <><Loader2 size={18} className="muter"/>Mengunduh…</>
                : media.result_url
                  ? <><Download size={18}/>Simpan photo strip</>
                  : <><Loader2 size={18} className="muter"/>Menunggu strip</>}
            </button>
          </Section>

          {/* ── FOTO ASLI ── */}
          {photos.length > 0 && (
            <Section title="Foto asli" meta={`${photos.length} foto tanpa frame`}>
              <div className="kisi">
                {photos.map((p,i)=>(
                  <figure key={i} className="foto" onClick={()=>setLightbox(p.photo_url)}>
                    <img src={p.photo_url} alt={`Foto ${i+1}`}/>
                    <figcaption className="lab">Foto {i+1}</figcaption>
                    <button
                      className="unduh-bulat"
                      aria-label={`Simpan foto ${i+1}`}
                      onClick={e=>{ e.stopPropagation(); handleDownload(p.photo_url, `foto_${i+1}_${uuid.slice(0,8)}.jpg`, `photo_${i}`) }}>
                      {busy(`photo_${i}`) ? <Loader2 size={16} className="muter"/> : <Download size={16}/>}
                    </button>
                  </figure>
                ))}
              </div>
              <button
                className="tombol garis"
                style={{ marginTop:22 }}
                disabled={busy('all-photos')}
                onClick={downloadAllPhotos}>
                {busy('all-photos')
                  ? <><Loader2 size={16} className="muter"/>Mengunduh {photos.length} foto…</>
                  : <><Download size={16}/>Simpan semua foto</>}
              </button>
            </Section>
          )}

          {/* ── GIF & VIDEO ── */}
          {(photoCount > 1 || media.video_status != null) && (
            <Section title="GIF & video">
              <div className="duo">

                {/* GIF */}
                {photoCount > 1 && (
                  <figure className="kartu media">
                    <div className="media-isi" style={{ cursor: effectiveGifUrl ? 'zoom-in' : 'default' }}
                      onClick={()=> effectiveGifUrl && setLightbox(effectiveGifUrl)}>
                      {gifPreviewSrc ? <img src={gifPreviewSrc} alt="GIF animasi"/> : <Sparkles size={22}/>}
                    </div>
                    <h3 className="lab">GIF animasi</h3>
                    <p className="teks">
                      {effectiveGifUrl
                        ? (serverGifUrl ? 'Dibuat di mesin photobooth' : 'Dibuat di HP kamu')
                        : gifLoading
                          ? `Membuat di HP kamu… ${gifProgress}%`
                          : gifError
                            ? gifError
                            : gifBusyServer
                              ? 'Sedang dibuat di mesin'
                              : 'Bisa dirakit langsung di HP'}
                    </p>
                    {effectiveGifUrl ? (
                      <button className="tombol merah kecil" disabled={busy('gif')}
                        onClick={()=>handleDownload(effectiveGifUrl, `photobooth_gif_${uuid.slice(0,8)}.gif`, 'gif')}>
                        {busy('gif') ? <Loader2 size={14} className="muter"/> : <Download size={14}/>}Simpan
                      </button>
                    ) : gifLoading ? (
                      <button className="tombol lunak kecil" disabled><Loader2 size={14} className="muter"/>{gifProgress}%</button>
                    ) : gifBusyServer ? (
                      <button className="tombol lunak kecil" disabled><Loader2 size={14} className="muter"/>Dibuat</button>
                    ) : (
                      <button className="tombol lunak kecil" onClick={generateGif}>
                        <Sparkles size={14}/>{gifError ? 'Coba lagi' : 'Buat GIF'}
                      </button>
                    )}
                  </figure>
                )}

                {/* Video */}
                {media.video_status != null && (
                  <figure className="kartu media">
                    <div className="media-isi">
                      {media.video_url ? (
                        <video src={media.video_url} controls playsInline preload="metadata"/>
                      ) : media.video_status === 'failed' ? (
                        <AlertCircle size={22}/>
                      ) : (
                        <Film size={22}/>
                      )}
                    </div>
                    <h3 className="lab">Video</h3>
                    <p className="teks">
                      {media.video_url
                        ? 'Klip sesi digabung dengan frame'
                        : media.video_status === 'failed'
                          ? 'Tidak tersedia untuk sesi ini'
                          : 'Sedang dirender di mesin'}
                    </p>
                    {media.video_url ? (
                      <button className="tombol merah kecil" disabled={busy('video')}
                        onClick={()=>handleDownload(media.video_url!, `photobooth_video_${uuid.slice(0,8)}.mp4`, 'video')}>
                        {busy('video') ? <Loader2 size={14} className="muter"/> : <Download size={14}/>}Simpan
                      </button>
                    ) : media.video_status === 'failed' ? null : (
                      <button className="tombol lunak kecil" disabled><Loader2 size={14} className="muter"/>Dirender</button>
                    )}
                  </figure>
                )}
              </div>
            </Section>
          )}

          {/* ── PENGADUAN ── */}
          <section className="lapor">
            {reportSent ? (
              <div className="kartu terkirim">
                <Check size={18} strokeWidth={3} color="#1E7A4B" style={{ flexShrink:0, marginTop:1 }}/>
                <div>
                  <h3 className="lab">Laporan terkirim</h3>
                  <p className="teks">{reportSent}</p>
                </div>
              </div>
            ) : photoCount === 0 ? (
              /* Tidak ada satu pun foto: ini keadaan yang paling bikin panik,
                 jadi ajakan melapornya ditampilkan terang-terangan. */
              <div className="kartu" style={{ padding:'22px 18px' }}>
                <h3 className="lab" style={{ fontSize:15, color:'#2B1D12' }}>Fotonya belum muncul?</h3>
                <p className="teks" style={{ fontSize:13, color:'#8A6F60', lineHeight:1.5, margin:'6px 0 16px' }}>
                  Tinggalkan email kamu — hasilnya kami kirim ke sana begitu tersedia.
                </p>
                <button className="tombol merah" onClick={()=>{ setReportError(null); setReportOpen(true) }}>
                  <AlertCircle size={16}/>Laporkan
                </button>
              </div>
            ) : (
              <button className="lapor-link teks" onClick={()=>{ setReportError(null); setReportOpen(true) }}>
                Ada yang kurang dengan hasilnya? Laporkan
              </button>
            )}
          </section>

          {/* ── KAKI ── */}
          <footer className="kaki">
            <div className="logo-duo">
              <img className="logo-pk" src="/dlogok/logo-pk.webp" alt=""/>
              <span className="kali" aria-hidden>×</span>
              <img className="logo-dl" src="/dlogok/logo-dlogok-putih.webp" alt=""/>
            </div>
            <code>{uuid.slice(0,24)}…</code>
          </footer>
        </div>
      </div>

      {/* ── MODAL PENGADUAN ── */}
      {reportOpen && (
        <div className="dw-scrim" onClick={()=>!reportBusy && setReportOpen(false)}>
          <div className="dw-modal" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Laporkan masalah">
            <h2>Laporkan masalah</h2>
            <p className="ket">
              Kami kirim hasil fotomu ke email yang kamu tulis di bawah, dan petugas
              di lokasi langsung diberi tahu.
            </p>

            <div style={{ marginBottom:16 }}>
              <label className="label" htmlFor="pk-email">Email <span style={{ color:'#C23A2A' }}>*</span></label>
              <input
                id="pk-email" className="field" type="email" inputMode="email"
                autoComplete="email" placeholder="nama@email.com"
                value={form.email}
                onChange={e=>setForm(f=>({ ...f, email:e.target.value }))}
              />
            </div>

            <div style={{ marginBottom:16 }}>
              <label className="label" htmlFor="pk-wa">WhatsApp <span style={{ textTransform:'none', letterSpacing:0 }}>(opsional)</span></label>
              <input
                id="pk-wa" className="field" type="tel" inputMode="tel"
                autoComplete="tel" placeholder="08xxxxxxxxxx"
                value={form.whatsapp}
                onChange={e=>setForm(f=>({ ...f, whatsapp:e.target.value }))}
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <span className="label">Masalahnya apa?</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {REASONS.map(r => (
                  <button
                    key={r.key} type="button"
                    className={`chip ${form.reason === r.key ? 'aktif' : ''}`}
                    onClick={()=>setForm(f=>({ ...f, reason:r.key }))}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {reportError && (
              <div style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom:16, padding:'11px 13px', borderRadius:12, background:'rgba(194,58,42,0.08)' }}>
                <AlertCircle size={15} color="#C23A2A" style={{ flexShrink:0, marginTop:1 }}/>
                <p style={{ margin:0, fontSize:13, color:'#C23A2A', lineHeight:1.5 }}>{reportError}</p>
              </div>
            )}

            <div className="aksi">
              <button className="btn batal" disabled={reportBusy} onClick={()=>setReportOpen(false)}>
                Batal
              </button>
              <button className="btn utama" disabled={reportBusy} onClick={submitReport}>
                {reportBusy
                  ? <><Loader2 size={15} style={{ animation:'dw-spin .8s linear infinite' }}/>Mengirim…</>
                  : 'Kirim laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="dw-lb" onClick={()=>setLightbox(null)}>
          <img src={lightbox} alt="Pratinjau"
            style={{ maxWidth:'92vw', maxHeight:'88dvh', objectFit:'contain', borderRadius:10, background:'#FFF6E6', padding:6 }}
            onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setLightbox(null)} aria-label="Tutup"
            style={{ position:'fixed', top:'max(16px, env(safe-area-inset-top))', right:16, width:44, height:44, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,246,230,0.14)', border:'1px solid rgba(255,246,230,0.3)', color:'#FFF6E6', fontSize:17 }}>
            ✕
          </button>
        </div>
      )}
    </>
  )
}
