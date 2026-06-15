'use client'

import { useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import { Plus, Loader2, Upload, Image as ImageIcon, Power, Trash2, Settings2, ChevronLeft, Check, AlertCircle } from 'lucide-react'
import FrameSlotEditor, { PhotoSlot } from './FrameSlotEditor'

type FrameItem = {
  id: string
  name: string
  image_url: string
  thumbnail_url: string | null
  photo_count: number
  output_width: number
  output_height: number
  sort_order: number
  is_active: boolean
  created_at: string
  photo_slots: PhotoSlot[] | null
}

type View = 'list' | 'create' | 'edit-slots'

const SIZE_PRESETS = [
  { w:344,  h:515,  label:'Strip'        },
  { w:1200, h:1800, label:'4R'           },
  { w:1748, h:2480, label:'A5'           },
  { w:2480, h:3508, label:'A4'           },
  { w:1080, h:1920, label:'Story 9:16'   },
  { w:1080, h:1080, label:'Square 1:1'   },
]


// ── Compress image using Canvas API ──
async function compressImage(file: File, maxWidth: number, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const scale  = Math.min(1, maxWidth / img.width)
      const canvas = document.createElement('canvas')
      canvas.width  = Math.round(img.width  * scale)
      canvas.height = Math.round(img.height * scale)
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Compress failed')), 'image/webp', quality)
    }
    img.onerror = reject
    img.src = url
  })
}

