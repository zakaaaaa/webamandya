'use client'

/*
 * Landing.tsx — halaman sewa photobooth (root "/"), redesign "satu tinta" 11 Okt 2026.
 *
 * Paket mengikuti Pricelist_Pabrik_Kenangan_Margin_30.xlsx (15 Sep 2026);
 * harga = kolom Harga Jual + 20%. Strip di hero dan contoh hasil adalah aset
 * asli di public/landing/ (dipotong dari sesi PK ASUS yang ada di /galeri).
 *
 * Section AI (ganti latar + gaya ilustrasi) sengaja hanya di landing page;
 * fiturnya belum ada di aplikasi booth. Contoh ganti latar memakai potongan
 * rembg asli yang digambar ulang di canvas; contoh gaya ilustrasi adalah
 * filter OpenCV dan diberi keterangan "contoh pratinjau".
 */

import { useEffect, useRef, useState } from 'react'
import { LANDING_CSS } from './landing.css'
import { mountUnits, SPEC_TUNE } from './unit3d'

const WA = '6289508279690'

type Kategori = 'waktu' | 'cetak'
type Paket = { kategori: Kategori; nm: string; skema: string; harga: number }

const KATEGORI: [Kategori, string, string][] = [
  ['waktu', 'Per jam sewa', ', cetak tanpa batas'],
  ['cetak', 'Per kuota cetak', ', dengan batas waktu standby'],
]

/* Urutan array = urutan tampil, dipakai navigasi panah antar baris. */
const PAKET: Paket[] = [
  { kategori: 'waktu', nm: 'Kenangan Kilat', skema: '2 jam sewa', harga: 780000 },
  { kategori: 'waktu', nm: 'Kenangan Manis', skema: '3 jam sewa', harga: 1020000 },
  { kategori: 'waktu', nm: 'Kenangan Abadi', skema: '4 jam sewa', harga: 1260000 },
  { kategori: 'cetak', nm: '50 Lembar Cerita', skema: 'Kuota 50 foto', harga: 660000 },
  { kategori: 'cetak', nm: '100 Lembar Cerita', skema: 'Kuota 100 foto', harga: 1140000 },
  { kategori: 'cetak', nm: '150 Lembar Cerita', skema: 'Kuota 150 foto', harga: 1560000 },
  { kategori: 'cetak', nm: '200 Lembar Cerita', skema: 'Kuota 200 foto', harga: 1980000 },
]

const STRIP: [string, string][] = [
  ['strip-9', 'Strip foto bertema Wanted'],
  ['strip-3', 'Strip foto Cheers Love'],
  ['strip-8', 'Strip foto Pecel Lele'],
  ['strip-2', 'Strip foto Take It Easy'],
  ['strip-13', 'Strip foto Attack on Titan'],
  ['strip-15', 'Strip foto OMG biru'],
  ['strip-5', 'Strip foto Generasi Bergizi'],
  ['strip-10', 'Strip foto Count Fest'],
  ['strip-14', 'Strip foto piknik kotak merah'],
]

const GAYA: [string, string, string][] = [
  ['ai-b-asli', 'Foto asli', 'Foto asli'],
  ['ai-b-kartun', 'Kartun', 'Foto yang sama dalam gaya kartun'],
  ['ai-b-sketsa', 'Sketsa pensil', 'Foto yang sama dalam gaya sketsa pensil'],
  ['ai-b-lukis', 'Lukisan', 'Foto yang sama dalam gaya lukisan'],
]

type Latar = 'sampul' | 'lampu' | 'studio'
const LATAR: [Latar, string][] = [['sampul', 'Sampul majalah'], ['lampu', 'Lampu pesta'], ['studio', 'Studio']]

const SPEK: [string, string][] = [
  ['Kamera', 'Canon DSLR 18 MP'],
  ['Cetak', '4R 10x15 cm, sekitar 12 detik per lembar'],
  ['Kertas', 'Foto glossy 260 gsm'],
  ['Layar', 'Layar sentuh 15,6" menghadap tamu'],
  ['Area', '2 x 2 meter dan satu stopkontak'],
  ['Jangkauan', 'Bandar Lampung dan sekitarnya'],
]

