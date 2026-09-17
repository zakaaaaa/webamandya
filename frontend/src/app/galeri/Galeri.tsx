'use client'

/*
 * Galeri.tsx — halaman /galeri: hasil asli dari booth, dibagi tiga tab
 * (strip, GIF, video). Daftar sesinya statis di data.ts.
 *
 * Strip PNG di R2 berukuran 2-12 MB, jadi thumbnail dan lightbox strip lewat
 * next/image (dioptimasi Vercel dari URL CDN) — berkas aslinya tetap bisa
 * dibuka dari tautan "Berkas asli". GIF (±0,3 MB) disajikan apa adanya karena
 * pengoptimal akan membekukan animasinya. Video tidak dimuat sama sekali
 * sampai lightbox dibuka; di grid posternya memakai strip sesi yang sama,
 * yang rasionya identik dengan videonya.
 */

import Image, { getImageProps } from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { LANDING_CSS } from '../landing.css'
import { GALERI_CSS } from './galeri.css'
import { SESI, UKURAN, GIF, strip, gif, video, type SesiGaleri } from './data'

const WA = '6289508279690'

type Jenis = 'strip' | 'gif' | 'video'

const TAB: [Jenis, string][] = [
  ['strip', 'Strip foto'],
  ['gif', 'GIF'],
  ['video', 'Live photo'],
]

/* Tab disimpan di hash (#gif, #video) supaya tautan bisa langsung ke tab tertentu. */
const bacaTab = (): Jenis => {
  const h = window.location.hash.slice(1)
  return h === 'gif' || h === 'video' ? h : 'strip'
}
const langganHash = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}
const gantiTab = (t: Jenis) => {
  history.replaceState(null, '', t === 'strip' ? window.location.pathname : `#${t}`)
  window.dispatchEvent(new HashChangeEvent('hashchange'))
}

/* Lebar tetap 400 tanpa `sizes`: src yang dihasilkan versi 2x (±828 px), cukup
   untuk poster di lightbox. Dengan `sizes`, src jatuh ke versi terbesar 3840. */
const posterVideo = (s: SesiGaleri) => {
  const { width, height } = UKURAN[s.frame]
  return getImageProps({ src: strip(s), alt: '', width: 400, height: Math.round(400 * height / width) }).props.src
}

