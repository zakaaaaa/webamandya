'use client'

import { useEffect, useState } from 'react'
import { Loader2, Share2, Download, Sparkles, AlertCircle } from 'lucide-react'

// "Bikin Story IG": pelanggan memilih template, server (VPS, ffmpeg) merakit
// hasil sesinya ke template itu — lihat backend/src/routes/story.js.
//
// Berkas hasil render diambil SEBELUM tombol Bagikan ditekan: Safari iOS hanya
// mengizinkan navigator.share() langsung di dalam ketukan pengguna, dan
// mengunduh dulu setelah ketukan membuat izin itu kedaluwarsa (share gagal
// diam-diam).

type Template = { id: string; nama: string; thumb: string; stiker: string | null; video: boolean }
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
    setGalat('HP ini belum bisa langsung membagikan. Story sudah disimpan — unggah dari galeri ke IG.')
  }

  if (!templates || templates.length === 0) return null

  return (
    <section className="blok">
      <h2 className="sub-judul">Bikin Story IG</h2>
      <span className="sub-ket lab">Pilih desain, langsung posting</span>

      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', padding: '4px 2px 10px', scrollSnapType: 'x mandatory' }}>
        {templates.map(t => (
          <button key={t.id} onClick={() => pilihTemplate(t)} aria-label={t.nama} style={{
            position: 'relative', flex: '0 0 92px', aspectRatio: '9/16', borderRadius: 12, overflow: 'hidden', padding: 0,
            border: 0, cursor: 'pointer', scrollSnapAlign: 'start', background: '#2B1D12',
            boxShadow: pilih === t.id ? '0 0 0 3px var(--kuning)' : '0 0 0 1px rgba(255,246,230,.25)',
          }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={t.thumb} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {t.stiker && <img src={t.stiker} alt="" loading="lazy" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
            {memuat === t.id && (
              <span style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(43,29,18,.55)' }}>
                <Loader2 size={20} color="#FFF6E6" className="muter" />
              </span>
            )}
          </button>
        ))}
      </div>

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
                <span className="teks" style={{ fontSize: 14 }}>Merakit Story kamu…</span>
                <Loader2 size={18} className="muter" />
              </div>
            )}
          </div>
          {aktif && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <button className="tombol merah kecil" onClick={bagikan} disabled={!!aksi}>
                {aksi === 'bagikan' ? <Loader2 size={14} className="muter" /> : <Share2 size={14} />}Bagikan
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
