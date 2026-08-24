'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Check, Loader2, Film, Sparkles, AlertCircle } from 'lucide-react'

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
}
type Photo = { photo_url: string; photo_order: number }

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

// ── Cincin progres ───────────────────────────────────────────────────────
function ProgressRing({ percent, caption, hint }: { percent:number; caption:string; hint?:string }) {
  const R = 46
  const C = 2 * Math.PI * R
  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:14 }}>
      <div style={{ position:'relative', width:120, height:120 }}>
        <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
          <defs>
            <linearGradient id="pk-ring" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%"   stopColor="#E83530"/>
              <stop offset="100%" stopColor="#C02018"/>
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={R} fill="none" stroke="rgba(212,43,34,0.12)" strokeWidth="8"/>
          <circle
            cx="60" cy="60" r={R} fill="none"
            stroke="url(#pk-ring)" strokeWidth="8" strokeLinecap="round"
            strokeDasharray={C}
            strokeDashoffset={C * (1 - percent / 100)}
            transform="rotate(-90 60 60)"
            style={{ transition:'stroke-dashoffset .7s cubic-bezier(.4,0,.2,1)' }}
          />
        </svg>
        <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
          <span style={{ fontSize:26, fontWeight:800, color:'#150C09', letterSpacing:'-0.02em', lineHeight:1 }}>
            {percent}<span style={{ fontSize:14, fontWeight:700, color:'#9E8880' }}>%</span>
          </span>
        </div>
      </div>
      <div style={{ textAlign:'center' }}>
        <p style={{ fontSize:14, fontWeight:600, color:'#150C09', marginBottom:4 }}>{caption}</p>
        {hint && <p style={{ fontSize:12.5, color:'#9E8880', lineHeight:1.55, maxWidth:290, margin:'0 auto' }}>{hint}</p>}
      </div>
    </div>
  )
}

