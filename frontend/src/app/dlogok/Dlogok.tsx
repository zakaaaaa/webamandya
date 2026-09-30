'use client'

/*
 * Dlogok.tsx — isi halaman /dlogok. Gayanya sengaja menyalin layar idle kios
 * dan tent card di meja (merah brand, Bristol + League Spartan, stiker
 * bergerigi, label harga), supaya pengunjung yang memindai QR langsung
 * mengenali booth yang sama.
 *
 * Harga per jenis mengikuti ketentuan pemilik (1 Okt 2026). Semua paket
 * mendapat soft file, GIF, dan video:
 *   4R        Rp20.000 — 2 strip cetak
 *   Keychain  Rp30.000 — 1 gantungan kunci + 1 strip
 *   Newspaper Rp20.000 bookpaper / Rp30.000 glossy
 *
 * Strip bertanda "vintage" sudah diberi filter Vintage aplikasi kios pada
 * fotonya saja (frame tetap asli).
 */

import Link from 'next/link'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DLOGOK_CSS } from './dlogok.css'
import { SESI, video } from '../galeri/data'

export type SlotFrame = { x: number; y: number; w: number; h: number; putar: number; foto: number }
export type FrameKatalog = {
  id: string
  nama: string
  gambar: string
  kategori: string
  lebar: number
  tinggi: number
  slot: SlotFrame[]
}

const WA = '6289508279690'
const IG = 'pabrikenangan'

// Sesi contoh untuk kartu video: strip Pecel lele 15 Sep.
const CONTOH = SESI.find((s) => s.path.includes('255936e8')) ?? SESI[0]
// GIF contoh: sesi-1789739249094 (dipilih pemilik).
const GIF_CONTOH =
  'https://cdn.pabrikenangan.my.id/results/8b7e2163-239b-4267-8f8a-f088ee3541a5/7f77a30f-9a86-48c1-be21-501189cae84b/animation.gif'

const KATEGORI = ['4R', 'Keychain', 'Newspaper'] as const
const LABEL_KATEGORI: Record<string, string> = {
  '4R': 'Strip 4R',
  Keychain: 'Keychain',
  Newspaper: 'Newspaper',
}

// Warna kotak slot — sama dengan halaman pilih frame di kios.
const WARNA_SLOT = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#f472b6', '#84cc16', '#fb923c', '#38bdf8']

// Pita strip berjalan. #minat (vintage) sengaja muncul lebih sering.
const PITA = [
  ['pita-minat-1', 'pita-0', 'pita-1', 'pita-minat-2', 'pita-2', 'pita-3', 'pita-minat-3'],
  ['pita-5', 'pita-minat-2', 'pita-6', 'pita-7', 'pita-minat-1', 'pita-8', 'pita-9', 'pita-minat-3'],
]

const DIGITAL = ['Soft file', 'GIF', 'Video']

const LANGKAH = [
  { judul: 'Pilih frame', isi: 'Ada puluhan desain: strip, keychain, sampai koran.' },
  { judul: 'Pose!', isi: 'Hitung mundur 3-2-1, cekrek! Bisa lihat hasilnya langsung.' },
  { judul: 'Bayar', isi: 'Scan QRIS di layar, atau bayar tunai ke kasir lalu masukkan kodenya.' },
  { judul: 'Cetak & bawa pulang', isi: 'Foto langsung tercetak. Scan QR untuk soft file, GIF & video.' },
]

/* Muncul saat digulir ke layar. */
function useMuncul() {
  useEffect(() => {
    const el = document.querySelectorAll<HTMLElement>('.dl [data-muncul]')
    if (!('IntersectionObserver' in window)) {
      el.forEach((e) => e.classList.add('tampak'))
      return
    }
    const io = new IntersectionObserver(
      (xs) => xs.forEach((x) => x.isIntersecting && (x.target.classList.add('tampak'), io.unobserve(x.target))),
      { threshold: 0.18 },
    )
    el.forEach((e) => io.observe(e))
    return () => io.disconnect()
  }, [])
}

/* Video diputar lewat ref: React tidak merender atribut `muted`, dan iOS
 * menolak autoplay tanpanya. Dilewati kalau pengunjung minta gerak minimal. */
function VideoDiam({ src, poster, className }: { src: string; poster?: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null)
  useEffect(() => {
    const v = ref.current
    if (!v) return
    v.muted = true
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    const io = new IntersectionObserver(([x]) => {
      if (x.isIntersecting) v.play().catch(() => {})
      else v.pause()
    })
    io.observe(v)
    return () => io.disconnect()
  }, [])
  return (
    <video ref={ref} className={className} src={src} poster={poster}
      loop playsInline preload="metadata" aria-hidden="true" />
  )
}

function Stiker({ atas, tengah, className }: { atas: string; tengah: React.ReactNode; className?: string }) {
  return (
    <div className={`stiker ${className ?? ''}`} aria-hidden="true">
      <div className="stiker-isi">
        <span className="lab">{atas}</span>
        <span className="disp">{tengah}</span>
      </div>
    </div>
  )
}

