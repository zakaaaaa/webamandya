'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Plus, Loader2, Upload, Power, Trash2, ChevronLeft, Check, AlertCircle,
  RotateCw, ArrowUp, ArrowDown, Play, Eye, EyeOff, Sparkles, Share2, Download,
} from 'lucide-react'

// ── Tipe (sama dengan kolom story_templates & backend/src/utils/story-render.js)
export type IsiSlot = 'strip_kiri' | 'strip_kanan' | 'hasil' | 'animasi'
export type Slot = {
  id: string; isi: IsiSlot
  x: number; y: number; w: number; h: number; rot: number
  bingkai: number; warna_bingkai: string
}
export type StoryTemplate = {
  id: string; client_id: string; nama: string; jenis: 'strip2' | 'umum'
  latar_url: string; stiker_url: string | null; pratinjau_url: string | null
  slots: Slot[]; is_active: boolean; sort_order: number; updated_at: string
}
export type ContohSesi = { kode: string; hasil: string; animasi: string | null; strip2: boolean }

const W = 1080
const H = 1920
const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.pabrikenangan.my.id'
const MERAH = '#D42B22'
const FONT = "'Poppins',sans-serif"

const LABEL_ISI: Record<IsiSlot, string> = {
  strip_kiri: 'Strip kiri', strip_kanan: 'Strip kanan', hasil: 'Hasil utuh', animasi: 'Animasi',
}
const WARNA_ISI: Record<IsiSlot, string> = {
  strip_kiri: '#2563eb', strip_kanan: '#7c3aed', hasil: '#059669', animasi: MERAH,
}

const idBaru = () => Math.random().toString(36).slice(2, 9)

function slotBaru(isi: IsiSlot): Slot {
  const dasar = { id: idBaru(), isi, rot: 0, bingkai: 0, warna_bingkai: '#ffffff' }
  if (isi === 'animasi') return { ...dasar, x: 190, y: 140, w: 700, h: 467, bingkai: 14 }
  if (isi === 'hasil') return { ...dasar, x: 240, y: 560, w: 600, h: 900 }
  return { ...dasar, x: isi === 'strip_kiri' ? 90 : 560, y: 620, w: 400, h: 1200, rot: isi === 'strip_kiri' ? -6 : 5 }
}

// ── Pratinjau isi slot — HARUS sama dengan ffmpeg: isi "cover" dipotong di
// tengah, bingkai polos di dalam kotak, rotasi berporos di tengah.
function IsiPratinjau({ slot, contoh, ukuranHasil, skala }: {
  slot: Slot; contoh: ContohSesi | null; ukuranHasil: { w: number; h: number } | null; skala: number
}) {
  const b = Math.max(0, Math.min(slot.bingkai, Math.floor(Math.min(slot.w, slot.h) / 3)))
  const iw = (slot.w - 2 * b) * skala
  const ih = (slot.h - 2 * b) * skala

  let isi: React.ReactNode = null
  if (contoh && slot.isi === 'animasi' && contoh.animasi) {
    isi = /\.mp4($|\?)/i.test(contoh.animasi)
      ? <video src={contoh.animasi} autoPlay muted loop playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      // eslint-disable-next-line @next/next/no-img-element
      : <img src={contoh.animasi} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
  } else if (contoh && ukuranHasil) {
    // Strip = setengah lebar hasil; "hasil" atau animasi tanpa berkas = utuh.
    const separuh = slot.isi === 'strip_kiri' || slot.isi === 'strip_kanan'
    const sw = separuh ? ukuranHasil.w / 2 : ukuranHasil.w
    const sh = ukuranHasil.h
    const k = Math.max(iw / sw, ih / sh)
    const lebarImg = ukuranHasil.w * k
    const geserKiri = (slot.isi === 'strip_kanan' ? -sw * k : 0) - (sw * k - iw) / 2
    isi = (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={contoh.hasil} alt="" draggable={false} style={{
        position: 'absolute', left: geserKiri, top: -(sh * k - ih) / 2,
        width: lebarImg, height: sh * k, maxWidth: 'none',
      }} />
    )
  }

  return (
    <div style={{
      position: 'absolute', inset: 0, background: slot.bingkai > 0 ? slot.warna_bingkai : 'transparent',
      padding: b * skala, boxSizing: 'border-box',
    }}>
      <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden', background: contoh ? '#222' : WARNA_ISI[slot.isi] + '55' }}>
        {isi}
      </div>
    </div>
  )
}

