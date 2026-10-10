'use client'

import { useEffect, useState } from 'react'
import { Loader2, Share2, Download, Sparkles, AlertCircle, Play, Check } from 'lucide-react'

// "Bikin Story IG": pelanggan memilih template, server (VPS, ffmpeg) merakit
// hasil sesinya ke template itu — lihat backend/src/routes/story.js.
//
// Berkas hasil render diambil SEBELUM tombol Bagikan ditekan: Safari iOS hanya
// mengizinkan navigator.share() langsung di dalam ketukan pengguna, dan
// mengunduh dulu setelah ketukan membuat izin itu kedaluwarsa (share gagal
// diam-diam).

type Slot = { isi: string; x: number; y: number; w: number; h: number; rot: number }
type Template = { id: string; nama: string; thumb: string; stiker: string | null; video: boolean; slots?: Slot[] }

// Penanda "foto kamu di sini" di thumbnail: latar + penanda + stiker, posisi
// dalam persen kanvas 1080x1920 supaya ikut ukuran kartu.
function Penanda({ s }: { s: Slot }) {
  const kotak: React.CSSProperties = {
    position: 'absolute', left: `${(s.x / 1080) * 100}%`, top: `${(s.y / 1920) * 100}%`,
    width: `${(s.w / 1080) * 100}%`, height: `${(s.h / 1920) * 100}%`, transform: `rotate(${s.rot}deg)`,
  }
  if (s.isi === 'animasi') {
    return (
      <span style={{ ...kotak, background: 'linear-gradient(160deg,#4A2F1F,#2B1D12)', display: 'grid', placeItems: 'center' }}>
        <span style={{ width: '22%', aspectRatio: '1', minWidth: 14, borderRadius: '50%', background: 'rgba(255,246,230,.92)', display: 'grid', placeItems: 'center' }}>
          <Play size={9} fill="#C23A2A" color="#C23A2A" style={{ marginLeft: 1 }} />
        </span>
      </span>
    )
  }
  // Strip: kertas krem berisi tiga petak foto kosong.
  const petak = s.isi === 'hasil' ? 1 : 3
  return (
    <span style={{ ...kotak, background: '#F7F1E6', padding: '5% 7%', display: 'flex', flexDirection: 'column', gap: '3%', boxShadow: '0 2px 5px rgba(0,0,0,.35)' }}>
      {Array.from({ length: petak }, (_, i) => (
        <span key={i} style={{ flex: 1, borderRadius: 2, background: 'repeating-linear-gradient(135deg,#EADFCC 0 4px,#E2D5BF 4px 8px)' }} />
      ))}
    </span>
  )
}
type Hasil = { id: string; url: string; jenis: 'video' | 'gambar'; file?: File }