function Harga({ rp, sub }: { rp: string; sub: string }) {
  return (
    <span className="harga">
      <span className="rp">Rp</span>
      <span className="angka">{rp}</span>
      <span className="k">
        <b>K</b>
        <i>{sub}</i>
      </span>
    </span>
  )
}

function Dapat({ isi }: { isi: string[] }) {
  return (
    <ul className="dapat">
      {isi.map((x) => <li key={x}>{x}</li>)}
      {DIGITAL.map((x) => <li key={x} className="digital">{x}</li>)}
    </ul>
  )
}

/* Frame di katalog: kotak slot berwarna di BELAKANG gambar frame, persis
 * seperti halaman pilih frame di kios, supaya lubang fotonya terbaca. */
function KartuFrame({ f }: { f: FrameKatalog }) {
  return (
    <figure className="frame">
      <div className="frame-kanvas" style={{ aspectRatio: `${f.lebar} / ${f.tinggi}` }}>
        {f.slot.map((s, i) => {
          const warna = WARNA_SLOT[s.foto % WARNA_SLOT.length]
          return (
            <span key={i} className="slot" style={{
              left: `${(s.x / f.lebar) * 100}%`, top: `${(s.y / f.tinggi) * 100}%`,
              width: `${(s.w / f.lebar) * 100}%`, height: `${(s.h / f.tinggi) * 100}%`,
              transform: s.putar ? `rotate(${s.putar}deg)` : undefined,
              background: `${warna}bf`, borderColor: warna,
            }}>
              <b>{i + 1}</b>
            </span>
          )
        })}
        <img src={f.gambar} alt={`Frame ${f.nama}`} loading="lazy" />
      </div>
    </figure>
  )
}