// ── Editor ──────────────────────────────────────────────────────────────────
type Draft = Omit<StoryTemplate, 'id' | 'client_id' | 'updated_at' | 'pratinjau_url' | 'sort_order'> & { id?: string }

function Editor({ awal, clientId, daftarContoh, onKembali, onTersimpan }: {
  awal: Draft; clientId: string; daftarContoh: ContohSesi[]
  onKembali: () => void; onTersimpan: (t: StoryTemplate) => void
}) {
  const supabase = useMemo(() => createClient(), [])
  const [d, setD] = useState<Draft>(awal)
  const [pilih, setPilih] = useState<string | null>(awal.slots[0]?.id ?? null)
  const [lihatStiker, setLihatStiker] = useState(true)
  const [idxContoh, setIdxContoh] = useState(0)
  const [ukuranHasil, setUkuranHasil] = useState<{ w: number; h: number } | null>(null)
  const [sibuk, setSibuk] = useState<'' | 'latar' | 'stiker' | 'simpan' | 'render'>('')
  const [galat, setGalat] = useState('')
  const [hasilUji, setHasilUji] = useState<{ url: string; jenis: string; ms?: number } | null>(null)
  const [lebarWadah, setLebarWadah] = useState(360)
  const wadahRef = useRef<HTMLDivElement>(null)
  const kanvasRef = useRef<HTMLDivElement>(null)

  const contohCocok = daftarContoh.filter(c => d.jenis !== 'strip2' || c.strip2)
  const contoh = contohCocok[idxContoh % Math.max(1, contohCocok.length)] ?? null

  useEffect(() => {
    if (!contoh) { setUkuranHasil(null); return }
    const im = new Image()
    im.onload = () => setUkuranHasil({ w: im.naturalWidth, h: im.naturalHeight })
    im.src = contoh.hasil
  }, [contoh?.hasil])

  useEffect(() => {
    if (!wadahRef.current) return
    const ro = new ResizeObserver(e => { const w = e[0]?.contentRect.width; if (w) setLebarWadah(w) })
    ro.observe(wadahRef.current)
    return () => ro.disconnect()
  }, [])

  const skala = Math.min(lebarWadah / W, 640 / H)
  const slotDipilih = d.slots.find(s => s.id === pilih) ?? null
  const ubahSlot = (id: string, ubah: Partial<Slot>) =>
    setD(p => ({ ...p, slots: p.slots.map(s => s.id === id ? { ...s, ...ubah } : s) }))

  // Pointer: satu jalur untuk mouse & jari (lihat FrameSlotEditor).
  const lacak = (pointerId: number, gerak: (e: PointerEvent) => void) => {
    const m = (e: PointerEvent) => { if (e.pointerId !== pointerId) return; if (e.cancelable) e.preventDefault(); gerak(e) }
    const u = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return
      window.removeEventListener('pointermove', m); window.removeEventListener('pointerup', u); window.removeEventListener('pointercancel', u)
    }
    window.addEventListener('pointermove', m, { passive: false })
    window.addEventListener('pointerup', u); window.addEventListener('pointercancel', u)
  }

  const mulaiGeser = (e: React.PointerEvent, s: Slot) => {
    e.preventDefault(); e.stopPropagation(); setPilih(s.id)
    const mx = e.clientX, my = e.clientY
    lacak(e.pointerId, me => ubahSlot(s.id, { x: Math.round(s.x + (me.clientX - mx) / skala), y: Math.round(s.y + (me.clientY - my) / skala) }))
  }

  // Ubah ukuran di sumbu lokal kotak yang sudah diputar, sisi seberang tetap.
  const mulaiUkur = (e: React.PointerEvent, s: Slot, ex: number, ey: number) => {
    e.preventDefault(); e.stopPropagation(); setPilih(s.id)
    const mx = e.clientX, my = e.clientY
    const a = (s.rot * Math.PI) / 180, cos = Math.cos(a), sin = Math.sin(a)
    const cx0 = s.x + s.w / 2, cy0 = s.y + s.h / 2
    lacak(e.pointerId, me => {
      const dx = (me.clientX - mx) / skala, dy = (me.clientY - my) / skala
      const lx = dx * cos + dy * sin, ly = -dx * sin + dy * cos
      const w = Math.max(40, s.w + ex * lx), h = Math.max(40, s.h + ey * ly)
      const gx = (ex * (w - s.w)) / 2, gy = (ey * (h - s.h)) / 2
      const cx = cx0 + gx * cos - gy * sin, cy = cy0 + gx * sin + gy * cos
      ubahSlot(s.id, { w: Math.round(w), h: Math.round(h), x: Math.round(cx - w / 2), y: Math.round(cy - h / 2) })
    })
  }

  const mulaiPutar = (e: React.PointerEvent, s: Slot) => {
    e.preventDefault(); e.stopPropagation(); setPilih(s.id)
    const r = kanvasRef.current!.getBoundingClientRect()
    const cx = (s.x + s.w / 2) * skala + r.left, cy = (s.y + s.h / 2) * skala + r.top
    lacak(e.pointerId, me => {
      let deg = Math.round(Math.atan2(me.clientY - cy, me.clientX - cx) * 180 / Math.PI + 90)
      deg = ((deg + 540) % 360) - 180
      if (Math.abs(deg) <= 2) deg = 0
      ubahSlot(s.id, { rot: deg })
    })
  }

  const unggah = async (file: File, jenis: 'latar' | 'stiker') => {
    setGalat('')
    if (!/image\/(png|jpeg)/.test(file.type)) { setGalat('Pakai PNG atau JPG.'); return }
    const dim = await new Promise<{ w: number; h: number }>(res => {
      const im = new Image(); im.onload = () => res({ w: im.naturalWidth, h: im.naturalHeight }); im.src = URL.createObjectURL(file)
    })
    if (Math.abs(dim.w / dim.h - W / H) > 0.01) {
      setGalat(`Ukuran ${dim.w}x${dim.h} bukan 9:16. Pakai 1080x1920 supaya tidak gepeng.`)
      return
    }
    if (jenis === 'stiker' && file.type !== 'image/png') { setGalat('Stiker harus PNG transparan.'); return }
    setSibuk(jenis)
    try {
      const ext = file.type === 'image/png' ? 'png' : 'jpg'
      const nama = `${clientId}/story/${Date.now()}_${jenis}.${ext}`
      const { error } = await supabase.storage.from('frames').upload(nama, file, { contentType: file.type, cacheControl: '31536000', upsert: false })
      if (error) throw error
      const url = supabase.storage.from('frames').getPublicUrl(nama).data.publicUrl
      setD(p => (jenis === 'latar' ? { ...p, latar_url: url } : { ...p, stiker_url: url }))
    } catch (err) {
      setGalat('Gagal upload: ' + (err as Error).message)
    } finally { setSibuk('') }
  }

  const simpan = async (): Promise<StoryTemplate | null> => {
    setGalat('')
    if (!d.nama.trim()) { setGalat('Nama template wajib diisi.'); return null }
    if (!d.latar_url) { setGalat('Upload latar dulu.'); return null }
    if (!d.slots.length) { setGalat('Tambahkan minimal satu slot.'); return null }
    setSibuk('simpan')
    try {
      const isi = {
        nama: d.nama.trim(), jenis: d.jenis, latar_url: d.latar_url, stiker_url: d.stiker_url,
        slots: d.slots, is_active: d.is_active,
      }
      const q = d.id
        ? supabase.from('story_templates').update(isi).eq('id', d.id).select('*').single()
        : supabase.from('story_templates').insert({ ...isi, client_id: clientId, sort_order: Date.now() % 1_000_000 }).select('*').single()
      const { data, error } = await q
      if (error) throw error
      setD(p => ({ ...p, id: data.id }))
      onTersimpan(data as StoryTemplate)
      return data as StoryTemplate
    } catch (err) {
      setGalat('Gagal menyimpan: ' + (err as Error).message)
      return null
    } finally { setSibuk('') }
  }

  const ujiRender = async () => {
    if (!contoh) { setGalat('Belum ada sesi contoh yang cocok untuk template ini.'); return }
    const t = await simpan()
    if (!t) return
    setSibuk('render'); setHasilUji(null)
    try {
      const t0 = Date.now()
      const r = await fetch(`${API}/api/story/render`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sesi: contoh.kode, template: t.id }),
      })
      const j = await r.json()
      if (!r.ok || !j.success) throw new Error(j.message || `HTTP ${r.status}`)
      setHasilUji({ url: j.url, jenis: j.jenis, ms: Date.now() - t0 })
    } catch (err) {
      setGalat('Uji render gagal: ' + (err as Error).message)
    } finally { setSibuk('') }
  }

  const geserUrutan = (id: string, arah: -1 | 1) => setD(p => {
    const i = p.slots.findIndex(s => s.id === id), j = i + arah
    if (i < 0 || j < 0 || j >= p.slots.length) return p
    const s = [...p.slots];[s[i], s[j]] = [s[j], s[i]]
    return { ...p, slots: s }
  })

  // Samakan rasio kotak dengan isinya (lebar tetap), supaya tidak terpotong.
  const pasRasio = (s: Slot) => {
    if (!ukuranHasil) return
    const separuh = s.isi === 'strip_kiri' || s.isi === 'strip_kanan'
    const rasio = s.isi === 'animasi' ? 2 / 3 : ukuranHasil.h / (separuh ? ukuranHasil.w / 2 : ukuranHasil.w)
    const iw = s.w - 2 * s.bingkai
    const h = Math.round(iw * rasio + 2 * s.bingkai)
    ubahSlot(s.id, { h, y: Math.round(s.y + (s.h - h) / 2) })
  }

  const tombol = (aktif = false): React.CSSProperties => ({
    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 12px', borderRadius: 9, cursor: 'pointer',
    fontFamily: FONT, fontSize: 13, fontWeight: 600, border: `1px solid ${aktif ? MERAH : 'rgba(212,43,34,.18)'}`,
    background: aktif ? MERAH : '#fff', color: aktif ? '#fff' : '#7A2E22',
  })
  const angka: React.CSSProperties = { width: '100%', padding: '6px 8px', borderRadius: 7, border: '1px solid rgba(212,43,34,.18)', fontFamily: 'monospace', fontSize: 13 }

  return (
    <div style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <style>{`
        .se-body{display:flex;gap:20px;align-items:flex-start}
        .se-side{width:300px;flex-shrink:0;display:flex;flex-direction:column;gap:12px}
        .se-h::after{content:'';position:absolute;inset:-8px}
        @media (max-width:860px){.se-body{flex-direction:column}.se-side{width:100%}}
      `}</style>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={onKembali} style={tombol()}><ChevronLeft size={15} />Kembali</button>
        <input value={d.nama} onChange={e => setD(p => ({ ...p, nama: e.target.value }))} placeholder="Nama template"
          style={{ flex: 1, minWidth: 180, padding: '9px 12px', borderRadius: 9, border: '1px solid rgba(212,43,34,.2)', fontFamily: FONT, fontSize: 14 }} />
        <select value={d.jenis} onChange={e => setD(p => ({ ...p, jenis: e.target.value as Draft['jenis'] }))}
          style={{ padding: '9px 10px', borderRadius: 9, border: '1px solid rgba(212,43,34,.2)', fontFamily: FONT, fontSize: 13 }}>
          <option value="strip2">Untuk frame strip (dibelah 2)</option>
          <option value="umum">Untuk semua frame</option>
        </select>
        <label style={{ ...tombol(d.is_active), userSelect: 'none' }}>
          <input type="checkbox" checked={d.is_active} onChange={e => setD(p => ({ ...p, is_active: e.target.checked }))} style={{ display: 'none' }} />
          <Power size={14} />{d.is_active ? 'Aktif' : 'Nonaktif'}
        </label>
        <button onClick={simpan} disabled={!!sibuk} style={tombol(true)}>
          {sibuk === 'simpan' ? <Loader2 size={14} className="muter" /> : <Check size={14} />}Simpan
        </button>
      </div>

      {galat && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '10px 12px', borderRadius: 9, background: '#FDECEA', color: '#9B1C14', fontSize: 13 }}>
          <AlertCircle size={15} />{galat}
        </div>
      )}

      <div className="se-body">
        {/* ── KANVAS ── */}
        <div ref={wadahRef} style={{ flex: 1, minWidth: 0, display: 'flex', justifyContent: 'center' }}>
          <div ref={kanvasRef} onPointerDown={() => setPilih(null)} style={{
            position: 'relative', width: W * skala, height: H * skala, background: '#1b1b22',
            borderRadius: 10, overflow: 'hidden', userSelect: 'none', touchAction: 'none', flexShrink: 0,
          }}>
            {d.latar_url
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={d.latar_url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
              : <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#888', fontSize: 13, textAlign: 'center', padding: 20 }}>Upload latar 1080×1920</div>}

            {d.slots.map((s, i) => (
              <div key={s.id} onPointerDown={e => mulaiGeser(e, s)} style={{
                position: 'absolute', left: s.x * skala, top: s.y * skala, width: s.w * skala, height: s.h * skala,
                transform: `rotate(${s.rot}deg)`, transformOrigin: 'center', cursor: 'move', zIndex: 10 + i,
              }}>
                <IsiPratinjau slot={s} contoh={contoh} ukuranHasil={ukuranHasil} skala={skala} />
              </div>
            ))}

            {d.stiker_url && lihatStiker && (
              // pointer-events none: slot di bawah stiker tetap bisa digeser.
              // eslint-disable-next-line @next/next/no-img-element
              <img src={d.stiker_url} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 200, pointerEvents: 'none' }} />
            )}

            {/* Garis seleksi & pegangan di lapisan paling atas */}
            {slotDipilih && (() => {
              const s = slotDipilih, warna = WARNA_ISI[s.isi]
              const pegangan: [number, number][] = [[-1, -1], [1, -1], [-1, 1], [1, 1], [1, 0], [-1, 0], [0, 1], [0, -1]]
              return (
                <div style={{
                  position: 'absolute', left: s.x * skala, top: s.y * skala, width: s.w * skala, height: s.h * skala,
                  transform: `rotate(${s.rot}deg)`, transformOrigin: 'center', zIndex: 300, pointerEvents: 'none',
                  outline: `2px solid ${warna}`, outlineOffset: 0,
                }}>
                  <div onPointerDown={e => mulaiPutar(e, s)} className="se-h" title="Putar" style={{
                    position: 'absolute', left: '50%', top: -34, marginLeft: -13, width: 26, height: 26, borderRadius: '50%',
                    background: warna, border: '2px solid #fff', display: 'grid', placeItems: 'center', cursor: 'grab', pointerEvents: 'auto', touchAction: 'none',
                  }}><RotateCw size={12} color="#fff" /></div>
                  {pegangan.map(([ex, ey]) => (
                    <div key={`${ex}${ey}`} className="se-h" onPointerDown={e => mulaiUkur(e, s, ex, ey)} style={{
                      position: 'absolute', width: 12, height: 12, marginLeft: -6, marginTop: -6, borderRadius: 3,
                      left: `${(ex + 1) * 50}%`, top: `${(ey + 1) * 50}%`, background: '#fff', border: `2px solid ${warna}`,
                      cursor: 'pointer', pointerEvents: 'auto', touchAction: 'none',
                    }} />
                  ))}
                </div>
              )
            })()}
          </div>
        </div>

        {/* ── PANEL SAMPING ── */}
        <div className="se-side">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <label style={{ ...tombol(), justifyContent: 'center' }}>
              {sibuk === 'latar' ? <Loader2 size={14} className="muter" /> : <Upload size={14} />}Latar
              <input type="file" accept="image/png,image/jpeg" hidden onChange={e => e.target.files?.[0] && unggah(e.target.files[0], 'latar')} />
            </label>
            <label style={{ ...tombol(), justifyContent: 'center' }}>
              {sibuk === 'stiker' ? <Loader2 size={14} className="muter" /> : <Upload size={14} />}Stiker depan
              <input type="file" accept="image/png" hidden onChange={e => e.target.files?.[0] && unggah(e.target.files[0], 'stiker')} />
            </label>
          </div>
          {d.stiker_url && (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setLihatStiker(v => !v)} style={{ ...tombol(), flex: 1, justifyContent: 'center' }}>
                {lihatStiker ? <EyeOff size={14} /> : <Eye size={14} />}{lihatStiker ? 'Sembunyikan stiker' : 'Tampilkan stiker'}
              </button>
              <button onClick={() => setD(p => ({ ...p, stiker_url: null }))} style={tombol()} title="Hapus stiker"><Trash2 size={14} /></button>
            </div>
          )}

          <div>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#9E8880', margin: '4px 0 6px' }}>Tambah slot</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {(['strip_kiri', 'strip_kanan', 'animasi', 'hasil'] as IsiSlot[])
                .filter(i => d.jenis === 'strip2' || (i !== 'strip_kiri' && i !== 'strip_kanan'))
                .map(i => (
                  <button key={i} onClick={() => { const s = slotBaru(i); setD(p => ({ ...p, slots: [...p.slots, s] })); setPilih(s.id) }}
                    style={{ ...tombol(), padding: '6px 10px', fontSize: 12 }}><Plus size={12} />{LABEL_ISI[i]}</button>
                ))}
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase', color: '#9E8880', margin: '4px 0 2px' }}>
              Slot (bawah → atas)
            </p>
            {d.slots.map((s, i) => (
              <div key={s.id} onClick={() => setPilih(s.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '7px 9px', borderRadius: 8, cursor: 'pointer',
                border: `1px solid ${pilih === s.id ? WARNA_ISI[s.isi] : 'rgba(212,43,34,.1)'}`, background: pilih === s.id ? WARNA_ISI[s.isi] + '14' : '#fff',
              }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: WARNA_ISI[s.isi] }} />
                <span style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{i + 1}. {LABEL_ISI[s.isi]}</span>
                <button onClick={e => { e.stopPropagation(); geserUrutan(s.id, -1) }} style={{ border: 0, background: 'none', cursor: 'pointer' }} title="Ke belakang"><ArrowDown size={13} /></button>
                <button onClick={e => { e.stopPropagation(); geserUrutan(s.id, 1) }} style={{ border: 0, background: 'none', cursor: 'pointer' }} title="Ke depan"><ArrowUp size={13} /></button>
                <button onClick={e => { e.stopPropagation(); setD(p => ({ ...p, slots: p.slots.filter(x => x.id !== s.id) })) }}
                  style={{ border: 0, background: 'none', cursor: 'pointer', color: '#B82018' }} title="Hapus"><Trash2 size={13} /></button>
              </div>
            ))}
          </div>

          {slotDipilih && (
            <div style={{ padding: 12, borderRadius: 10, border: '1px solid rgba(212,43,34,.14)', background: '#fff', display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 8 }}>
              <label style={{ gridColumn: '1 / -1', fontSize: 12 }}>Isi
                <select value={slotDipilih.isi} onChange={e => ubahSlot(slotDipilih.id, { isi: e.target.value as IsiSlot })} style={{ ...angka, fontFamily: FONT }}>
                  {(Object.keys(LABEL_ISI) as IsiSlot[]).map(k => <option key={k} value={k}>{LABEL_ISI[k]}</option>)}
                </select>
              </label>
              {([['x', 'X'], ['y', 'Y'], ['rot', 'Putar°'], ['w', 'Lebar'], ['h', 'Tinggi'], ['bingkai', 'Bingkai']] as [keyof Slot, string][]).map(([k, lab]) => (
                <label key={k} style={{ fontSize: 12 }}>{lab}
                  <input type="number" value={slotDipilih[k] as number}
                    onChange={e => ubahSlot(slotDipilih.id, { [k]: Number(e.target.value) || 0 } as Partial<Slot>)} style={angka} />
                </label>
              ))}
              <label style={{ fontSize: 12 }}>Warna
                <input type="color" value={slotDipilih.warna_bingkai} onChange={e => ubahSlot(slotDipilih.id, { warna_bingkai: e.target.value })}
                  style={{ ...angka, padding: 2, height: 32 }} />
              </label>
              <button onClick={() => pasRasio(slotDipilih)} style={{ ...tombol(), gridColumn: 'span 2', justifyContent: 'center', fontSize: 12 }}>
                Pas-kan tinggi ke isi
              </button>
            </div>
          )}

          <div style={{ padding: 12, borderRadius: 10, background: 'rgba(212,43,34,.05)', border: '1px solid rgba(212,43,34,.12)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <p style={{ margin: 0, fontSize: 12, color: '#7A6259' }}>
              Pratinjau memakai sesi pelanggan asli{contoh ? ` (${contoh.kode})` : ''}. {contohCocok.length > 1 && (
                <button onClick={() => setIdxContoh(i => i + 1)} style={{ border: 0, background: 'none', color: MERAH, cursor: 'pointer', fontWeight: 700, padding: 0 }}>Ganti contoh</button>
              )}
            </p>
            <button onClick={ujiRender} disabled={!!sibuk} style={{ ...tombol(true), justifyContent: 'center' }}>
              {sibuk === 'render' ? <><Loader2 size={14} className="muter" />Merender…</> : <><Play size={14} />Simpan & uji render</>}
            </button>
            {hasilUji && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {hasilUji.jenis === 'video'
                  ? <video src={hasilUji.url} controls autoPlay muted loop playsInline style={{ width: '100%', borderRadius: 8 }} />
                  // eslint-disable-next-line @next/next/no-img-element
                  : <img src={hasilUji.url} alt="Hasil uji" style={{ width: '100%', borderRadius: 8 }} />}
                <span style={{ fontSize: 11, color: '#9E8880' }}>Selesai dalam {((hasilUji.ms ?? 0) / 1000).toFixed(1)} dtk (termasuk unggah).</span>
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`.muter{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

// ── Daftar template ─────────────────────────────────────────────────────────
export default function StoryManager({ clientId, initialTemplates, contoh, pakai }: {
  clientId: string; initialTemplates: StoryTemplate[]; contoh: ContohSesi[]
  pakai: Record<string, { render: number; dibagikan: number; disimpan: number }>
}) {
  const supabase = useMemo(() => createClient(), [])
  const [templates, setTemplates] = useState(initialTemplates)
  const [edit, setEdit] = useState<Draft | null>(null)
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [galat, setGalat] = useState('')

  const tersimpan = (t: StoryTemplate) =>
    setTemplates(p => (p.some(x => x.id === t.id) ? p.map(x => (x.id === t.id ? t : x)) : [...p, t]))

  const alihAktif = async (t: StoryTemplate) => {
    setSibuk(t.id); setGalat('')
    const { data, error } = await supabase.from('story_templates').update({ is_active: !t.is_active }).eq('id', t.id).select('*').single()
    if (error) setGalat(error.message); else tersimpan(data as StoryTemplate)
    setSibuk(null)
  }

  const hapus = async (t: StoryTemplate) => {
    if (!confirm(`Hapus template "${t.nama}"? Story yang sudah dibuat pelanggan tetap ada.`)) return
    setSibuk(t.id); setGalat('')
    const { error } = await supabase.from('story_templates').delete().eq('id', t.id)
    if (error) setGalat(error.message); else setTemplates(p => p.filter(x => x.id !== t.id))
    setSibuk(null)
  }

  if (edit) {
    return <Editor awal={edit} clientId={clientId} daftarContoh={contoh}
      onKembali={() => setEdit(null)} onTersimpan={tersimpan} />
  }

  return (
    <div style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, color: '#2B1D12' }}>Template Story</h1>
          <p style={{ margin: '4px 0 0', fontSize: 13, color: '#7A6259' }}>
            Pelanggan memilih template di halaman unduh, lalu hasil sesinya dirakit jadi Story IG 1080×1920.
          </p>
        </div>
        <button onClick={() => setEdit({ nama: '', jenis: 'strip2', latar_url: '', stiker_url: null, slots: [], is_active: false })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 16px', borderRadius: 10, border: 0, background: MERAH, color: '#fff', fontFamily: FONT, fontWeight: 600, cursor: 'pointer' }}>
          <Plus size={16} />Template baru
        </button>
      </div>

      {galat && <div style={{ padding: '10px 12px', borderRadius: 9, background: '#FDECEA', color: '#9B1C14', fontSize: 13 }}>{galat}</div>}

      {templates.length === 0 ? (
        <div style={{ padding: '40px 20px', borderRadius: 14, border: '1px dashed rgba(212,43,34,.25)', textAlign: 'center', color: '#7A6259' }}>
          <Sparkles size={22} style={{ marginBottom: 8 }} />
          <p style={{ margin: 0 }}>Belum ada template. Siapkan latar 1080×1920 (dan stiker PNG transparan bila perlu), lalu klik Template baru.</p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(170px,1fr))', gap: 14 }}>
          {templates.map(t => {
            const p = pakai[t.id]
            return (
              <div key={t.id} style={{ borderRadius: 14, overflow: 'hidden', background: '#fff', border: '1px solid rgba(212,43,34,.1)' }}>
                <div onClick={() => setEdit({ ...t })} style={{ position: 'relative', aspectRatio: '9/16', background: '#222', cursor: 'pointer' }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.latar_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {t.stiker_url && <img src={t.stiker_url} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />}
                  <span style={{
                    position: 'absolute', top: 8, left: 8, padding: '3px 8px', borderRadius: 20, fontSize: 11, fontWeight: 700,
                    background: t.is_active ? '#1E7A4B' : 'rgba(0,0,0,.6)', color: '#fff',
                  }}>{t.is_active ? 'Aktif' : 'Nonaktif'}</span>
                </div>
                <div style={{ padding: '10px 12px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <strong style={{ fontSize: 14, color: '#2B1D12' }}>{t.nama}</strong>
                  <span style={{ fontSize: 11, color: '#9E8880' }}>
                    {t.jenis === 'strip2' ? 'Frame strip' : 'Semua frame'} · {p ? <><Share2 size={10} /> {p.dibagikan} · <Download size={10} /> {p.disimpan} · {p.render} dibuat</> : 'belum dipakai'}
                  </span>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => alihAktif(t)} disabled={sibuk === t.id} style={{ flex: 1, display: 'inline-flex', justifyContent: 'center', alignItems: 'center', gap: 5, padding: '6px 8px', borderRadius: 8, border: '1px solid rgba(212,43,34,.18)', background: '#fff', color: '#7A2E22', fontSize: 12, cursor: 'pointer', fontFamily: FONT }}>
                      {sibuk === t.id ? <Loader2 size={12} className="muter" /> : <Power size={12} />}{t.is_active ? 'Matikan' : 'Aktifkan'}
                    </button>
                    <button onClick={() => hapus(t)} disabled={sibuk === t.id} style={{ padding: '6px 9px', borderRadius: 8, border: '1px solid rgba(212,43,34,.18)', background: '#fff', color: '#B82018', cursor: 'pointer' }}>
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <style>{`.muter{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}
