'use client'

/*
 * Landing.tsx — halaman sewa photobooth (root "/").
 *
 * MASIH PLACEHOLDER: harga paket di bawah masih angka karangan, ganti
 * sebelum dipromosikan. WhatsApp, Instagram, dan email sudah data asli.
 * Foto contoh masih siluet SVG, lihat photo-placeholder.ts.
 *
 * Dashboard tetap di /dashboard dan /login sampai subdomain
 * app.pabrikenangan.my.id disiapkan.
 */

import { useEffect, useMemo, useRef, useState } from 'react'
import { LANDING_CSS } from './landing.css'
import { photoSVG } from './photo-placeholder'
import { mountUnits, HERO_TUNE, SPEC_TUNE } from './unit3d'

const WA = '6289508279690'

type Paket = { nm: string; kode: string; harga: number; populer?: boolean; spec: [string, string][] }

const PAKET: Paket[] = [
  {
    nm: 'Kilat', kode: 'PK-02H', harga: 1800000,
    spec: [
      ['Durasi', '2 jam'], ['Cetak', 'Tanpa batas'], ['Operator', '1 orang'],
      ['Frame', '1 desain kustom'], ['Properti', 'Set dasar'], ['Digital', 'QR + galeri'],
    ],
  },
  {
    nm: 'Pesta', kode: 'PK-04H', harga: 2900000, populer: true,
    spec: [
      ['Durasi', '4 jam'], ['Cetak', 'Tanpa batas'], ['Operator', '2 orang'],
      ['Frame', '2 desain kustom'], ['Properti', 'Set lengkap'], ['Digital', 'QR + galeri + GIF'],
    ],
  },
  {
    nm: 'Produksi Penuh', kode: 'PK-08H', harga: 4500000,
    spec: [
      ['Durasi', '8 jam'], ['Cetak', 'Tanpa batas'], ['Operator', '2 + koordinator'],
      ['Frame', 'Tanpa batas'], ['Properti', 'Kustom tema'], ['Digital', 'QR + galeri + GIF'],
    ],
  },
]

/* Tiga contoh saja: cukup menunjukkan tiga gaya frame yang berbeda. */
const STRIP = [
  { label: 'Resepsi', frame: 'klasik', seed: 2 },
  { label: 'Sweet 17', frame: 'pita', seed: 0 },
  { label: 'Gathering', frame: 'malam', seed: 3 },
]

const SPEK: [string, string][] = [
  ['Kamera', 'Canon DSLR 18 MP'],
  ['Cetak', '4R 10x15 cm, ± 12 detik per lembar'],
  ['Kertas', 'Foto glossy 260 gsm'],
  ['Layar', 'Sentuh 15,6" menghadap tamu'],
  ['Area', '2 x 2 meter, satu stopkontak'],
  ['Jangkauan', 'Bandar Lampung dan sekitarnya'],
]

const TANYA: [string, string][] = [
  ['Cetaknya benar-benar tanpa batas?',
   'Benar. Selama jam sewa masih jalan, tamu boleh foto berkali-kali dan tiap sesi dicetak. Kertas dan tinta sudah kami tanggung, tidak ada tagihan tambahan di akhir acara.'],
  ['Berapa DP-nya dan kapan dilunasi?',
   'DP 30% untuk mengunci tanggal, sisanya dilunasi paling lambat di hari acara sebelum booth dipasang. Pembatalan lebih dari 14 hari sebelum acara, DP dikembalikan penuh.'],
  ['Frame-nya bisa dibuat khusus acara kami?',
   'Bisa, dan sudah termasuk harga. Kirim nama, tanggal, dan logo (kalau ada) maksimal H-3. Kami kirim pratinjau untuk disetujui dulu sebelum dipasang ke booth.'],
  ['Kalau lokasinya di luar Bandar Lampung?',
   'Tetap kami layani. Di luar Bandar Lampung ada ongkos transportasi dan akomodasi kru yang dihitung sesuai jarak. Angkanya kami sebutkan di penawaran, tidak muncul mendadak.'],
  ['Bagaimana kalau listrik gedung mati?',
   'Booth kami bawa UPS untuk menyelamatkan sesi yang sedang berjalan dan mematikan printer dengan aman. Foto yang sudah terambil tidak hilang karena tersimpan ke galeri online, jadi tamu tetap bisa mengunduhnya.'],
  ['Foto tamu kami disimpan di mana?',
   'Di galeri sesi yang hanya bisa dibuka lewat tautan QR masing-masing sesi, aktif 30 hari lalu dihapus. Kami tidak memakai foto tamu untuk promosi tanpa izin tertulis dari penyelenggara.'],
]

