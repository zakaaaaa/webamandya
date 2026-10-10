'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import {
  JUMLAH_STAMP, LATAR_PAPAN, PAPAN_H, PAPAN_W, SLOT_STAMP, STIKER_PAPAN,
  gambarKecil, pasDiSlot,
} from '@/lib/stamp'
import { rakitPapan } from './papan'
import { STAMP_CSS } from './stamp.css'

type StampItem = { urutan: number; gambar: string | null; tanggal_sesi: string | null }
type Kartu = {
  id: string; kode: string; ig_username: string | null; diajukan_at: string | null
  voucher_kode: string | null; hadiah_at: string | null; stamps: StampItem[]
}
type Simpanan = { id: string; token: string }

const KUNCI = 'pk-stamp-kartu'

// localStorage bisa melempar (mode privat, data situs diblokir) — jangan
// sampai itu membuat halaman gagal tampil.
function bacaSimpanan(): Simpanan | null {
  try {
    const s = JSON.parse(localStorage.getItem(KUNCI) ?? 'null')
    return s && typeof s.id === 'string' && typeof s.token === 'string' ? s : null
  } catch { return null }
}
function tulisSimpanan(s: Simpanan | null) {
  try {
    if (s) localStorage.setItem(KUNCI, JSON.stringify(s))
    else localStorage.removeItem(KUNCI)
    return true
  } catch { return false }
}