export default function StorySection({ kode, api, downloadOne }: {
  kode: string; api: string
  downloadOne: (url: string, filename: string) => Promise<boolean>
}) {
  const [templates, setTemplates] = useState<Template[] | null>(null)
  const [pilih, setPilih] = useState<string | null>(null)
  const [hasil, setHasil] = useState<Record<string, Hasil>>({})
  const [memuat, setMemuat] = useState<string | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [aksi, setAksi] = useState<'' | 'bagikan' | 'simpan'>('')

  useEffect(() => {
    let batal = false
    fetch(`${api}/api/story/templates?sesi=${encodeURIComponent(kode)}`)
      .then(r => r.json())
      .then(j => { if (!batal) setTemplates(j.success ? j.templates : []) })
      .catch(() => { if (!batal) setTemplates([]) })
    return () => { batal = true }
  }, [api, kode])

  const ambilBerkas = async (h: Hasil): Promise<File | undefined> => {
    try {
      const r = await fetch(h.url, { mode: 'cors' })
      if (!r.ok) return undefined
      const blob = await r.blob()
      const ext = h.jenis === 'video' ? 'mp4' : 'jpg'
      return new File([blob], `story_pabrikenangan_${kode.slice(-6)}.${ext}`, { type: blob.type || (h.jenis === 'video' ? 'video/mp4' : 'image/jpeg') })
    } catch {
      return undefined
    }
  }

  const pilihTemplate = async (t: Template) => {
    setPilih(t.id); setGalat(null)
    if (hasil[t.id]) return
    setMemuat(t.id)
    try {
      const r = await fetch(`${api}/api/story/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesi: kode, template: t.id }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.message || 'Gagal membuat Story')
      const h: Hasil = { id: j.id, url: j.url, jenis: j.jenis }
      setHasil(p => ({ ...p, [t.id]: h }))
      const file = await ambilBerkas(h)
      if (file) setHasil(p => ({ ...p, [t.id]: { ...h, file } }))
    } catch (e) {
      setGalat((e as Error).message || 'Gagal membuat Story, coba lagi.')
    } finally {
      setMemuat(null)
    }
  }

  const catat = (id: string, a: 'bagikan' | 'simpan') =>
    fetch(`${api}/api/story/aksi`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, aksi: a }),
    }).catch(() => {})

  const aktif = pilih ? hasil[pilih] : undefined

  const simpan = async () => {
    if (!aktif) return
    setAksi('simpan')
    const nama = `story_pabrikenangan_${kode.slice(-6)}.${aktif.jenis === 'video' ? 'mp4' : 'jpg'}`
    if (await downloadOne(aktif.url, nama)) catat(aktif.id, 'simpan')
    setAksi('')
  }

  const bagikan = async () => {
    if (!aktif) return
    const file = aktif.file
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean }
    if (file && nav.share && nav.canShare?.({ files: [file] })) {
      setAksi('bagikan')
      try {
        await nav.share({ files: [file] })
        catat(aktif.id, 'bagikan')
      } catch {
        // Dibatalkan pelanggan — bukan galat.
      } finally { setAksi('') }
      return
    }
    // Browser tanpa share berkas (mis. desktop): simpan saja, unggah dari galeri.
    await simpan()
    setGalat('HP ini belum bisa posting langsung. Story-nya sudah tersimpan, tinggal unggah dari galeri.')
  }

  if (!templates || templates.length === 0) return null

  return (
    <section className="blok">
      <h2 className="sub-judul">Pamer ke Story</h2>
      <span className="sub-ket lab">Pilih desain · kami tempel fotomu</span>

      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', padding: '14px 2px 12px', margin: '0 -20px', paddingInline: 20, scrollSnapType: 'x mandatory', scrollPaddingInline: 20 }}>
        {templates.map(t => {
          const aktifKartu = pilih === t.id
          return (
            <button key={t.id} onClick={() => pilihTemplate(t)} aria-label={t.nama} aria-pressed={aktifKartu} style={{
              flex: '0 0 124px', padding: 0, border: 0, background: 'none', cursor: 'pointer', scrollSnapAlign: 'start', textAlign: 'center',
            }}>
              <span style={{
                position: 'relative', display: 'block', aspectRatio: '9/16', borderRadius: 14, overflow: 'hidden', background: '#2B1D12',
                boxShadow: aktifKartu ? '0 0 0 3px var(--kuning), 0 10px 22px rgba(70,10,4,.45)' : '0 0 0 1px rgba(255,246,230,.22), 0 6px 14px rgba(70,10,4,.3)',
                transform: aktifKartu ? 'translateY(-4px)' : 'none', transition: 'transform .2s, box-shadow .2s',
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.thumb} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                {t.stiker && t.slots?.map((s, i) => <Penanda key={i} s={s} />)}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {t.stiker && <img src={t.stiker} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
                {t.video && (
                  <span className="lab" style={{ position: 'absolute', left: 6, top: 6, display: 'inline-flex', alignItems: 'center', gap: 3, padding: '3px 6px 2px', borderRadius: 20, fontSize: 8, background: 'var(--merah)', color: 'var(--krem)' }}>
                    <Play size={7} fill="currentColor" />Video
                  </span>
                )}
                {aktifKartu && memuat !== t.id && (
                  <span style={{ position: 'absolute', right: 6, top: 6, width: 20, height: 20, borderRadius: '50%', background: 'var(--kuning)', display: 'grid', placeItems: 'center' }}>
                    <Check size={12} color="#C23A2A" strokeWidth={3} />
                  </span>
                )}
                {memuat === t.id && (
                  <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(43,29,18,.55)' }}>
                    <Loader2 size={20} color="#FFF6E6" className="muter" />
                  </span>
                )}
              </span>
              <span className="lab" style={{ display: 'block', marginTop: 8, fontSize: 9.5, color: aktifKartu ? 'var(--kuning)' : 'var(--sub)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {t.nama.replace(/\s*\(video\)\s*/i, '')}
              </span>
            </button>
          )
        })}
      </div>

      {!pilih && (
        <p className="teks" style={{ textAlign: 'center', fontSize: 12.5, color: 'var(--sub)', margin: '2px 0 0' }}>
          Ketuk satu desain, Story-nya jadi dalam hitungan detik.
        </p>
      )}

      {galat && (
        <p className="teks" style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 13, color: 'var(--kuning)', margin: '4px 0 10px' }}>
          <AlertCircle size={15} />{galat}
        </p>
      )}

      {pilih && (memuat === pilih || aktif) && (
        <figure className="kartu" style={{ padding: 12, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ position: 'relative', aspectRatio: '9/16', maxHeight: '68dvh', margin: '0 auto', width: '100%', maxWidth: 'calc(68dvh * 9 / 16)', borderRadius: 14, overflow: 'hidden', background: '#2B1D12' }}>
            {aktif ? (
              aktif.jenis === 'video'
                ? <video key={aktif.url} src={aktif.url} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                // eslint-disable-next-line @next/next/no-img-element
                : <img src={aktif.url} alt="Story" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, color: 'var(--krem)' }}>
                <Sparkles size={26} />
                <span className="teks" style={{ fontSize: 14 }}>Lagi nempelin fotomu…</span>
                <Loader2 size={18} className="muter" />
              </div>
            )}
          </div>
          {aktif && (
            <p className="teks" style={{ textAlign: 'center', fontSize: 12.5, lineHeight: 1.45, color: 'var(--abu)', margin: 0 }}>
              {aktif.jenis === 'video' ? 'Slideshow fotomu ikut berputar di dalamnya. ' : ''}Tekan Posting, lalu pilih Instagram → Story.
            </p>
          )}
          {aktif && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="tombol merah kecil" onClick={bagikan} disabled={!!aksi}>
                {aksi === 'bagikan' ? <Loader2 size={14} className="muter" /> : <Share2 size={14} />}Posting
              </button>
              <button className="tombol lunak kecil" onClick={simpan} disabled={!!aksi}>
                {aksi === 'simpan' ? <Loader2 size={14} className="muter" /> : <Download size={14} />}Simpan
              </button>
            </div>
          )}
        </figure>
      )}
    </section>
  )
}