export default function FramesManager({
  initialFrames, clientId,
}: { initialFrames: FrameItem[], clientId: string }) {
  const supabase = createClient()

  const [frames, setFrames]               = useState<FrameItem[]>(initialFrames)
  const [view, setView]                   = useState<View>('list')
  const [editingFrame, setEditingFrame]   = useState<FrameItem | null>(null)
  const [pendingSlots, setPendingSlots]   = useState<PhotoSlot[]>([])

  const [loading, setLoading]                 = useState(false)
  const [toggleLoading, setToggleLoading]     = useState<string | null>(null)
  const [deleteLoading, setDeleteLoading]     = useState<string | null>(null)
  const [saveSlotLoading, setSaveSlotLoading] = useState(false)
  const [error, setError]                     = useState('')
  const [successMsg, setSuccessMsg]           = useState('')

  const [form, setForm]             = useState({ name:'', photo_count:4, output_width:344, output_height:515 })
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [preview, setPreview]       = useState<string | null>(null)
  const [dragOver, setDragOver]     = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const showSuccess = (m: string) => { setSuccessMsg(m); setTimeout(()=>setSuccessMsg(''), 4000) }

  const handleFile = (file: File) => {
    if (!file.type.startsWith('image/')) { setError('File harus berupa gambar PNG/JPG.'); return }
    setSelectedFile(file); setPreview(URL.createObjectURL(file)); setError('')
  }

  const resetCreate = () => {
    setForm({ name:'', photo_count:4, output_width:344, output_height:515 })
    setSelectedFile(null); setPreview(null); setError(''); setPendingSlots([])
  }

  // ── CREATE ──
  const handleCreate = async () => {
    if (!form.name)    { setError('Nama frame wajib diisi.'); return }
    if (!selectedFile) { setError('Upload file frame terlebih dahulu.'); return }
    if (pendingSlots.length === 0) { setError('Atur minimal 1 slot foto.'); return }

    setLoading(true); setError('')
    try {
      const baseName    = `${clientId}/${Date.now()}_${form.name.replace(/\s+/g,'_')}`
      // Upload original
      const origBlob    = await compressImage(selectedFile, 2000, 0.92)
      const origName    = `${baseName}.webp`
      const { error: upErr } = await supabase.storage.from('frames').upload(origName, origBlob, { contentType:'image/webp', cacheControl:'3600', upsert:false })
      if (upErr) { setError('Gagal upload: ' + upErr.message); setLoading(false); return }

      // Upload thumbnail (400px wide, lossy)
      const thumbBlob   = await compressImage(selectedFile, 400, 0.80)
      const thumbName   = `${baseName}_thumb.webp`
      await supabase.storage.from('frames').upload(thumbName, thumbBlob, { contentType:'image/webp', cacheControl:'3600', upsert:false })

      const { data: urlData }   = supabase.storage.from('frames').getPublicUrl(origName)
      const { data: thumbData } = supabase.storage.from('frames').getPublicUrl(thumbName)
      const { data: nf, error: insErr } = await supabase.from('frames').insert({
        client_id: clientId, name: form.name, type: 'static',
        image_url: urlData.publicUrl, thumbnail_url: thumbData.publicUrl,
        photo_count: form.photo_count, output_width: form.output_width,
        output_height: form.output_height, photo_slots: pendingSlots,
        is_active: true, sort_order: frames.length + 1,
      }).select().single()

      if (insErr) { setError(insErr.message); setLoading(false); return }
      setFrames(prev => [...prev, nf])
      setView('list'); resetCreate(); showSuccess('Frame berhasil dibuat!')
    } catch { setError('Terjadi kesalahan.') }
    setLoading(false)
  }

  // ── SAVE SLOTS ──
  const handleSaveSlots = async () => {
    if (!editingFrame) return
    setSaveSlotLoading(true); setError('')
    const { error: err } = await supabase.from('frames').update({ photo_slots: pendingSlots }).eq('id', editingFrame.id)
    if (!err) {
      setFrames(prev => prev.map(f => f.id===editingFrame.id ? {...f,photo_slots:pendingSlots} : f))
      showSuccess('Slot posisi disimpan!'); setView('list')
    } else setError(err.message)
    setSaveSlotLoading(false)
  }

  const handleToggle = async (id: string, cur: boolean) => {
    setToggleLoading(id)
    const { error } = await supabase.from('frames').update({ is_active: !cur }).eq('id', id)
    if (!error) setFrames(prev => prev.map(f => f.id===id ? {...f,is_active:!cur} : f))
    setToggleLoading(null)
  }

  const handleDelete = async (id: string, imgUrl: string) => {
    if (!confirm('Hapus frame ini?')) return
    setDeleteLoading(id)
    try { const p=imgUrl.split('/frames/')[1]; if(p) await supabase.storage.from('frames').remove([p]) } catch{}
    const { error } = await supabase.from('frames').delete().eq('id', id)
    if (!error) setFrames(prev => prev.filter(f => f.id!==id))
    setDeleteLoading(null)
  }

  const inputCls: React.CSSProperties = {
    width:'100%', boxSizing:'border-box' as const,
    background:'rgba(212,43,34,0.055)', border:'1.5px solid rgba(212,43,34,0.08)',
    borderRadius:10, padding:'10px 14px', color:'#150C09', fontSize:14,
    outline:'none', fontFamily:"'Poppins',sans-serif", transition:'border-color .2s',
  }

  const labelCls: React.CSSProperties = {
    color:'rgba(122,98,89,0.95)', fontSize:12, fontWeight:600, letterSpacing:'1px',
    textTransform:'uppercase' as const, display:'block', marginBottom:8, fontFamily:'Poppins,sans-serif',
  }

  // ══════════════════════
  // VIEW: EDIT SLOTS
  // ══════════════════════
  if (view === 'edit-slots' && editingFrame) {
    const expectedSlotsEdit = editingFrame.photo_slots?.length || editingFrame.photo_count
    return (
      <div style={{ fontFamily:"'Poppins',sans-serif", padding:'28px 32px', maxWidth:1200, margin:'0 auto' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:22, flexWrap:'wrap' }}>
          <button onClick={()=>{setView('list');setError('')}}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(212,43,34,0.055)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:9, padding:'8px 14px', color:'rgba(74,46,34,0.9)', cursor:'pointer', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
            <ChevronLeft size={14}/>Kembali
          </button>
          <div style={{ flex:1, minWidth:0 }}>
            <h2 style={{ color:'#150C09', fontSize:20, fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:3 }}>
              Edit Slot — {editingFrame.name}
            </h2>
            <p style={{ color:'rgba(122,98,89,0.88)', fontSize:13 }}>
              {editingFrame.photo_count} foto · {editingFrame.output_width}x{editingFrame.output_height}px
            </p>
          </div>
          <div style={{ display:'flex', gap:9, alignItems:'center', flexWrap:'wrap' }}>
            {error && (
              <div style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 12px', borderRadius:8, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.15)', color:'#B82018', fontSize:13 }}>
                <AlertCircle size={13}/>{error}
              </div>
            )}
            <button onClick={handleSaveSlots} disabled={saveSlotLoading}
              style={{ display:'flex', alignItems:'center', gap:7, background:'linear-gradient(135deg,#E83530,#C02018)', border:'none', borderRadius:10, padding:'10px 20px', color:'#fff', fontSize:14, fontWeight:600, cursor:saveSlotLoading?'not-allowed':'pointer', boxShadow:'0 4px 14px rgba(212,43,34,.3)', fontFamily:"'Poppins',sans-serif", opacity:saveSlotLoading?.7:1 }}>
              {saveSlotLoading?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>Menyimpan...</>:<><Check size={14}/>Simpan Slot</>}
            </button>
          </div>
        </div>

        {pendingSlots.length !== expectedSlotsEdit && pendingSlots.length > 0 && (
          <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:10, background:'rgba(245,158,11,.07)', border:'1px solid rgba(245,158,11,.18)', color:'#D97706', fontSize:13, display:'flex', alignItems:'center', gap:8 }}>
            <AlertCircle size={14}/>
            Frame ini sebelumnya memiliki <strong style={{margin:'0 3px'}}>{expectedSlotsEdit} slot</strong>.
            Sekarang ada <strong style={{margin:'0 3px'}}>{pendingSlots.length}</strong>.
          </div>
        )}

        <div style={{ background:'rgba(212,43,34,0.03)', border:'1px solid rgba(212,43,34,0.06)', borderRadius:16, padding:22 }}>
          <FrameSlotEditor
            frameUrl={editingFrame.image_url}
            outputWidth={editingFrame.output_width}
            outputHeight={editingFrame.output_height}
            photoCount={editingFrame.photo_count}
            defaultSlotCount={editingFrame.photo_slots?.length || editingFrame.photo_count}
            initialSlots={editingFrame.photo_slots}
            onChange={setPendingSlots}
          />
        </div>
      </div>
    )
  }

  // ══════════════════════
  // VIEW: CREATE
  // ══════════════════════
  if (view === 'create') {
    return (
      <div style={{ fontFamily:"'Poppins',sans-serif", padding:'28px 32px', maxWidth:1200, margin:'0 auto' }}>
        <style>{`@keyframes spin{to{transform:rotate(360deg)}} @keyframes fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`}</style>

        <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:26 }}>
          <button onClick={()=>{setView('list');resetCreate()}}
            style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(212,43,34,0.055)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:9, padding:'8px 14px', color:'rgba(74,46,34,0.9)', cursor:'pointer', fontSize:13, fontFamily:"'Poppins',sans-serif" }}>
            <ChevronLeft size={14}/>Kembali
          </button>
          <div>
            <h2 style={{ color:'#150C09', fontSize:22, fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:3 }}>Upload Frame Baru</h2>
            <p style={{ color:'rgba(122,98,89,0.88)', fontSize:13 }}>Upload PNG transparan, lalu atur posisi slot foto</p>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns: preview ? 'minmax(300px,360px) 1fr' : '1fr', gap:20, alignItems:'start' }}>

          {/* LEFT — form */}
          <div style={{ background:'rgba(212,43,34,0.04)', border:'1px solid rgba(212,43,34,0.07)', borderRadius:16, padding:24, display:'flex', flexDirection:'column', gap:18 }}>

            {/* Drop zone */}
            <div>
              <label style={labelCls}>File Frame (PNG)</label>
              <div
                onDragOver={e=>{e.preventDefault();setDragOver(true)}}
                onDragLeave={()=>setDragOver(false)}
                onDrop={e=>{e.preventDefault();setDragOver(false);const f=e.dataTransfer.files[0];if(f)handleFile(f)}}
                onClick={()=>fileRef.current?.click()}
                style={{ border:`2px dashed ${dragOver?'rgba(212,43,34,.7)':'rgba(212,43,34,0.08)'}`, borderRadius:12, padding:20, textAlign:'center', cursor:'pointer', background:dragOver?'rgba(212,43,34,.05)':'transparent', transition:'all .2s', minHeight:110, display:'flex', alignItems:'center', justifyContent:'center' }}>
                <input ref={fileRef} type="file" accept="image/*" style={{display:'none'}} onChange={e=>{const f=e.target.files?.[0];if(f)handleFile(f)}}/>
                {preview
                  ? <img src={preview} alt="preview" style={{maxHeight:90,maxWidth:'100%',objectFit:'contain',borderRadius:8}}/>
                  : <div>
                      <Upload size={28} color="rgba(158,136,128,0.85)" style={{margin:'0 auto 10px'}}/>
                      <p style={{color:'rgba(122,98,89,0.88)',fontSize:14}}>Drag & drop atau klik</p>
                      <p style={{color:'rgba(158,136,128,0.85)',fontSize:12,marginTop:3}}>PNG transparan</p>
                    </div>
                }
              </div>
            </div>

            {/* Name */}
            <div>
              <label style={labelCls}>Nama Frame</label>
              <input type="text" value={form.name} onChange={e=>setForm(p=>({...p,name:e.target.value}))} placeholder="Misal: Frame Bunga Merah" style={inputCls}
                onFocus={e=>e.target.style.borderColor='rgba(212,43,34,.6)'}
                onBlur={e=>e.target.style.borderColor='rgba(212,43,34,0.08)'}/>
            </div>

            {/* Photo count — selector 1-10 */}
            <div>
              <label style={labelCls}>Jumlah Foto yang Diambil</label>
              <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:10 }}>
                <button onClick={()=>setForm(p=>({...p,photo_count:Math.max(1,p.photo_count-1)}))}
                  style={{ width:36, height:36, borderRadius:9, background:'rgba(212,43,34,0.055)', border:'1px solid rgba(212,43,34,0.08)', color:'#150C09', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  −
                </button>
                <div style={{ flex:1, background:'rgba(212,43,34,0.055)', border:'1.5px solid rgba(212,43,34,.4)', borderRadius:10, padding:'10px 0', textAlign:'center' }}>
                  <span style={{ color:'#150C09', fontSize:22, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>{form.photo_count}</span>
                  <span style={{ color:'rgba(122,98,89,0.88)', fontSize:13, marginLeft:6 }}>foto</span>
                </div>
                <button onClick={()=>setForm(p=>({...p,photo_count:Math.min(10,p.photo_count+1)}))}
                  style={{ width:36, height:36, borderRadius:9, background:'rgba(212,43,34,0.055)', border:'1px solid rgba(212,43,34,0.08)', color:'#150C09', fontSize:20, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  +
                </button>
              </div>
              {/* Quick picks */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[2,3,4,6,8,10].map(n => (
                  <button key={n} onClick={()=>setForm(p=>({...p,photo_count:n}))}
                    style={{ padding:'5px 12px', borderRadius:7, border:`1px solid ${form.photo_count===n?'rgba(212,43,34,.6)':'rgba(255,255,255,.09)'}`, background:form.photo_count===n?'rgba(212,43,34,.14)':'rgba(212,43,34,0.025)', color:form.photo_count===n?'#E83530':'rgba(122,98,89,0.88)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                    {n}
                  </button>
                ))}
              </div>
              <p style={{ color:'rgba(158,136,128,0.85)', fontSize:12, marginTop:8, fontFamily:'Poppins,sans-serif' }}>
                Maksimal 10 foto per sesi
              </p>
            </div>

            {/* Output size */}
            <div>
              <label style={labelCls}>Ukuran Output</label>
              <select
                value={SIZE_PRESETS.find(p=>p.w===form.output_width&&p.h===form.output_height)?.label ?? 'custom'}
                onChange={e => {
                  const p = SIZE_PRESETS.find(x=>x.label===e.target.value)
                  if (p) setForm(prev=>({...prev, output_width:p.w, output_height:p.h}))
                }}
                style={{...inputCls, width:'100%', cursor:'pointer', marginBottom:8}}
                onFocus={e=>e.target.style.borderColor='rgba(212,43,34,.6)'}
                onBlur={e=>e.target.style.borderColor='rgba(212,43,34,0.08)'}
              >
                {SIZE_PRESETS.map(p=>(
                  <option key={p.label} value={p.label}>
                    {p.label} — {p.w}×{p.h}px
                  </option>
                ))}
                {!SIZE_PRESETS.find(p=>p.w===form.output_width&&p.h===form.output_height) && (
                  <option value="custom">Custom — {form.output_width}×{form.output_height}px</option>
                )}
              </select>
              {/* Manual override */}
              <div style={{ display:'flex', gap:10, alignItems:'center', marginBottom:4 }}>
                <input type="number" value={form.output_width} onChange={e=>setForm(p=>({...p,output_width:Number(e.target.value)}))} style={{...inputCls,flex:1}}
                  onFocus={e=>e.target.style.borderColor='rgba(212,43,34,.6)'}
                  onBlur={e=>e.target.style.borderColor='rgba(212,43,34,0.08)'}/>
                <span style={{color:'rgba(158,136,128,0.95)',fontSize:18,flexShrink:0}}>×</span>
                <input type="number" value={form.output_height} onChange={e=>setForm(p=>({...p,output_height:Number(e.target.value)}))} style={{...inputCls,flex:1}}
                  onFocus={e=>e.target.style.borderColor='rgba(212,43,34,.6)'}
                  onBlur={e=>e.target.style.borderColor='rgba(212,43,34,0.08)'}/>
              </div>
              <p style={{ color:'rgba(158,136,128,0.85)', fontSize:11, fontFamily:'Poppins,sans-serif', marginBottom:4 }}>4R=300dpi · A5=300dpi · A4=300dpi</p>
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {SIZE_PRESETS.map(p => (
                  <button key={p.label} onClick={()=>setForm(prev=>({...prev,output_width:p.w,output_height:p.h}))}
                    style={{ padding:'5px 12px', background: form.output_width===p.w&&form.output_height===p.h ? 'rgba(212,43,34,.18)' : 'rgba(212,43,34,0.04)', border: form.output_width===p.w&&form.output_height===p.h ? '1px solid rgba(212,43,34,.4)' : '1px solid rgba(255,255,255,.09)', borderRadius:6, color: form.output_width===p.w&&form.output_height===p.h ? '#E83530' : 'rgba(122,98,89,0.88)', fontSize:12, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {error && (
              <div style={{ padding:'10px 14px', borderRadius:9, background:'rgba(239,68,68,.08)', border:'1px solid rgba(239,68,68,.15)', color:'#B82018', fontSize:13, display:'flex', gap:7, alignItems:'center' }}>
                <AlertCircle size={13}/>{error}
              </div>
            )}

            <div style={{ display:'flex', gap:10 }}>
              <button onClick={()=>{setView('list');resetCreate()}}
                style={{ flex:1, padding:'11px', background:'rgba(212,43,34,0.05)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:10, color:'rgba(74,46,34,0.9)', fontSize:14, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                Batal
              </button>
              <button onClick={handleCreate} disabled={loading}
                style={{ flex:2, padding:'11px', background:'linear-gradient(135deg,#E83530,#C02018)', border:'none', borderRadius:10, color:'#fff', fontSize:14, fontWeight:600, cursor:loading?'not-allowed':'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:7, opacity:loading?.7:1, fontFamily:"'Poppins',sans-serif", boxShadow:'0 4px 14px rgba(212,43,34,.3)' }}>
                {loading?<><Loader2 size={14} style={{animation:'spin 1s linear infinite'}}/>Uploading...</>:<><Upload size={14}/>Simpan Frame</>}
              </button>
            </div>
          </div>

          {/* RIGHT — Slot editor */}
          {preview && (
            <div style={{ background:'rgba(212,43,34,0.03)', border:'1px solid rgba(212,43,34,0.06)', borderRadius:16, padding:22 }}>
              <div style={{ marginBottom:14, display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
                <div>
                  <p style={{ color:'#150C09', fontSize:15, fontWeight:600, fontFamily:'Poppins,sans-serif', marginBottom:3 }}>Atur Posisi Slot Foto</p>
                  <p style={{ color:'rgba(122,98,89,0.88)', fontSize:13 }}>
                    Sesuaikan slot untuk <strong style={{color:'#E83530'}}>{form.photo_count} foto</strong>
                  </p>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10, background:'rgba(212,43,34,0.04)', border:'1px solid rgba(212,43,34,0.06)', borderRadius:9, padding:'7px 14px' }}>
                  <div style={{ width:64, height:5, borderRadius:3, background:'rgba(212,43,34,0.07)', overflow:'hidden' }}>
                    <div style={{ height:'100%', borderRadius:3, transition:'width .3s', background:pendingSlots.length>0?'#D42B22':'rgba(212,43,34,0.08)', width:`${Math.min(100,(pendingSlots.length/Math.max(1,form.photo_count))*100)}%` }}/>
                  </div>
                  <span style={{ color:'rgba(74,46,34,0.9)', fontSize:13, fontWeight:700, fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>
                    {pendingSlots.length} slot
                  </span>
                </div>
              </div>

              <FrameSlotEditor
                frameUrl={preview}
                outputWidth={form.output_width}
                outputHeight={form.output_height}
                photoCount={form.photo_count}
                defaultSlotCount={form.photo_count}
                initialSlots={null}
                onChange={setPendingSlots}
              />
            </div>
          )}
        </div>
      </div>
    )
  }

  // ══════════════════════
  // VIEW: LIST
  // ══════════════════════
  return (
    <div style={{ fontFamily:"'Poppins',sans-serif", padding:'28px 32px', maxWidth:1200, margin:'0 auto' }}>
      <style>{`
        @keyframes fade-up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
        @keyframes spin{to{transform:rotate(360deg)}}
        .fc{transition:transform .18s,box-shadow .18s;}
        .fc:hover{transform:translateY(-3px);box-shadow:0 14px 36px rgba(0,0,0,.45)!important;}
      `}</style>

      {/* Header */}
      <div style={{ marginBottom:28, display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14, flexWrap:'wrap' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:9, marginBottom:6 }}>
            <div style={{ width:3, height:20, borderRadius:2, background:'linear-gradient(to bottom,#E83530,#D42B22)' }}/>
            <p style={{ color:'rgba(122,98,89,0.8)', fontSize:11, fontWeight:600, letterSpacing:'2px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif' }}>Admin</p>
          </div>
          <h1 style={{ color:'#150C09', fontSize:28, fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:4 }}>Manajemen Frame</h1>
          <p style={{ color:'rgba(122,98,89,0.88)', fontSize:14 }}>{frames.length} frame tersedia</p>
        </div>
        <button onClick={()=>{resetCreate();setView('create')}}
          style={{ display:'flex', alignItems:'center', gap:8, background:'linear-gradient(135deg,#E83530,#C02018)', border:'none', borderRadius:12, padding:'11px 20px', color:'#fff', fontSize:14, fontWeight:600, cursor:'pointer', boxShadow:'0 4px 16px rgba(212,43,34,.35)', fontFamily:"'Poppins',sans-serif" }}>
          <Plus size={16}/>Upload Frame
        </button>
      </div>

      {successMsg && (
        <div style={{ marginBottom:16, padding:'10px 16px', borderRadius:11, background:'rgba(16,185,129,.1)', border:'1px solid rgba(16,185,129,.2)', color:'#059669', fontSize:14, display:'flex', alignItems:'center', gap:9 }}>
          <Check size={14}/>{successMsg}
        </div>
      )}

      {frames.length === 0 ? (
        <div style={{ border:'2px dashed rgba(212,43,34,0.06)', borderRadius:18, padding:'72px 32px', textAlign:'center' }}>
          <ImageIcon size={48} color="rgba(212,43,34,0.08)" style={{margin:'0 auto 16px'}}/>
          <p style={{color:'rgba(158,136,128,0.95)',fontSize:16,fontWeight:500}}>Belum ada frame</p>
          <p style={{color:'rgba(212,43,34,0.10)',fontSize:13,marginTop:6}}>Klik "Upload Frame" untuk menambahkan</p>
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:18 }}>
          {frames.map((frame, i) => (
            <div key={frame.id} className="fc"
              style={{ background:'rgba(212,43,34,0.05)', backdropFilter:'blur(20px)', border:'1px solid rgba(212,43,34,0.07)', borderRadius:16, overflow:'hidden', boxShadow:'0 4px 14px rgba(0,0,0,.28)', position:'relative', animation:'fade-up .35s ease both', animationDelay:`${i*.04}s` }}>

              <div style={{ position:'absolute', top:9, left:9, right:9, zIndex:2, display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:5 }}>
                <div style={{ background:frame.photo_slots?'rgba(212,43,34,.9)':'rgba(245,158,11,.85)', borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, color:'#150C09' }}>
                  {frame.photo_slots ? `${frame.photo_slots.length} slot` : 'No slot'}
                </div>
                <div style={{ background:frame.is_active?'rgba(16,185,129,.9)':'rgba(239,68,68,.85)', borderRadius:6, padding:'3px 8px', fontSize:11, fontWeight:700, color:'#150C09' }}>
                  {frame.is_active ? 'AKTIF' : 'OFF'}
                </div>
              </div>

              <div style={{ height:200, background:'rgba(0,0,0,.25)', display:'flex', alignItems:'center', justifyContent:'center', overflow:'hidden' }}>
                <img src={frame.image_url} alt={frame.name}
                  style={{width:'100%',height:'100%',objectFit:'contain',padding:8}}
                  onError={e=>{(e.target as HTMLImageElement).style.display='none'}}/>
              </div>

              <div style={{ padding:'13px 15px' }}>
                <p style={{ color:'#150C09', fontSize:14, fontWeight:600, marginBottom:8, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{frame.name}</p>
                <div style={{ display:'flex', gap:5, flexWrap:'wrap', marginBottom:11 }}>
                  <span style={{ background:'rgba(212,43,34,.15)', color:'#E83530', border:'1px solid rgba(212,43,34,.2)', borderRadius:6, padding:'3px 8px', fontSize:12, fontWeight:600 }}>
                    {frame.photo_count} foto
                  </span>
                  <span style={{ background:'rgba(212,43,34,0.05)', color:'rgba(122,98,89,0.8)', border:'1px solid rgba(212,43,34,0.06)', borderRadius:6, padding:'3px 8px', fontSize:12 }}>
                    {frame.output_width}x{frame.output_height}
                  </span>
                </div>

                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={()=>{setEditingFrame(frame);setPendingSlots(frame.photo_slots??[]);setView('edit-slots');setError('')}}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'7px 0', background:'rgba(212,43,34,.1)', border:'1px solid rgba(212,43,34,.2)', borderRadius:8, color:'#E83530', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                    <Settings2 size={12}/>Slot
                  </button>
                  <button onClick={()=>handleToggle(frame.id,frame.is_active)} disabled={toggleLoading===frame.id}
                    style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', gap:4, padding:'7px 0', background:frame.is_active?'rgba(239,68,68,.08)':'rgba(16,185,129,.08)', border:`1px solid ${frame.is_active?'rgba(239,68,68,.2)':'rgba(16,185,129,.2)'}`, borderRadius:8, color:frame.is_active?'#B82018':'#059669', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                    {toggleLoading===frame.id?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Power size={12}/>}
                    {frame.is_active?'Off':'On'}
                  </button>
                  <button onClick={()=>handleDelete(frame.id,frame.image_url)} disabled={deleteLoading===frame.id}
                    style={{ width:34, display:'flex', alignItems:'center', justifyContent:'center', background:'rgba(239,68,68,.07)', border:'1px solid rgba(239,68,68,.14)', borderRadius:8, color:'#B82018', cursor:'pointer' }}>
                    {deleteLoading===frame.id?<Loader2 size={12} style={{animation:'spin 1s linear infinite'}}/>:<Trash2 size={12}/>}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}