export default function Dlogok({ frames }: { frames: FrameKatalog[] }) {
  useMuncul()
  const [kat, setKat] = useState<(typeof KATEGORI)[number]>('4R')
  const [semua, setSemua] = useState(false)
  const perKat = useMemo(() => {
    const m: Record<string, FrameKatalog[]> = {}
    for (const f of frames) (m[f.kategori] ??= []).push(f)
    return m
  }, [frames])
  const isiKat = perKat[kat] ?? []
  const tampil = semua ? isiKat : isiKat.slice(0, 9)

  return (
    <div className="dl">
      <style dangerouslySetInnerHTML={{ __html: DLOGOK_CSS }} />

      {/* ───────── HERO ───────── */}
      <header className="hero">
        <div className="sinar" aria-hidden="true" />
        <div className="logo-duo">
          <img src="/dlogok/logo-pk.webp" alt="Pabrik Kenangan" className="logo-pk" />
          <span className="kali">×</span>
          <img src="/dlogok/logo-dlogok-putih.webp" alt="d'Logok" className="logo-dl" />
        </div>
        <h1 className="judul">
          <span className="baris b1">Kelar makan,</span>
          <span className="baris b2">foto dulu yuk!</span>
        </h1>

        <div className="kipas" aria-hidden="true">
          <img src="/dlogok/strip-minat.webp" alt="" className="kp kp1" />
          <img src="/dlogok/strip-pecel.webp" alt="" className="kp kp2" />
          <img src="/dlogok/strip-cheers-vintage.webp" alt="" className="kp kp3" />
          <Stiker className="st-promo" atas="PROMO" tengah={<>Tanggal<br />Muda</>} />
        </div>

        {/* clip-path memotong box-shadow, jadi bayangannya dipasang di pembungkus */}
        <div className="label-bungkus">
          <div className="label-harga">
            <span className="lab mulai">MULAI</span>
            <Harga rp="20" sub="/SESI" />
          </div>
        </div>

        <div className="aksi">
          <a href="#harga" className="tombol">Lihat paket</a>
          <a href="#cara" className="tombol garis">Cara foto</a>
        </div>
      </header>

      {/* ───────── SIMULASI ───────── */}
      <section className="blok sim" data-muncul>
        <div className="bidik">
          <VideoDiam src="/dlogok/booth.mp4" poster="/dlogok/booth.jpg" className="bidik-video" />
          <span className="sudut s1" /><span className="sudut s2" /><span className="sudut s3" /><span className="sudut s4" />
          <span className="rec lab"><i />REC</span>
          <span className="hitung disp" aria-hidden="true"><b>3</b><b>2</b><b>1</b></span>
          <span className="blitz" aria-hidden="true" />
        </div>
      </section>

      {/* ───────── HARGA ───────── */}
      <section className="blok" id="harga">
        <h2 className="sub-judul" data-muncul>Pilih paketmu</h2>

        <article className="paket" data-muncul>
          <Stiker className="st-kartu" atas="PROMO" tengah={<>Tanggal<br />Muda</>} />
          <div className="paket-gambar">
            <img src="/dlogok/strip-pecel.webp" alt="Contoh strip 4R frame Pecel lele" className="pg-strip m1" />
            <img src="/dlogok/strip-countfest.webp" alt="" className="pg-strip m2" />
          </div>
          <div className="paket-isi">
            <h3 className="disp">Strip 4R</h3>
            <Harga rp="20" sub="/SESI" />
            <Dapat isi={['2 strip cetak']} />
          </div>
        </article>

        <article className="paket" data-muncul>
          <div className="paket-gambar kunci-wrap">
            <div className="kunci">
              <span className="ring" /><span className="rantai" />
              <span className="plat"><span className="lubang" />
                <img src="/dlogok/key-takeiteasy.webp" alt="Contoh gantungan kunci frame Take it easy" /><span className="kilap" />
              </span>
            </div>
            <img src="/dlogok/strip-minat.webp" alt="" className="pg-strip m3" />
          </div>
          <div className="paket-isi">
            <h3 className="disp">Keychain</h3>
            <Harga rp="30" sub="/SESI" />
            <Dapat isi={['1 gantungan kunci', '1 strip cetak']} />
          </div>
        </article>

        <article className="paket koran" data-muncul>
          <div className="koran-atas">
            <img src="/dlogok/koran.webp" alt="Contoh newspaper Soeara CountFest" className="pg-koran" />
            <div className="paket-isi">
              <h3 className="disp">Newspaper</h3>
              <p className="catatan">Jadi headline koranmu sendiri, ukuran A4.</p>
            </div>
          </div>
          <div className="pilih-kertas">
            <div className="kertas">
              <span className="lab jenis">BOOKPAPER</span>
              <Harga rp="20" sub="/SESI" />
            </div>
            <div className="kertas">
              <span className="lab jenis">GLOSSY</span>
              <Harga rp="30" sub="/SESI" />
            </div>
          </div>
          <Dapat isi={['1 koran cetak']} />
        </article>
      </section>

      {/* ───────── HASIL ───────── */}
      <section className="blok hasil">
        <h2 className="sub-judul" data-muncul>Mereka udah eksis,<br />kamu kapan?</h2>
        <div className="pita" aria-label="Contoh strip hasil pengunjung">
          {PITA.map((baris, i) => (
            <div key={i} className={`pita-jalan ${i ? 'balik' : ''}`}>
              {[...baris, ...baris].map((n, j) => (
                <img key={j} src={`/dlogok/${n}.webp`} alt="" className="pita-strip" loading="lazy" />
              ))}
            </div>
          ))}
        </div>
        <div className="gerak" data-muncul>
          <figure className="gerak-gif">
            {/* GIF disajikan apa adanya: pengoptimal gambar membekukan animasinya. */}
            <img src={GIF_CONTOH} alt="Contoh GIF hasil booth" loading="lazy" />
            <figcaption className="lab">GIF</figcaption>
          </figure>
          <figure className="gerak-vid">
            <VideoDiam src={video(CONTOH)} className="gerak-video" />
            <figcaption className="lab">VIDEO</figcaption>
          </figure>
        </div>
        <Link href="/galeri" className="tombol garis tengah">Lihat galeri lengkap</Link>
      </section>

      {/* ───────── FRAME ───────── */}
      {frames.length > 0 && (
        <section className="blok" id="frame">
          <h2 className="sub-judul" data-muncul>Pilihan frame</h2>
          <div className="tab" role="tablist">
            {KATEGORI.filter((k) => perKat[k]?.length).map((k) => (
              <button key={k} role="tab" aria-selected={kat === k}
                className={kat === k ? 'aktif' : ''} onClick={() => { setKat(k); setSemua(false) }}>
                {LABEL_KATEGORI[k]} <small>{perKat[k].length}</small>
              </button>
            ))}
          </div>
          <div className="katalog">
            {tampil.map((f) => <KartuFrame key={f.id} f={f} />)}
          </div>
          {isiKat.length > tampil.length && (
            <button className="tombol garis tengah" onClick={() => setSemua(true)}>
              Lihat semua {isiKat.length} frame
            </button>
          )}
        </section>
      )}

      {/* ───────── CARA ───────── */}
      <section className="blok" id="cara">
        <h2 className="sub-judul" data-muncul>Cara foto</h2>
        <ol className="langkah">
          {LANGKAH.map((l, i) => (
            <li key={l.judul} data-muncul style={{ transitionDelay: `${i * 80}ms` }}>
              <span className="nomor disp">{i + 1}</span>
              <div>
                <h3 className="lab">{l.judul}</h3>
                <p>{l.isi}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ───────── PENUTUP ───────── */}
      <footer className="penutup">
        <p className="disp ajak">Giliran kamu!</p>
        <p className="keterangan">Tinggal datang ke booth, operator kami siap bantu.</p>
        <div className="aksi">
          <a className="tombol" href={`https://instagram.com/${IG}`} target="_blank" rel="noopener">Instagram @{IG}</a>
          <a className="tombol garis" href={`https://wa.me/${WA}`} target="_blank" rel="noopener">WhatsApp</a>
        </div>
        <div className="logo-duo kecil">
          <img src="/dlogok/logo-pk.webp" alt="Pabrik Kenangan" className="logo-pk" />
          <span className="kali">×</span>
          <img src="/dlogok/logo-dlogok-putih.webp" alt="d'Logok" className="logo-dl" />
        </div>
      </footer>
    </div>
  )
}