const TANYA: [string, string][] = [
  ['Cetaknya benar-benar tanpa batas?',
   'Untuk paket per jam, benar. Selama jam sewa masih jalan, tamu boleh foto berkali-kali dan tiap sesi dicetak. Paket per kuota memakai jatah 50 sampai 200 foto dengan batas waktu standby. Kertas dan tinta sudah kami tanggung.'],
  ['Berapa DP-nya dan kapan dilunasi?',
   'DP 30% untuk mengunci tanggal, sisanya dilunasi paling lambat di hari acara sebelum booth dipasang. Pembatalan lebih dari 14 hari sebelum acara, DP dikembalikan penuh.'],
  ['Frame-nya bisa dibuat khusus acara kami?',
   'Bisa, dan sudah termasuk harga. Kirim nama, tanggal, dan logo (kalau ada) paling lambat H-3. Kami kirim pratinjau untuk disetujui dulu sebelum dipasang ke booth.'],
  ['Kalau lokasinya di luar Bandar Lampung?',
   'Tetap kami layani. Di luar Bandar Lampung ada ongkos transportasi dan akomodasi kru yang dihitung sesuai jarak. Angkanya kami sebutkan di penawaran, tidak muncul mendadak.'],
  ['Bagaimana kalau listrik gedung mati?',
   'Booth kami bawa UPS untuk menyelamatkan sesi yang sedang berjalan dan mematikan printer dengan aman. Foto yang sudah terambil tersimpan di galeri online, jadi tamu tetap bisa mengunduhnya.'],
  ['Foto tamu kami disimpan di mana?',
   'Di galeri sesi yang hanya bisa dibuka lewat QR masing-masing sesi, aktif 30 hari lalu dihapus. Kami tidak memakai foto tamu untuk promosi tanpa izin tertulis dari penyelenggara.'],
]

const rupiah = (n: number) => 'Rp' + n.toLocaleString('id-ID')

/* Acak deterministik untuk posisi lampu, supaya gambarnya sama tiap kali digambar ulang. */
const acak = (n: number) => { const x = Math.sin(n * 91.7) * 43758.5453; return x - Math.floor(x) }

function gambarLatar(ctx: CanvasRenderingContext2D, mode: Latar, cut: HTMLImageElement | null, fDisplay: string, fBody: string) {
  const W = ctx.canvas.width, H = ctx.canvas.height
  ctx.clearRect(0, 0, W, H)
  if (mode === 'lampu') {
    const g = ctx.createLinearGradient(0, 0, 0, H)
    g.addColorStop(0, '#24152b'); g.addColorStop(1, '#4a1f27')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
    for (let i = 0; i < 48; i++) {
      const x = acak(i) * W, y = acak(i + 9) * H * 0.78, r = 16 + acak(i + 4) * 58
      const hu = [44, 30, 350, 16][i % 4]
      const rg = ctx.createRadialGradient(x, y, 0, x, y, r)
      rg.addColorStop(0, `hsla(${hu},95%,74%,.8)`); rg.addColorStop(0.7, `hsla(${hu},95%,64%,.22)`); rg.addColorStop(1, `hsla(${hu},95%,60%,0)`)
      ctx.fillStyle = rg; ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill()
    }
  } else if (mode === 'studio') {
    const g = ctx.createRadialGradient(W * 0.55, H * 0.32, 30, W * 0.5, H * 0.45, H * 0.85)
    g.addColorStop(0, '#f1ece6'); g.addColorStop(0.55, '#cfc4b9'); g.addColorStop(1, '#857a70')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H)
  } else {
    ctx.fillStyle = '#F7D9D4'; ctx.fillRect(0, 0, W, H)
    ctx.fillStyle = '#D42B22'; ctx.textBaseline = 'top'
    ctx.font = `240px ${fDisplay}`
    ctx.fillText('Kenangan', 14, 10, W - 28)
    ctx.fillStyle = '#1E1A19'; ctx.font = `700 24px ${fBody}`
    ctx.fillText('Edisi Oktober 2026', 24, 262)
  }
  if (cut?.complete && cut.naturalWidth) ctx.drawImage(cut, 0, 0, W, H)
  if (mode === 'sampul') {
    ctx.fillStyle = '#fff'; ctx.font = `700 36px ${fBody}`
    ctx.fillText('Malam paling', 28, H - 140)
    ctx.fillText('ramai tahun ini', 28, H - 96)
  }
}