// ── Satu blok hasil ──────────────────────────────────────────────────────
function Section({ title, meta, children }: { title:string; meta?:string; children:React.ReactNode }) {
  return (
    <section style={{ marginTop:36 }}>
      <div style={{ display:'flex', alignItems:'baseline', gap:10, marginBottom:14, flexWrap:'wrap' }}>
        <h2 style={{ fontSize:13, fontWeight:700, color:'#4A2E22', letterSpacing:'0.08em', textTransform:'uppercase' }}>
          {title}
        </h2>
        {meta && <span style={{ fontSize:12, color:'#B0A09A' }}>{meta}</span>}
      </div>
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

  // Polling status selama mesin masih bekerja.
  useEffect(() => {
    if (!stillWorking) return
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
      } catch {
        // Jaringan pelanggan bisa naik-turun — diamkan, percobaan berikutnya jalan.
      }
      if (attempts >= POLL_MAX_ATTEMPTS) clearInterval(iv)
    }

    const iv = setInterval(tick, POLL_INTERVAL_MS)
    return () => { cancelled = true; clearInterval(iv) }
  }, [stillWorking, uuid])

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
    if (!stillWorking) return
    const iv = setInterval(() => setNow(Date.now()), 500)
    return () => clearInterval(iv)
  }, [stillWorking])

  const total    = Math.max(steps.length, 1)
  const floorPct = (doneCount / total) * 100
  const slicePct = (1 / total) * 100
  const inStepMs = stepSinceRef.current ? Math.max(0, now - stepSinceRef.current) : 0
  const creep    = slicePct * (1 - Math.exp(-inStepMs / STEP_TAU_MS))
  const percent  = allDone ? 100 : Math.min(CREEP_CEILING, Math.round(floorPct + creep))

  const takingLong =
    stillWorking && openedAtRef.current > 0 && (now - openedAtRef.current) > SLOW_AFTER_MS

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

  const handleDownload = async (url:string, filename:string, key:string) => {
    setDownloading(key)
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob); a.download = filename; a.click()
      URL.revokeObjectURL(a.href)
    } catch(e) { console.error(e) }
    setTimeout(()=>setDownloading(null), 1200)
  }

  const downloadAllPhotos = async () => {
    setDownloading('all-photos')
    for (let i = 0; i < photos.length; i++) {
      try {
        const res  = await fetch(photos[i].photo_url)
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = `foto_${i+1}_${uuid.slice(0,8)}.jpg`
        a.click()
        URL.revokeObjectURL(a.href)
      } catch(e) { console.error(e) }
      await new Promise(r => setTimeout(r, 350))
    }
    setDownloading(null)
  }

  const formatDate = (d:string) =>
    new Date(d).toLocaleString('id-ID', { dateStyle:'long', timeStyle:'short' })

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

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        body{font-family:'Poppins',sans-serif;background:#FAF7F5;color:#150C09;overflow-x:hidden}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes rise{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes soft-in{from{opacity:0}to{opacity:1}}
        .rise{animation:rise .5s ease both}
        .rise-2{animation:rise .5s ease .08s both}
        .rise-3{animation:rise .5s ease .16s both}
        @media (prefers-reduced-motion: reduce){ .rise,.rise-2,.rise-3{animation:none} }

        .wrap{max-width:560px;margin:0 auto;padding:40px 20px 72px}
        @media (max-width:520px){ .wrap{padding:28px 16px 56px} }

        /* Kartu: satu garis tipis, tanpa bayangan berat. */
        .card{background:#fff;border:1px solid rgba(212,43,34,0.10);border-radius:18px}

        .btn{
          display:flex;align-items:center;justify-content:center;gap:9px;
          width:100%;padding:14px 18px;border-radius:14px;border:1px solid transparent;
          font-family:'Poppins',sans-serif;font-size:14px;font-weight:600;cursor:pointer;
          transition:filter .2s,transform .12s,background .2s;
        }
        .btn:active:not(:disabled){transform:translateY(1px)}
        .btn:disabled{opacity:.55;cursor:default}
        .btn-primary{background:linear-gradient(135deg,#E83530,#C02018);color:#fff;box-shadow:0 6px 18px rgba(212,43,34,.24)}
        .btn-primary:hover:not(:disabled){filter:brightness(1.06)}
        .btn-ghost{background:#fff;border-color:rgba(212,43,34,0.18);color:#C02018}
        .btn-ghost:hover:not(:disabled){background:rgba(212,43,34,0.045)}
        .btn:focus-visible,.row-btn:focus-visible,.thumb-dl:focus-visible{outline:2px solid #D42B22;outline-offset:2px}

        .row{display:flex;align-items:center;gap:14px;padding:14px 16px}
        .row-icon{
          width:38px;height:38px;border-radius:11px;flex-shrink:0;overflow:hidden;
          display:flex;align-items:center;justify-content:center;
          background:rgba(212,43,34,0.07);color:#D42B22;
        }
        .row-btn{
          flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:7px;
          padding:10px 14px;border-radius:11px;cursor:pointer;border:none;
          background:linear-gradient(135deg,#E83530,#C02018);color:#fff;
          font-family:'Poppins',sans-serif;font-size:12.5px;font-weight:600;
        }
        .row-btn:disabled{opacity:.6;cursor:default}
        .row-btn.ghost{background:#fff;border:1px solid rgba(212,43,34,0.2);color:#C02018}

        .photo-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px}
        @media (max-width:420px){ .photo-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px} }
        .thumb{
          position:relative;border-radius:12px;overflow:hidden;cursor:zoom-in;
          border:1px solid rgba(212,43,34,0.10);background:#fff;
        }
        .thumb img{width:100%;aspect-ratio:1;object-fit:cover;object-position:center top;display:block}
        .thumb-dl{
          position:absolute;right:6px;bottom:6px;
          width:28px;height:28px;border-radius:9px;border:none;cursor:pointer;
          display:flex;align-items:center;justify-content:center;
          background:rgba(21,12,9,.62);color:#fff;backdrop-filter:blur(4px);
        }

        /* ── Formulir pengaduan ── */
        .field{
          width:100%;padding:12px 14px;border-radius:12px;
          border:1px solid rgba(212,43,34,0.18);background:#fff;color:#150C09;
          font-family:'Poppins',sans-serif;font-size:14px;outline:none;
          transition:border-color .2s,box-shadow .2s;
        }
        .field::placeholder{color:#C7B8B2}
        .field:focus{border-color:#D42B22;box-shadow:0 0 0 3px rgba(212,43,34,.10)}
        .field-label{
          display:block;font-size:11.5px;font-weight:700;color:#7A6259;
          letter-spacing:.06em;text-transform:uppercase;margin-bottom:7px;
        }
        .chip{
          padding:9px 14px;border-radius:11px;cursor:pointer;
          border:1px solid rgba(212,43,34,0.18);background:#fff;color:#7A6259;
          font-family:'Poppins',sans-serif;font-size:12.5px;font-weight:600;
        }
        .chip.active{background:rgba(212,43,34,.08);border-color:#D42B22;color:#C02018}
        .chip:focus-visible{outline:2px solid #D42B22;outline-offset:2px}

        .modal-scrim{
          position:fixed;inset:0;z-index:150;padding:20px;
          background:rgba(21,12,9,.55);backdrop-filter:blur(6px);
          display:flex;align-items:center;justify-content:center;
          animation:soft-in .15s ease both;
        }
        .modal-box{
          width:100%;max-width:420px;background:#fff;border-radius:20px;
          border:1px solid rgba(212,43,34,0.12);
          max-height:min(88vh,88dvh);overflow-y:auto;
          padding:26px 22px;animation:rise .25s ease both;
        }
        @media (max-width:420px){ .modal-box{padding:22px 18px} }

        .lb{animation:soft-in .15s ease both}
        ::-webkit-scrollbar{width:5px;height:5px}
        ::-webkit-scrollbar-thumb{background:rgba(212,43,34,0.18);border-radius:3px}
      `}</style>

      <div style={{ minHeight:'100dvh', background:'#FAF7F5' }}>
        <div className="wrap">

          {/* ── HEADER ── */}
          <header className="rise" style={{ textAlign:'center', marginBottom:32 }}>
            <img
              src="/logo-pk.webp"
              alt="Pabrik Kenangan"
              width={196} height={110}
              style={{ width:168, height:'auto', margin:'0 auto 20px', display:'block' }}
            />
            <h1 style={{ fontSize:'clamp(22px,5.2vw,30px)', fontWeight:800, letterSpacing:'-0.02em', lineHeight:1.25, marginBottom:8 }}>
              {allDone ? 'Foto kamu sudah siap' : 'Sedang menyiapkan hasil'}
            </h1>
            <p style={{ fontSize:13.5, color:'#9E8880' }}>
              {formatDate(session.created_at)} · {clientName}
            </p>
          </header>

          {/* ── PROGRES ── */}
          {stillWorking && (
            <div className="card rise-2" style={{ padding:'28px 20px' }}>
              <ProgressRing
                percent={percent}
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

              {/* Langkah nyata — inilah yang mengunci angka di cincin. */}
              <div style={{
                display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'8px 16px',
                marginTop:22, paddingTop:18, borderTop:'1px solid rgba(212,43,34,0.08)',
              }}>
                {steps.map(s => (
                  <span key={s.key} style={{
                    display:'inline-flex', alignItems:'center', gap:6,
                    fontSize:12, fontWeight: s.done ? 600 : 500,
                    color: s.done ? '#1E7A4B' : '#B0A09A',
                  }}>
                    {s.done
                      ? <Check size={13} strokeWidth={3}/>
                      : s === currentStep
                        ? <Loader2 size={13} style={{ animation:'spin .9s linear infinite' }}/>
                        : <span style={{ width:7, height:7, borderRadius:'50%', background:'currentColor', opacity:.45 }}/>}
                    {s.label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── PHOTO STRIP ── */}
          <Section title="Photo strip" meta={media.result_url ? 'hasil final dengan frame' : 'pratinjau sementara'}>
            <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
              {media.result_url ? (
                <button
                  onClick={()=>setLightbox(media.result_url!)}
                  style={{
                    padding:0, border:'1px solid rgba(212,43,34,0.10)', borderRadius:16,
                    overflow:'hidden', cursor:'zoom-in', background:'#fff',
                    maxWidth:previewW, width:'100%', display:'block',
                  }}>
                  <img src={media.result_url} alt="Photo strip" style={{ width:'100%', display:'block' }}/>
                </button>
              ) : photos.length > 0 ? (
                <div style={{
                  width:previewW, height:previewH, overflow:'hidden',
                  border:'1px solid rgba(212,43,34,0.10)', borderRadius:16,
                }}>
                  <div style={{ transform:`scale(${previewScale})`, transformOrigin:'top left' }}>
                    <StripPreview/>
                  </div>
                </div>
              ) : (
                <div className="card" style={{ padding:'44px 20px', textAlign:'center', width:'100%' }}>
                  <Loader2 size={22} color="#D42B22" style={{ animation:'spin .9s linear infinite' }}/>
                  <p style={{ marginTop:10, fontSize:13, color:'#9E8880' }}>Foto belum masuk</p>
                </div>
              )}

              <button
                className="btn btn-primary"
                disabled={!media.result_url || busy('strip')}
                onClick={()=>handleDownload(media.result_url!, `photobooth_strip_${uuid.slice(0,8)}.png`, 'strip')}
                style={{ maxWidth:previewW }}>
                {busy('strip')
                  ? <><Loader2 size={16} style={{ animation:'spin .8s linear infinite' }}/>Mengunduh…</>
                  : media.result_url
                    ? <><Download size={16}/>Download strip</>
                    : <><Loader2 size={16} style={{ animation:'spin .9s linear infinite' }}/>Menunggu strip</>}
              </button>
            </div>
          </Section>

          {/* ── FOTO ASLI ── */}
          {photos.length > 0 && (
            <Section title="Foto asli" meta={`${photos.length} foto tanpa frame`}>
              <div className="photo-grid">
                {photos.map((p,i)=>(
                  <div key={i} className="thumb" onClick={()=>setLightbox(p.photo_url)}>
                    <img src={p.photo_url} alt={`Foto ${i+1}`}/>
                    <button
                      className="thumb-dl"
                      aria-label={`Simpan foto ${i+1}`}
                      onClick={e=>{ e.stopPropagation(); handleDownload(p.photo_url, `foto_${i+1}_${uuid.slice(0,8)}.jpg`, `photo_${i}`) }}>
                      {busy(`photo_${i}`)
                        ? <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }}/>
                        : <Download size={13}/>}
                    </button>
                  </div>
                ))}
              </div>
              <button
                className="btn btn-ghost"
                style={{ marginTop:12 }}
                disabled={busy('all-photos')}
                onClick={downloadAllPhotos}>
                {busy('all-photos')
                  ? <><Loader2 size={15} style={{ animation:'spin .8s linear infinite' }}/>Mengunduh {photos.length} foto…</>
                  : <><Download size={15}/>Download semua foto</>}
              </button>
            </Section>
          )}

          {/* ── GIF & VIDEO ── */}
          {(photoCount > 1 || media.video_status != null) && (
            <Section title="Lainnya">
              <div className="card" style={{ overflow:'hidden' }}>

                {/* GIF */}
                {photoCount > 1 && (
                  <div className="row">
                    <div className="row-icon">
                      {effectiveGifUrl
                        ? <img src={effectiveGifUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                        : photos[gifFrame]
                          ? <img src={photos[gifFrame].photo_url} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }}/>
                          : <Sparkles size={17}/>}
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13.5, fontWeight:600, marginBottom:2 }}>GIF animasi</p>
                      <p style={{ fontSize:11.5, color:'#9E8880' }}>
                        {effectiveGifUrl
                          ? (serverGifUrl ? 'Dibuat di mesin photobooth' : 'Dibuat di HP kamu')
                          : gifLoading
                            ? `Membuat di HP kamu… ${gifProgress}%`
                            : gifError
                              ? gifError
                              : (media.gif_status === 'processing' || media.gif_status === 'pending')
                                ? 'Sedang dibuat di mesin'
                                : 'Bisa dirakit langsung di HP'}
                      </p>
                    </div>
                    {effectiveGifUrl ? (
                      <button className="row-btn" disabled={busy('gif')}
                        onClick={()=>handleDownload(effectiveGifUrl, `photobooth_gif_${uuid.slice(0,8)}.gif`, 'gif')}>
                        {busy('gif')
                          ? <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }}/>
                          : <Download size={13}/>}
                        Simpan
                      </button>
                    ) : gifLoading ? (
                      <button className="row-btn ghost" disabled>
                        <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }}/>{gifProgress}%
                      </button>
                    ) : (media.gif_status === 'processing' || media.gif_status === 'pending') ? (
                      <button className="row-btn ghost" disabled>
                        <Loader2 size={13} style={{ animation:'spin .9s linear infinite' }}/>Dibuat
                      </button>
                    ) : (
                      <button className="row-btn ghost" onClick={generateGif}>
                        <Sparkles size={13}/>{gifError ? 'Coba lagi' : 'Buat'}
                      </button>
                    )}
                  </div>
                )}

                {/* Video */}
                {media.video_status != null && (
                  <div className="row" style={{ borderTop: photoCount > 1 ? '1px solid rgba(212,43,34,0.08)' : 'none' }}>
                    <div className="row-icon"><Film size={17}/></div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:13.5, fontWeight:600, marginBottom:2 }}>Video</p>
                      <p style={{ fontSize:11.5, color:'#9E8880' }}>
                        {media.video_url
                          ? 'Klip sesi digabung dengan frame'
                          : media.video_status === 'failed'
                            ? 'Tidak tersedia untuk sesi ini'
                            : 'Sedang dirender di mesin'}
                      </p>
                    </div>
                    {media.video_url ? (
                      <button className="row-btn" disabled={busy('video')}
                        onClick={()=>handleDownload(media.video_url!, `photobooth_video_${uuid.slice(0,8)}.mp4`, 'video')}>
                        {busy('video')
                          ? <Loader2 size={13} style={{ animation:'spin .8s linear infinite' }}/>
                          : <Download size={13}/>}
                        Simpan
                      </button>
                    ) : media.video_status === 'failed' ? (
                      <AlertCircle size={16} color="#B0A09A" style={{ flexShrink:0 }}/>
                    ) : (
                      <button className="row-btn ghost" disabled>
                        <Loader2 size={13} style={{ animation:'spin .9s linear infinite' }}/>Dirender
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Pemutar video muncul begitu filenya ada */}
              {media.video_url && (
                <video
                  src={media.video_url} controls playsInline preload="metadata"
                  style={{ width:'100%', marginTop:12, borderRadius:16, border:'1px solid rgba(212,43,34,0.10)', display:'block', background:'#150C09' }}/>
              )}
            </Section>
          )}

          {/* ── PENGADUAN ── */}
          <section style={{ marginTop:36 }}>
            {reportSent ? (
              <div className="card" style={{ padding:'18px 18px', display:'flex', gap:12, alignItems:'flex-start' }}>
                <div style={{ width:34, height:34, borderRadius:11, flexShrink:0, background:'rgba(30,122,75,0.10)', color:'#1E7A4B', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <Check size={17} strokeWidth={3}/>
                </div>
                <div>
                  <p style={{ fontSize:13.5, fontWeight:600, marginBottom:3 }}>Laporan terkirim</p>
                  <p style={{ fontSize:12.5, color:'#9E8880', lineHeight:1.55 }}>{reportSent}</p>
                </div>
              </div>
            ) : photoCount === 0 ? (
              /* Tidak ada satu pun foto: ini keadaan yang paling bikin panik,
                 jadi ajakan melapornya ditampilkan terang-terangan. */
              <div className="card" style={{ padding:'20px 18px', textAlign:'center' }}>
                <p style={{ fontSize:14, fontWeight:600, marginBottom:6 }}>Fotonya belum muncul?</p>
                <p style={{ fontSize:12.5, color:'#9E8880', lineHeight:1.55, marginBottom:14 }}>
                  Tinggalkan email kamu — hasilnya kami kirim ke sana begitu tersedia.
                </p>
                <button className="btn btn-primary" onClick={()=>{ setReportError(null); setReportOpen(true) }}>
                  <AlertCircle size={15}/>Laporkan
                </button>
              </div>
            ) : (
              <div style={{ textAlign:'center' }}>
                <button
                  onClick={()=>{ setReportError(null); setReportOpen(true) }}
                  style={{
                    background:'none', border:'none', cursor:'pointer', padding:'8px 12px',
                    fontFamily:"'Poppins',sans-serif", fontSize:12.5, color:'#9E8880',
                    textDecoration:'underline', textUnderlineOffset:3,
                  }}>
                  Ada yang kurang dengan hasilnya? Laporkan
                </button>
              </div>
            )}
          </section>

          {/* ── FOOTER ── */}
          <footer className="rise-3" style={{ marginTop:44, textAlign:'center' }}>
            <div style={{ height:1, background:'rgba(212,43,34,0.10)', marginBottom:20 }}/>
            <p style={{ fontSize:10, letterSpacing:'0.18em', textTransform:'uppercase', color:'#B0A09A', marginBottom:6 }}>
              Powered by
            </p>
            <p style={{ fontSize:14, fontWeight:700, color:'#7A6259' }}>{clientName}</p>
            <code style={{ display:'block', marginTop:10, fontSize:10, color:'#C7B8B2', fontFamily:'monospace' }}>
              {uuid.slice(0,24)}…
            </code>
          </footer>
        </div>
      </div>

      {/* ── MODAL PENGADUAN ── */}
      {reportOpen && (
        <div className="modal-scrim" onClick={()=>!reportBusy && setReportOpen(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Laporkan masalah">
            <h2 style={{ fontSize:17, fontWeight:800, marginBottom:6, letterSpacing:'-0.01em' }}>
              Laporkan masalah
            </h2>
            <p style={{ fontSize:12.5, color:'#9E8880', lineHeight:1.55, marginBottom:20 }}>
              Kami kirim hasil fotomu ke email yang kamu tulis di bawah, dan petugas
              di lokasi langsung diberi tahu.
            </p>

            <div style={{ marginBottom:16 }}>
              <label className="field-label" htmlFor="pk-email">Email <span style={{ color:'#C02018' }}>*</span></label>
              <input
                id="pk-email" className="field" type="email" inputMode="email"
                autoComplete="email" placeholder="nama@email.com"
                value={form.email}
                onChange={e=>setForm(f=>({ ...f, email:e.target.value }))}
              />
            </div>

            <div style={{ marginBottom:16 }}>
              <label className="field-label" htmlFor="pk-wa">WhatsApp <span style={{ fontWeight:500, textTransform:'none', letterSpacing:0 }}>(opsional)</span></label>
              <input
                id="pk-wa" className="field" type="tel" inputMode="tel"
                autoComplete="tel" placeholder="08xxxxxxxxxx"
                value={form.whatsapp}
                onChange={e=>setForm(f=>({ ...f, whatsapp:e.target.value }))}
              />
            </div>

            <div style={{ marginBottom:20 }}>
              <span className="field-label">Masalahnya apa?</span>
              <div style={{ display:'flex', flexWrap:'wrap', gap:8 }}>
                {REASONS.map(r => (
                  <button
                    key={r.key} type="button"
                    className={`chip ${form.reason === r.key ? 'active' : ''}`}
                    onClick={()=>setForm(f=>({ ...f, reason:r.key }))}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {reportError && (
              <div style={{ display:'flex', gap:9, alignItems:'flex-start', marginBottom:16, padding:'11px 13px', borderRadius:11, background:'rgba(192,32,24,0.06)', border:'1px solid rgba(192,32,24,0.18)' }}>
                <AlertCircle size={15} color="#C02018" style={{ flexShrink:0, marginTop:1 }}/>
                <p style={{ fontSize:12.5, color:'#C02018', lineHeight:1.5 }}>{reportError}</p>
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button
                className="btn btn-ghost" style={{ flex:1 }}
                disabled={reportBusy}
                onClick={()=>setReportOpen(false)}>
                Batal
              </button>
              <button
                className="btn btn-primary" style={{ flex:2 }}
                disabled={reportBusy}
                onClick={submitReport}>
                {reportBusy
                  ? <><Loader2 size={15} style={{ animation:'spin .8s linear infinite' }}/>Mengirim…</>
                  : 'Kirim laporan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── LIGHTBOX ── */}
      {lightbox && (
        <div className="lb" onClick={()=>setLightbox(null)}
          style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(21,12,9,.94)', backdropFilter:'blur(10px)', display:'flex', alignItems:'center', justifyContent:'center', padding:20, cursor:'zoom-out' }}>
          <img src={lightbox} alt="Pratinjau"
            style={{ maxWidth:'92vw', maxHeight:'88dvh', objectFit:'contain', borderRadius:12 }}
            onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setLightbox(null)} aria-label="Tutup"
            style={{ position:'fixed', top:'max(16px, env(safe-area-inset-top))', right:16, width:40, height:40, borderRadius:'50%', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(255,255,255,0.14)', border:'1px solid rgba(255,255,255,0.28)', color:'#fff', fontSize:17 }}>
            ✕
          </button>
        </div>
      )}
    </>
  )
}