export default function Galeri() {
  const tab = useSyncExternalStore(langganHash, bacaTab, () => 'strip' as Jenis)
  const [buka, setBuka] = useState<{ jenis: Jenis; i: number } | null>(null)
  const dlg = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const d = dlg.current
    if (!d) return
    if (buka && !d.open) d.showModal()
    if (!buka && d.open) d.close()
  }, [buka])

  const geser = (arah: number) =>
    setBuka(b => {
      if (!b) return b
      const i = b.i + arah
      return i < 0 || i >= SESI.length ? b : { ...b, i }
    })

  const aktif = buka ? SESI[buka.i] : null
  const asli = aktif && buka
    ? buka.jenis === 'strip' ? strip(aktif) : buka.jenis === 'gif' ? gif(aktif) : video(aktif)
    : ''

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: LANDING_CSS + GALERI_CSS }} />

      <div className="amb" aria-hidden="true"><i /><i /><i /><u /></div>

      <header className="statusbar">
        <div className="wrap">
          <Link className="brand" href="/" aria-label="Pabrik Kenangan, ke beranda">
            <span className="logo" role="img" aria-label="Pabrik Kenangan" />
          </Link>
          <nav className="navlinks">
            <Link href="/#paket">Paket</Link>
            <Link href="/#galeri">Hasil</Link>
            <Link href="/#mesin">Unit</Link>
            <Link href="/#tanya">Tanya jawab</Link>
          </nav>
          <Link className="btn btn-primary btn-sm" href="/#booking">Cek tanggal</Link>
        </div>
      </header>

      <main>
        <div className="gal-head">
          <div className="wrap">
            <Link className="back" href="/#galeri">&larr; Kembali ke halaman utama</Link>
            <h1>Galeri hasil booth</h1>
            <p className="lede">
              Strip foto, GIF, dan live photo dari tamu booth Pabrik Kenangan, persis seperti yang mereka bawa pulang. Tanpa sunting dan tanpa pilih-pilih.
            </p>
            <p className="meta">{SESI.length} sesi &middot; Bandar Lampung</p>
          </div>
        </div>

        <div className="tabs">
          <div className="wrap">
            <div className="tablist" role="tablist" aria-label="Jenis hasil">
              {TAB.map(([t, label]) => (
                <button key={t} type="button" role="tab" className="tab" id={`tab-${t}`}
                        aria-selected={tab === t} aria-controls={`panel-${t}`}
                        onClick={() => gantiTab(t)}>
                  {label} <span className="n">{SESI.length}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="gal-body">
          <div className="wrap" role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
            <div className={`grid ${tab}`}>
              {SESI.map((s, i) => (
                <button key={s.path} type="button" className="kartu"
                        aria-label={`${TAB.find(x => x[0] === tab)![1]} ${i + 1} dari ${SESI.length}`}
                        onClick={() => setBuka({ jenis: tab, i })}>
                  <span className="bingkai">
                    {tab === 'gif' ? (
                      // eslint-disable-next-line @next/next/no-img-element -- GIF animasi, next/image akan membekukannya
                      <img src={gif(s)} {...GIF} loading="lazy" decoding="async" alt="" />
                    ) : (
                      <Image src={strip(s)} {...UKURAN[s.frame]} alt=""
                             sizes="(max-width:760px) 50vw, 240px" />
                    )}
                    {tab === 'video' && <span className="putar" aria-hidden="true"><i /></span>}
                  </span>
                </button>
              ))}
            </div>

            <div className="ajak">
              <div>
                <h2>Mau hasil seperti ini di acaramu?</h2>
                <p className="lede">Frame dibuat khusus untuk acaramu, dicetak langsung di lokasi, dan GIF serta live photo-nya diambil tamu lewat QR.</p>
              </div>
              <div className="act">
                <Link className="btn btn-primary" href="/#booking">Cek tanggal</Link>
                <Link className="btn btn-ghost" href="/#paket">Lihat paket</Link>
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer>
        <div className="wrap sitefoot">
          <div className="col">
            <Link className="brand" href="/" style={{ marginBottom: 10 }} aria-label="Pabrik Kenangan, ke beranda">
              <span className="logo" style={{ width: 116, height: 66 }} role="img" aria-label="Pabrik Kenangan" />
            </Link>
            <Link href="/#paket">Paket sewa</Link>
            <Link href="/#galeri">Hasil cetakan</Link>
            <Link href="/#mesin">Spesifikasi unit</Link>
          </div>
          <div className="col">
            <b>Hubungi</b>
            <a href={`https://wa.me/${WA}`}>WhatsApp 0895-0827-9690</a>
            <a href="https://instagram.com/pabrikenangan">@pabrikenangan</a>
            <a href="mailto:main@pabrikenangan.my.id">main@pabrikenangan.my.id</a>
          </div>
          <div className="end">
            <span>PABRIK KENANGAN &copy; 2026</span>
            <span>BANDAR LAMPUNG</span>
          </div>
        </div>
      </footer>

      <dialog ref={dlg} className="lb" aria-label="Pratinjau hasil"
              onClose={() => setBuka(null)}
              onClick={e => { if (e.target === e.currentTarget) setBuka(null) }}
              onKeyDown={e => {
                if (e.key === 'ArrowRight') geser(1)
                if (e.key === 'ArrowLeft') geser(-1)
              }}>
        {buka && aktif && (
          <>
            <div className="lb-bar">
              <button type="button" className="lb-btn" onClick={() => setBuka(null)} aria-label="Tutup">&times;</button>
              <span className="posisi">{buka.i + 1} / {SESI.length}</span>
              <a href={asli} target="_blank" rel="noopener">Berkas asli</a>
            </div>
            <div className="lb-stage" onClick={e => { if (e.target === e.currentTarget) setBuka(null) }}>
              <button type="button" className="lb-btn kiri" onClick={() => geser(-1)}
                      disabled={buka.i === 0} aria-label="Sebelumnya">&lsaquo;</button>
              <div className="lb-media">
                {buka.jenis === 'strip' && (
                  <div className="wadah">
                    <Image key={aktif.path} src={strip(aktif)} alt={`Strip foto ${buka.i + 1} dari ${SESI.length}`}
                           fill sizes="(max-width:760px) 100vw, 70vh" style={{ objectFit: 'contain' }} />
                  </div>
                )}
                {buka.jenis === 'gif' && (
                  // eslint-disable-next-line @next/next/no-img-element -- GIF animasi, next/image akan membekukannya
                  <img key={aktif.path} className="lepas" src={gif(aktif)} {...GIF}
                       alt={`GIF ${buka.i + 1} dari ${SESI.length}`} />
                )}
                {buka.jenis === 'video' && (
                  <>
                    <video key={aktif.path} className="lepas" src={video(aktif)} poster={posterVideo(aktif)}
                           controls autoPlay playsInline preload="metadata" />
                    {aktif.frame === 'a4' && (
                      <p className="lb-note">
                        Live photo frame A4 beresolusi 4960&times;7016 dan berukuran puluhan MB, jadi sebagian HP tidak sanggup memutarnya. Kalau layar tetap hitam, buka lewat &ldquo;Berkas asli&rdquo;.
                      </p>
                    )}
                  </>
                )}
              </div>
              <button type="button" className="lb-btn kanan" onClick={() => geser(1)}
                      disabled={buka.i === SESI.length - 1} aria-label="Berikutnya">&rsaquo;</button>
            </div>
          </>
        )}
      </dialog>
    </>
  )
}