export default function Landing() {
  const [pilih, setPilih] = useState(1)
  const [tgl, setTgl] = useState('')
  const [jenis, setJenis] = useState('pernikahan')
  const [kota, setKota] = useState('')
  const [aiLatar, setAiLatar] = useState(false)
  const [aiGaya, setAiGaya] = useState(false)
  const [err, setErr] = useState('')
  const [latar, setLatar] = useState<Latar>('sampul')
  const [pos, setPos] = useState(50)

  const rootRef = useRef<HTMLDivElement>(null)
  const tglRef = useRef<HTMLInputElement>(null)
  const kotaRef = useRef<HTMLInputElement>(null)
  const specHost = useRef<HTMLDivElement>(null)
  const specCv = useRef<HTMLCanvasElement>(null)
  const specHint = useRef<HTMLSpanElement>(null)
  const liveRef = useRef<HTMLVideoElement>(null)
  const bgCv = useRef<HTMLCanvasElement>(null)
  const cutRef = useRef<HTMLImageElement | null>(null)
  const [fontSiap, setFontSiap] = useState(0)

  useEffect(() => {
    if (!specHost.current || !specCv.current) return
    return mountUnits([{ host: specHost.current, canvas: specCv.current, hint: specHint.current, tune: SPEC_TUNE }])
  }, [])

  useEffect(() => {
    // muted lewat properti: React tidak merender atribut `muted`, dan iOS menolak autoplay tanpa itu.
    const v = liveRef.current
    if (!v) return
    v.muted = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause() })
    io.observe(v)
    return () => io.disconnect()
  }, [])

  /* Potongan tamu dan font dimuat sekali; latar digambar ulang tiap ganti pilihan. */
  useEffect(() => {
    const im = new Image()
    im.onload = () => setFontSiap(n => n + 1)
    im.src = '/landing/ai-cutout.webp'
    cutRef.current = im
    document.fonts?.ready.then(() => setFontSiap(n => n + 1))
  }, [])

  useEffect(() => {
    const cv = bgCv.current, root = rootRef.current
    if (!cv || !root) return
    const ctx = cv.getContext('2d')
    if (!ctx) return
    const cs = getComputedStyle(root)
    const fDisplay = cs.getPropertyValue('--font-bagel').trim() || '"Arial Black", sans-serif'
    const fBody = cs.getPropertyValue('--font-jakarta').trim() || 'sans-serif'
    gambarLatar(ctx, latar, cutRef.current, fDisplay, fBody)
  }, [latar, fontSiap])

  const terpilih = PAKET[pilih]

  const pesanWA = () => {
    const tglTxt = tgl
      ? new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '(belum diisi)'
    const ai = [aiLatar && 'Ganti latar', aiGaya && 'Gaya ilustrasi'].filter(Boolean)
    const pesan =
      'Halo Pabrik Kenangan, saya mau cek ketersediaan booth.\n\n' +
      `Tanggal acara: ${tglTxt}\n` +
      `Jenis acara: ${jenis}\n` +
      `Lokasi: ${kota.trim() || '(belum diisi)'}\n` +
      `Paket: ${terpilih.nm}, ${terpilih.skema} (${rupiah(terpilih.harga)})` +
      (ai.length ? `\nTambahan AI: ${ai.join(', ')}` : '')
    return `https://wa.me/${WA}?text=${encodeURIComponent(pesan)}`
  }

  const cekKirim = (e: React.MouseEvent) => {
    const kurang = [!tgl && 'tanggal acara', !kota.trim() && 'kota'].filter(Boolean)
    if (!kurang.length) return
    e.preventDefault()
    setErr(`Isi dulu ${kurang.join(' dan ')} supaya kami bisa cek jadwalnya.`)
    ;(tgl ? kotaRef : tglRef).current?.focus()
  }

  const panahPaket = (e: React.KeyboardEvent, i: number) => {
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = (i + d + PAKET.length) % PAKET.length
    setPilih(next)
    document.querySelectorAll<HTMLElement>('.prow')[next]?.focus()
  }

  return (
    <div className="pk-landing" ref={rootRef}>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <header className="nav">
        <div className="wrap">
          <a href="#atas" aria-label="Pabrik Kenangan, ke atas"><span className="logo" role="img" aria-label="Pabrik Kenangan" /></a>
          <nav aria-label="Utama">
            <a href="#hasil">Hasil</a>
            <a href="#ai">Fitur AI</a>
            <a href="#harga">Harga</a>
            <a href="#unit">Unit</a>
            <a href="#tanya">Tanya jawab</a>
          </nav>
          <a className="btn btn-red" href="#pesan">Cek tanggal</a>
        </div>
      </header>

      <main id="atas">
        <section className="hero">
          <div className="wrap hero-top">
            <h1>Rayakan momenmu, kenangannya kami yang cetak.</h1>
            <div className="hero-side">
              <p>Photobooth kamera DSLR dengan operator. Fotonya langsung dicetak di acara, sekitar 12 detik per lembar.</p>
              <div className="acts">
                <a className="btn btn-red" href="#pesan">Cek tanggal</a>
                <a className="btn btn-text" href="#hasil">Lihat hasilnya</a>
              </div>
            </div>
          </div>
          <div className="strips" aria-label="Strip foto asli dari booth kami">
            {STRIP.map(([f, alt], i) => (
              <a key={f} href="/galeri" style={{ '--i': i } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element -- aset statis berukuran tetap */}
                <img src={`/landing/${f}.webp`} width={400} height={1198} alt={alt} fetchPriority={i < 5 ? 'high' : 'auto'} />
              </a>
            ))}
          </div>
        </section>

        <section className="sec" id="hasil" style={{ paddingTop: 'clamp(24px,4vw,48px)' }}>
          <div className="wrap">
            <h2>Tamu pulang bawa tiga kenangan</h2>
            <p className="lede">Cetakannya dipegang langsung di acara. GIF dan live photo diunduh lewat QR di layar booth.</p>

            <div className="takeaway">
              <div className="take take-print">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- aset statis berukuran tetap */}
                  <img src="/landing/hasil-foto.webp" width={720} height={1080} loading="lazy" decoding="async"
                       alt="Cetakan 4R berisi dua strip kembar dengan frame acara Count Fest" />
                </figure>
                <div>
                  <h3>Foto cetak 4R</h3>
                  <p>Kertas glossy 260 gsm berisi dua strip kembar dengan frame acaramu, tinggal dipotong jadi dua. Versi digitalnya juga bisa diunduh satuan.</p>
                </div>
              </div>
              <div className="take take-gif">
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element -- GIF animasi, next/image akan membekukannya */}
                  <img src="/landing/hasil-gif.gif" width={480} height={320} loading="lazy" decoding="async" alt="GIF animasi dari jepretan satu sesi" />
                </figure>
                <h3>GIF animasi</h3>
                <p>Jepretan satu sesi disusun jadi animasi berulang. Ringan untuk dikirim ke grup atau dipasang di status.</p>
              </div>
              <div className="take take-live">
                <figure>
                  <video ref={liveRef} src="/landing/hasil-live.mp4" poster="/landing/hasil-live.jpg"
                         width={460} height={688} loop playsInline preload="metadata"
                         aria-label="Live photo: strip foto dengan frame acara yang bergerak" />
                </figure>
                <h3>Live photo</h3>
                <p>Video pendek dari detik sebelum dan sesudah jepretan, lengkap dengan frame acara.</p>
              </div>
            </div>
            <p className="gal-link"><a className="btn btn-text" href="/galeri">Lihat semua hasil di galeri</a></p>
          </div>
        </section>

        <section className="sec tight" id="ai">
          <div className="wrap">
            <div className="ai-top">
              <div className="compare" style={{ '--pos': pos + '%' } as React.CSSProperties}>
                {/* eslint-disable-next-line @next/next/no-img-element -- harus bertumpuk tepat dengan canvas */}
                <img src="/landing/ai-asli.webp" width={820} height={1025} loading="lazy" alt="Foto asli tamu di depan tirai merah gedung" />
                <canvas ref={bgCv} className="after" width={820} height={1025} role="img" aria-label="Foto yang sama dengan latar yang diganti AI" />
                <span className="bar" />
                <input type="range" min={0} max={100} value={pos} onChange={e => setPos(+e.target.value)}
                       aria-label="Geser untuk membandingkan foto asli dan hasil ganti latar" />
                <span className="knob" aria-hidden="true">&harr;</span>
              </div>
              <div className="ai-copy">
                <h2>Latar gedung kurang cantik? Biar AI yang ganti.</h2>
                <p className="body">AI memisahkan tamu dari latar di belakangnya, lalu menaruhnya di latar bertema acaramu. Tanpa green screen, tanpa tamu harus pindah tempat. Geser foto di samping untuk membandingkan.</p>
                <div className="bgs" role="group" aria-label="Coba latar lain">
                  {LATAR.map(([k, label]) => (
                    <button key={k} type="button" aria-pressed={latar === k} onClick={() => setLatar(k)}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            <div className="styles">
              <h2>Mau versi ilustrasinya juga bisa.</h2>
              <p className="lede">Satu jepretan dibuat ulang jadi gambar bergaya, dikirim sebagai bonus lewat QR. Tamu memilih gayanya sendiri di layar booth.</p>
              <div className="style-row">
                {GAYA.map(([f, cap, alt]) => (
                  <figure key={f}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- aset statis berukuran tetap */}
                    <img src={`/landing/${f}.webp`} width={730} height={520} loading="lazy" decoding="async" alt={alt} />
                    <figcaption>{cap}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="note">Gambar gaya di atas adalah contoh pratinjau. Kedua fitur AI bisa ditambahkan ke paket mana pun.</p>
            </div>
          </div>
        </section>

        <section className="sec tight" id="harga">
          <div className="wrap">
            <h2>Daftar harga</h2>
            <p className="lede">Sudah termasuk operator, kertas, properti, frame khusus acara, dan galeri online. Tidak ada tagihan tambahan di akhir acara.</p>
            <div className="prices" role="radiogroup" aria-label="Pilih paket">
              {KATEGORI.map(([k, label, ket]) => (
                <div key={k}>
                  <h3>{label}<span>{ket}</span></h3>
                  {PAKET.map((p, i) => p.kategori !== k ? null : (
                    <button key={p.nm} type="button" className="prow" role="radio"
                            aria-checked={pilih === i} tabIndex={pilih === i ? 0 : -1}
                            onClick={() => setPilih(i)} onKeyDown={e => panahPaket(e, i)}>
                      <span className="dot" aria-hidden="true" />
                      <span className="nm">{p.nm}<small>{p.skema}</small></span>
                      <span className="lead" aria-hidden="true" />
                      <span className="pr">{rupiah(p.harga)}</span>
                    </button>
                  ))}
                </div>
              ))}
            </div>

            <form className="madlib" id="pesan" noValidate onSubmit={e => e.preventDefault()}>
              <h2>Cek tanggalnya sekarang</h2>
              <p className="sentence">
                Halo Pabrik Kenangan, saya mau pakai paket <span className="pk">{terpilih.nm}</span>{' '}
                untuk acara{' '}
                <label className="vh" htmlFor="jenis">Jenis acara</label>
                <select id="jenis" value={jenis} onChange={e => setJenis(e.target.value)}>
                  <option>pernikahan</option>
                  <option>ulang tahun</option>
                  <option>kantor</option>
                  <option>sekolah / kampus</option>
                  <option>lainnya</option>
                </select>{' '}
                tanggal{' '}
                <label className="vh" htmlFor="tgl">Tanggal acara</label>
                <input type="date" id="tgl" ref={tglRef} required value={tgl}
                       onChange={e => { setTgl(e.target.value); setErr('') }} />{' '}
                di{' '}
                <label className="vh" htmlFor="kota">Kota atau lokasi gedung</label>
                <input type="text" id="kota" ref={kotaRef} placeholder="nama kota" required value={kota}
                       onChange={e => { setKota(e.target.value); setErr('') }} />.
              </p>
              <div className="addons" role="group" aria-label="Tambahan AI">
                <label><input type="checkbox" checked={aiLatar} onChange={e => setAiLatar(e.target.checked)} /> Tambah AI ganti latar</label>
                <label><input type="checkbox" checked={aiGaya} onChange={e => setAiGaya(e.target.checked)} /> Tambah AI gaya ilustrasi</label>
              </div>
              <p className="err" role="alert">{err}</p>
              <div className="send">
                <a className="btn btn-red" href={pesanWA()} target="_blank" rel="noopener" onClick={cekKirim}>Kirim lewat WhatsApp</a>
                <small>Dibalas jam 08.00-21.00 WIB. Cek tanggal gratis, belum perlu DP.</small>
              </div>
            </form>
          </div>
        </section>

        <section className="sec tight" id="unit">
          <div className="wrap">
            <h2>Unitnya datang ke lokasimu</h2>
            <div className="unit">
              <div className="stage">
                <div className="spec-unit" ref={specHost}>
                  <canvas ref={specCv} role="img" aria-label="Model 3D unit photobooth Pabrik Kenangan, bisa diputar dengan menyeret" />
                  <span className="hint" ref={specHint}>Seret untuk memutar</span>
                </div>
              </div>
              <dl className="specs">
                {SPEK.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
              </dl>
            </div>
          </div>
        </section>

        <section className="sec tight" id="tanya">
          <div className="wrap">
            <h2>Yang sering ditanyakan</h2>
            <div className="faq">
              {TANYA.map(([q, a]) => (
                <details key={q}>
                  <summary>{q}</summary>
                  <p>{a}</p>
                </details>
              ))}
            </div>
            <p className="faq-more">Pertanyaanmu belum ada? Tanya langsung di <a href={`https://wa.me/${WA}`} target="_blank" rel="noopener">WhatsApp 0895-0827-9690</a>.</p>
          </div>
        </section>

        <section className="soft" id="software">
          <div className="wrap">
            <div>
              <h2>Punya booth sendiri?</h2>
              <p>Aplikasi booth, dasbor transaksi, lisensi per perangkat, editor frame, sampai galeri QR-nya kami bangun sendiri. Sekarang bisa dipakai di booth milikmu.</p>
            </div>
            <div className="acts">
              <a className="btn btn-white" target="_blank" rel="noopener"
                 href={`https://wa.me/${WA}?text=${encodeURIComponent('Halo, saya mau tanya soal lisensi software photobooth Pabrik Kenangan.')}`}>
                Tanya lisensi software
              </a>
              <a className="btn btn-text" target="_blank" rel="noopener"
                 href={`https://wa.me/${WA}?text=${encodeURIComponent('Halo, saya mau minta demo software photobooth Pabrik Kenangan.')}`}>
                Minta demo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer className="pk-foot">
        <div className="wrap foot">
          <div className="col"><span className="logo" role="img" aria-label="Pabrik Kenangan" /></div>
          <div className="col">
            <b>Jelajahi</b>
            <a href="#hasil">Hasil cetakan</a>
            <a href="/galeri">Galeri</a>
            <a href="#harga">Daftar harga</a>
            <a href="#unit">Unit booth</a>
          </div>
          <div className="col">
            <b>Hubungi</b>
            <a href={`https://wa.me/${WA}`}>WhatsApp 0895-0827-9690</a>
            <a href="https://instagram.com/pabrikenangan">Instagram @pabrikenangan</a>
            <a href="mailto:main@pabrikenangan.my.id">main@pabrikenangan.my.id</a>
            {/* Langsung ke app supaya tidak singgah di pengalihan www -> app. */}
            <a href="https://app.pabrikenangan.my.id/login">Masuk dasbor</a>
          </div>
          <div className="end"><span>Pabrik Kenangan &copy; 2026</span><span>Bandar Lampung</span></div>
        </div>
      </footer>
    </div>
  )
}