async function panggil(body: Record<string, unknown>) {
  const res = await fetch('/api/stamp', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw Object.assign(new Error(data.error ?? 'Terjadi kesalahan, coba lagi.'), { status: res.status })
  return data
}

const u = (n: number) => `calc(var(--u) * ${n})`

/* ── Papan gabus (DOM). Posisi = SLOT_STAMP, sama dengan ekspor kanvas. ── */
function Papan({ kartu, baru }: { kartu: Kartu | null; baru: number | null }) {
  const [ukuran, setUkuran] = useState<Record<number, { w: number; h: number }>>({})
  const stamps = new Map((kartu?.stamps ?? []).map((s) => [s.urutan, s]))

  return (
    <div className="papan" style={{ aspectRatio: `${PAPAN_W} / ${PAPAN_H}` }}>
      <div className="papan-isi">
        <img className="latar" src={LATAR_PAPAN} alt="" />
        {SLOT_STAMP.map((slot, i) => {
          const s = stamps.get(i + 1)
          const dim = ukuran[i + 1]
          const pas = dim ? pasDiSlot(slot, dim.w, dim.h) : { x: slot.x, y: slot.y, w: slot.w, h: slot.h }
          const gaya = {
            left: u(slot.x), top: u(slot.y), width: u(slot.w), height: u(slot.h),
            transform: `rotate(${slot.rot}deg)`,
          }
          if (!s?.gambar) {
            return (
              <div key={i} className="slot" style={gaya}>
                <div className="kosong"><span>{i + 1}</span></div>
              </div>
            )
          }
          return (
            <div key={i} className={`slot${baru === i + 1 ? ' tempel' : ''}`} style={gaya}>
              <div
                className="strip"
                style={{
                  left: u(pas.x - slot.x), top: u(pas.y - slot.y), width: u(pas.w), height: u(pas.h),
                  opacity: dim ? 1 : 0,
                }}
              >
                <img
                  src={gambarKecil(s.gambar, 640)}
                  alt={`Kenangan ${i + 1}`}
                  onLoad={(e) => {
                    const img = e.currentTarget
                    setUkuran((u0) => ({ ...u0, [i + 1]: { w: img.naturalWidth, h: img.naturalHeight } }))
                  }}
                />
                <i className={`hiasan ${slot.hiasan}`} style={{ ['--warna' as string]: slot.warna }} />
              </div>
            </div>
          )
        })}
        {STIKER_PAPAN && <img className="latar stiker" src={STIKER_PAPAN} alt="" />}
      </div>
    </div>
  )
}

export default function Stamp() {
  const [simpanan, setSimpanan] = useState<Simpanan | null>(null)
  const [kartu, setKartu] = useState<Kartu | null>(null)
  const [siap, setSiap] = useState(false)
  const [tautan, setTautan] = useState('')
  const [ig, setIg] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [pesan, setPesan] = useState<{ jenis: 'ok' | 'gagal'; teks: string } | null>(null)
  const [baru, setBaru] = useState<number | null>(null)
  const [berkas, setBerkas] = useState<File | null>(null)
  const [tanpaSimpan, setTanpaSimpan] = useState(false)
  const [tersalin, setTersalin] = useState(false)
  const formRef = useRef<HTMLInputElement>(null)

  const jumlah = kartu?.stamps.length ?? 0
  const penuh = jumlah >= JUMLAH_STAMP

  const segarkan = useCallback(async (s: Simpanan) => {
    try {
      const { kartu } = await panggil({ aksi: 'lihat', ...s })
      setKartu(kartu)
    } catch (e) {
      // Kartu dihapus / token tidak cocok: mulai bersih, jangan terjebak.
      if ((e as { status?: number }).status === 404) { tulisSimpanan(null); setSimpanan(null); setKartu(null) }
    }
  }, [])

  useEffect(() => {
    const s = bacaSimpanan()
    setSimpanan(s)
    ;(s ? segarkan(s) : Promise.resolve()).finally(() => setSiap(true))
  }, [segarkan])

  // Menunggu voucher dari admin: cek lagi setiap halaman dibuka kembali.
  useEffect(() => {
    if (!simpanan || !kartu?.diajukan_at || kartu.voucher_kode) return
    const cek = () => { if (document.visibilityState === 'visible') segarkan(simpanan) }
    document.addEventListener('visibilitychange', cek)
    return () => document.removeEventListener('visibilitychange', cek)
  }, [simpanan, kartu?.diajukan_at, kartu?.voucher_kode, segarkan])

  // Gambar Story disiapkan SEBELUM tombol ditekan: iOS hanya mengizinkan
  // navigator.share dipanggil langsung di dalam ketukan, tanpa menunggu.
  const tandaGambar = kartu ? kartu.kode + kartu.stamps.map((s) => s.gambar).join('|') : ''
  useEffect(() => {
    if (!kartu || !jumlah) { setBerkas(null); return }
    let batal = false
    setBerkas(null)
    const gambar = SLOT_STAMP.map((_, i) => kartu.stamps.find((s) => s.urutan === i + 1)?.gambar ?? null)
    rakitPapan(gambar)
      .then((blob) => { if (!batal) setBerkas(new File([blob], `papan-kenangan-${kartu.kode}.png`, { type: 'image/png' })) })
      .catch(() => {})
    return () => { batal = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tandaGambar])

  async function tempel(e: React.FormEvent) {
    e.preventDefault()
    if (!tautan.trim() || sibuk) return
    setSibuk(true); setPesan(null)
    try {
      let s = simpanan
      if (!s) {
        const dibuat = await panggil({ aksi: 'buat' })
        s = { id: dibuat.kartu.id, token: dibuat.token }
        if (!tulisSimpanan(s)) setTanpaSimpan(true)
        setSimpanan(s)
        setKartu(dibuat.kartu)
      }
      const { kartu: k } = await panggil({ aksi: 'klaim', ...s, tautan })
      setKartu(k)
      setTautan('')
      setBaru(k.stamps.length)
      setTimeout(() => setBaru(null), 1400)
      setPesan({
        jenis: 'ok',
        teks: k.stamps.length >= JUMLAH_STAMP
          ? 'Papanmu penuh! Saatnya pamer 🎉'
          : `Kenangan ke-${k.stamps.length} nempel! Tinggal ${JUMLAH_STAMP - k.stamps.length} lagi menuju sesi gratis.`,
      })
    } catch (err) {
      setPesan({ jenis: 'gagal', teks: (err as Error).message })
    } finally {
      setSibuk(false)
    }
  }

  async function tempelDariClipboard() {
    try {
      const t = await navigator.clipboard.readText()
      if (t) setTautan(t.trim())
    } catch {
      formRef.current?.focus()
    }
  }

  async function simpanGambar() {
    if (!berkas) return
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (nav.canShare?.({ files: [berkas] })) {
      try { await nav.share({ files: [berkas] }); return } catch (e) {
        if ((e as Error).name === 'AbortError') return
      }
    }
    const url = URL.createObjectURL(berkas)
    const a = document.createElement('a')
    a.href = url; a.download = berkas.name
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 4000)
  }

  async function ajukan(e: React.FormEvent) {
    e.preventDefault()
    if (!simpanan || sibuk) return
    setSibuk(true); setPesan(null)
    try {
      const { kartu: k } = await panggil({ aksi: 'ajukan', ...simpanan, ig })
      setKartu(k)
    } catch (err) {
      setPesan({ jenis: 'gagal', teks: (err as Error).message })
    } finally {
      setSibuk(false)
    }
  }

  function kartuBaru() {
    if (!confirm('Mulai papan baru? Papan yang sekarang tidak bisa dibuka lagi dari HP ini.')) return
    tulisSimpanan(null); setSimpanan(null); setKartu(null); setPesan(null); setIg('')
  }

  async function salinVoucher() {
    if (!kartu?.voucher_kode) return
    try { await navigator.clipboard.writeText(kartu.voucher_kode); setTersalin(true); setTimeout(() => setTersalin(false), 1500) } catch {}
  }

  return (
    <main className="st">
      <style>{STAMP_CSS}</style>

      <header className="kepala">
        <img src="/logo-pk.webp" alt="Pabrik Kenangan" className="logo" />
        <p className="lab kecil">PAPAN KENANGAN</p>
        <h1 className="disp">Foto 5x,<br />yang ke-6<br />kami traktir!</h1>
        <p className="sub">Tiap sesi foto jadi satu kenangan yang nempel di papanmu. Penuhi 5 slot, pamerin di IG, sesi berikutnya gratis.</p>
      </header>

      <section className="hitung" aria-label={`${jumlah} dari ${JUMLAH_STAMP} kenangan`}>
        {Array.from({ length: JUMLAH_STAMP }, (_, i) => (
          <span key={i} className={i < jumlah ? 'isi' : ''}>{i < jumlah ? '★' : i + 1}</span>
        ))}
        <span className="hadiah">GRATIS</span>
      </section>

      <section className="bingkai">
        {siap ? <Papan kartu={kartu} baru={baru} /> : <div className="papan memuat" style={{ aspectRatio: `${PAPAN_W} / ${PAPAN_H}` }} />}
      </section>

      {pesan && <p className={`pesan ${pesan.jenis}`} role="status">{pesan.teks}</p>}

      {siap && !penuh && (
        <section className="kartu-form">
          <h2 className="lab">{jumlah ? `PIN KENANGAN KE-${jumlah + 1}` : 'PIN KENANGAN PERTAMAMU'}</h2>
          <form onSubmit={tempel}>
            <div className="baris">
              <input
                ref={formRef}
                value={tautan}
                onChange={(e) => setTautan(e.target.value)}
                placeholder="pabrikenangan.my.id/download/…"
                inputMode="url"
                autoComplete="off"
                aria-label="Link hasil foto"
              />
              <button type="button" className="kecil-btn" onClick={tempelDariClipboard}>Paste</button>
            </div>
            <button className="tombol" disabled={sibuk || !tautan.trim()}>{sibuk ? 'Lagi dipin…' : 'Pin ke papan'}</button>
          </form>
          <details className="bantuan">
            <summary>Link-nya dari mana?</summary>
            <ol>
              <li>Habis foto, scan QR yang muncul di layar booth.</li>
              <li>Halaman hasil fotomu terbuka. Salin alamatnya (tombol bagikan di browser → Salin).</li>
              <li>Tempel di sini. Satu sesi = satu kenangan, dan tiap link cuma bisa dipin di satu papan. Jadi kalau foto rame-rame, siapa cepat dia dapat 😉</li>
            </ol>
          </details>
        </section>
      )}

      {penuh && !kartu?.voucher_kode && (
        <section className="kartu-form">
          <h2 className="lab">PAMERIN PAPANMU, AMBIL SESI GRATISNYA</h2>
          <ol className="langkah">
            <li>
              <b>Simpan papanmu</b>, ukurannya sudah pas untuk Story.
              <button className="tombol" onClick={simpanGambar} disabled={!berkas}>{berkas ? 'Simpan gambar' : 'Lagi disiapin…'}</button>
            </li>
            <li><b>Posting di Story atau feed IG</b>, lalu tag <b>@pabrikenangan</b>.</li>
            <li>
              <b>Kasih tahu username IG-mu.</b> Begitu postinganmu kami lihat, voucher sesi gratis langsung kami kirim lewat DM.
              <form onSubmit={ajukan} className="baris">
                <input value={ig || kartu?.ig_username || ''} onChange={(e) => setIg(e.target.value)} placeholder="@username" autoComplete="off" aria-label="Username Instagram" />
                <button className="kecil-btn" disabled={sibuk || !(ig || kartu?.ig_username)}>{kartu?.diajukan_at ? 'Ubah' : 'Kirim'}</button>
              </form>
            </li>
          </ol>
          {kartu?.diajukan_at && (
            <p className="tunggu">⏳ Postingan <b>@{kartu.ig_username}</b> lagi kami cek. Vouchernya nanti juga muncul di halaman ini.</p>
          )}
        </section>
      )}

      {kartu?.voucher_kode && (
        <section className="kartu-form voucher">
          <h2 className="lab">SESI GRATISMU SUDAH SIAP 🎉</h2>
          <button className="kode-voucher" onClick={salinVoucher}>{kartu.voucher_kode}</button>
          <p>{tersalin ? 'Kode tersalin!' : 'Masukkan kode ini di booth waktu pilih pembayaran. Berlaku untuk satu sesi.'}</p>
          <button className="tombol garis" onClick={kartuBaru}>Mulai papan baru</button>
        </section>
      )}

      {kartu && (
        <footer className="kaki">
          <p>Papanmu tersimpan di browser HP ini. Buka lagi dari browser yang sama, dan jangan hapus data browser-nya ya.</p>
          {tanpaSimpan && <p className="peringatan">Browser ini tidak bisa menyimpan papan (mode privat?). Simpan gambar papanmu sebelum menutup halaman.</p>}
        </footer>
      )}
    </main>
  )
}