const rupiah = (n: number) => 'Rp ' + n.toLocaleString('id-ID')

export default function Landing() {
  const [pilih, setPilih] = useState(1)
  const [tgl, setTgl] = useState('')
  const [jenis, setJenis] = useState('Pernikahan')
  const [kota, setKota] = useState('')

  const heroHost = useRef<HTMLDivElement>(null)
  const heroCv = useRef<HTMLCanvasElement>(null)
  const heroHint = useRef<HTMLSpanElement>(null)
  const specHost = useRef<HTMLDivElement>(null)
  const specCv = useRef<HTMLCanvasElement>(null)
  const specHint = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const t = []
    if (heroHost.current && heroCv.current)
      t.push({ host: heroHost.current, canvas: heroCv.current, hint: heroHint.current, tune: HERO_TUNE })
    if (specHost.current && specCv.current)
      t.push({ host: specHost.current, canvas: specCv.current, hint: specHint.current, tune: SPEC_TUNE })
    return mountUnits(t)
  }, [])

  const strips = useMemo(
    () => STRIP.map(s => ({ ...s, cells: [0, 1, 2, 3].map(i => photoSVG(s.seed + i)) })),
    [],
  )

  const terpilih = PAKET[pilih]

  const kirimWA = (e: React.FormEvent) => {
    e.preventDefault()
    const tglTxt = tgl
      ? new Date(tgl + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
      : '(belum diisi)'
    const pesan =
      'Halo Pabrik Kenangan, saya mau cek ketersediaan booth.\n\n' +
      `Tanggal acara: ${tglTxt}\n` +
      `Jenis acara: ${jenis}\n` +
      `Lokasi: ${kota}\n` +
      `Paket yang dilirik: ${terpilih.nm} (${rupiah(terpilih.harga)})`
    window.open(`https://wa.me/${WA}?text=${encodeURIComponent(pesan)}`, '_blank', 'noopener')
  }

  const kunciPaket = (i: number) => setPilih(i)
  const panahPaket = (e: React.KeyboardEvent, i: number) => {
    if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); kunciPaket(i); return }
    const d = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1
      : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0
    if (!d) return
    e.preventDefault()
    const next = (i + d + PAKET.length) % PAKET.length
    kunciPaket(next)
    const el = document.querySelectorAll<HTMLElement>('.paket')[next]
    el?.focus()
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS }} />

      <div className="amb" aria-hidden="true"><i /><i /><i /><u /></div>

      <header className="statusbar">
        <div className="wrap">
          <a className="brand" href="#atas" aria-label="Pabrik Kenangan, ke atas">
            <span className="logo" role="img" aria-label="Pabrik Kenangan" />
          </a>
          <nav className="navlinks">
            <a href="#paket">Paket</a>
            <a href="#galeri">Hasil</a>
            <a href="#mesin">Unit</a>
            <a href="#tanya">Tanya jawab</a>
          </nav>
          <a className="btn btn-primary btn-sm" href="#booking">Cek tanggal</a>
        </div>
      </header>

      <main id="atas">

        <section className="hero">
          <div className="wrap">
            <div className="hero-copy">
              <h1>Rayakan momenmu, <em>kenangannya</em><span>kami yang cetak.</span></h1>
              <div className="hero-acts">
                <a className="btn btn-primary" href="#booking">Cek tanggal acaramu</a>
                <a className="btn btn-ghost" href="#galeri">Lihat hasilnya</a>
              </div>
            </div>
          </div>

          <div className="hero-unit" ref={heroHost}>
            <canvas ref={heroCv} role="img" aria-label="Model 3D unit photobooth Pabrik Kenangan, bisa diputar dengan menyeret" />
            <span className="hint" ref={heroHint}>SERET UNTUK MEMUTAR</span>
          </div>
        </section>

        <section className="sec" id="paket">
          <div className="wrap">
            <div className="sec-head">
              <h2>Paket sewa</h2>
              <p className="lede">Semua paket sudah termasuk operator, kertas, properti, dan galeri online. Cetak tidak dihitung per lembar.</p>
            </div>

            <div className="pakets" role="radiogroup" aria-label="Pilih paket sewa">
              {PAKET.map((p, i) => (
                <div key={p.kode} className="paket" role="radio" tabIndex={0}
                     aria-checked={pilih === i}
                     onClick={() => kunciPaket(i)}
                     onKeyDown={e => panahPaket(e, i)}>
                  {p.populer && <span className="badge-pop">PALING SERING DIAMBIL</span>}
                  <div className="top">
                    <div>
                      <h3 className="nm">{p.nm}</h3>
                      <span className="kode">{p.kode}</span>
                    </div>
                    <span className="mark" aria-hidden="true" />
                  </div>
                  <p className="harga num">{rupiah(p.harga)}<small>/ acara</small></p>
                  <dl className="spec">
                    {p.spec.map(([k, v]) => (
                      <div key={k}><dt>{k}</dt><dd>{v}</dd></div>
                    ))}
                  </dl>
                </div>
              ))}
            </div>

            <div className="paket-cta">
              <a className="btn btn-primary" href="#booking">Kunci tanggal untuk paket {terpilih.nm}</a>
            </div>
          </div>
        </section>

        <section className="sec" id="galeri">
          <div className="wrap">
            <div className="sec-head">
              <h2>Yang tamu bawa pulang</h2>
              <p className="lede">Sekali sesi menghasilkan tiga berkas. Cetakannya langsung dipegang di tempat, dua sisanya diambil lewat QR di layar booth.</p>
            </div>

            <div className="outputs">
              <div className="out out-main">
                <h3>Foto</h3>
                <p>Strip empat frame di kertas glossy 260 gsm ukuran 4R, dicetak di lokasi. Versi digitalnya juga bisa diunduh satuan, tanpa frame.</p>
                <div className="gal">
                  {strips.map(s => (
                    <div key={s.label} className="strip" data-frame={s.frame}
                         role="img" aria-label={`Contoh strip foto acara ${s.label}`}>
                      <div className="cells">
                        {s.cells.map((svg, i) => (
                          <div key={i} className="cell" dangerouslySetInnerHTML={{ __html: svg }} />
                        ))}
                      </div>
                      <div className="foot"><b>{s.label}</b><span>4R &middot; 260gsm</span></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="out-side">
                <div className="out">
                  <h3>GIF animasi</h3>
                  <p>Keempat jepretan disusun jadi animasi berulang. Ukurannya ringan, enak dikirim di grup atau dipasang di status.</p>
                </div>
                <div className="out">
                  <h3>Live photo</h3>
                  <p>Video pendek dari detik sebelum dan sesudah jepretan, lengkap dengan gerak dan tawa yang tidak tertangkap di foto diam.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="mesin">
          <div className="wrap">
            <div className="sec-head">
              <h2>Unit yang datang ke lokasimu</h2>
              <p className="lede">Seret modelnya untuk melihat dari sisi lain.</p>
            </div>

            <div className="sheet">
              <div className="side">
                <dl className="dl">
                  {SPEK.map(([k, v]) => (
                    <div className="row" key={k}><dt>{k}</dt><dd>{v}</dd></div>
                  ))}
                </dl>
              </div>
              <div className="side viewer">
                <div className="spec-unit" ref={specHost}>
                  <canvas ref={specCv} role="img" aria-label="Model 3D unit photobooth, bisa diputar dengan menyeret" />
                  <span className="hint" ref={specHint}>SERET UNTUK MEMUTAR</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="sec" id="tanya">
          <div className="wrap">
            <div className="sec-head"><h2>Yang sering ditanyakan</h2></div>
            <div className="faq">
              {TANYA.map(([q, a], i) => (
                <details key={q} open={i === 0}>
                  <summary>
                    <span className="q">{String(i + 1).padStart(2, '0')}</span>{q}
                    <span className="pm" aria-hidden="true" />
                  </summary>
                  <p className="ans">{a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="sec" id="booking">
          <div className="wrap">
            <div className="book">
              <div className="sec-head" style={{ marginBottom: 0 }}>
                <h2>Cek ketersediaan tanggal</h2>
                <p className="lede">Akhir pekan di musim nikah biasanya penuh 2-3 bulan sebelumnya. Isi tiga kolom ini, tombolnya akan membuka WhatsApp dengan pesan yang sudah tertulis.</p>
              </div>

              <form className="form" onSubmit={kirimWA}>
                <div className="field">
                  <label htmlFor="tgl">Tanggal acara</label>
                  <input type="date" id="tgl" required value={tgl} onChange={e => setTgl(e.target.value)} />
                </div>
                <div className="field">
                  <label htmlFor="jenis">Jenis acara</label>
                  <select id="jenis" value={jenis} onChange={e => setJenis(e.target.value)}>
                    <option>Pernikahan</option>
                    <option>Ulang tahun</option>
                    <option>Acara kantor</option>
                    <option>Acara sekolah / kampus</option>
                    <option>Lainnya</option>
                  </select>
                </div>
                <div className="field">
                  <label htmlFor="kota">Kota / lokasi gedung</label>
                  <input type="text" id="kota" placeholder="Bandar Lampung" required
                         value={kota} onChange={e => setKota(e.target.value)} />
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: 4 }}>Kirim lewat WhatsApp</button>
                <p className="note">Dibalas jam 08.00-21.00 WIB. Tanpa DP dulu, cek ketersediaan gratis.</p>
              </form>
            </div>
          </div>
        </section>

        <section className="sec" id="software" style={{ paddingTop: 0 }}>
          <div className="wrap">
            <div className="soft">
              <div>
                <h2>Ingin punya software photobooth seperti Pabrik Kenangan?</h2>
                <p>Aplikasi booth, dasbor pemantauan, lisensi per perangkat, sampai galeri QR-nya kami bangun sendiri, dan sekarang bisa dipakai di booth milikmu.</p>
                <div className="pts">
                  <div>Aplikasi booth Windows</div>
                  <div>Dasbor transaksi realtime</div>
                  <div>Lisensi terkunci perangkat</div>
                  <div>Editor frame &amp; voucher</div>
                </div>
              </div>
              <div className="act">
                <a className="btn btn-primary" target="_blank" rel="noopener"
                   href={`https://wa.me/${WA}?text=${encodeURIComponent('Halo, saya mau tanya soal lisensi software photobooth Pabrik Kenangan.')}`}>
                  Tanya lisensi software
                </a>
                <a className="btn btn-screen" target="_blank" rel="noopener"
                   href={`https://wa.me/${WA}?text=${encodeURIComponent('Halo, saya mau minta demo software photobooth Pabrik Kenangan.')}`}>
                  Minta demo
                </a>
                <small>LEWAT WHATSAPP</small>
              </div>
            </div>
          </div>
        </section>

      </main>

      <footer>
        <div className="wrap sitefoot">
          <div className="col">
            <a className="brand" href="#atas" style={{ marginBottom: 10 }} aria-label="Pabrik Kenangan, ke atas">
              <span className="logo" style={{ width: 116, height: 66 }} role="img" aria-label="Pabrik Kenangan" />
            </a>
            <a href="#paket">Paket sewa</a>
            <a href="#galeri">Hasil cetakan</a>
            <a href="#mesin">Spesifikasi unit</a>
          </div>
          <div className="col">
            <b>Hubungi</b>
            <a href={`https://wa.me/${WA}`}>WhatsApp 0895-0827-9690</a>
            <a href="https://instagram.com/pabrikenangan">@pabrikenangan</a>
            <a href="mailto:main@pabrikenangan.my.id">main@pabrikenangan.my.id</a>
          </div>
          <div className="col">
            <b>Lain-lain</b>
            <a href="/login">Masuk dasbor</a>
            <a href="#tanya">Tanya jawab</a>
          </div>
          <div className="end">
            <span>PABRIK KENANGAN &copy; 2026</span>
            <span>BANDAR LAMPUNG</span>
          </div>
        </div>
      </footer>
    </>
  )
}
