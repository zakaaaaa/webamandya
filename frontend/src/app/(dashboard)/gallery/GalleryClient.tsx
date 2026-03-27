'use client'

import { useState, useCallback, useTransition } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import {
  Images, Download, Search, Filter, X, ChevronLeft, ChevronRight,
  Calendar, Monitor, ZoomIn, ExternalLink, CheckSquare, Square,
  DownloadCloud, Eye, Clock, Camera, Layers
} from 'lucide-react'

type Session = {
  id: string
  transaction_code: string
  created_at: string
  result_url: string | null
  payment_status: string
  payment_method: string
  devices: { id: string; device_name: string } | null
  clients: { name: string } | null
  photos: { photo_url: string; photo_order: number }[]
}

type Device = { id: string; device_name: string }

type Props = {
  sessions: Session[]
  devices: Device[]
  totalCount: number
  totalPages: number
  currentPage: number
  isSuperAdmin: boolean
  filters: { device: string; date: string; search: string }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  paid:    { bg:'rgba(16,185,129,0.1)',  color:'#34d399', border:'rgba(16,185,129,0.2)'  },
  pending: { bg:'rgba(245,158,11,0.1)',  color:'#fbbf24', border:'rgba(245,158,11,0.2)'  },
  free:    { bg:'rgba(99,102,241,0.1)',  color:'#a5b4fc', border:'rgba(99,102,241,0.2)'  },
  bypass:  { bg:'rgba(99,102,241,0.1)',  color:'#a5b4fc', border:'rgba(99,102,241,0.2)'  },
  expired: { bg:'rgba(239,68,68,0.1)',   color:'#f87171', border:'rgba(239,68,68,0.2)'   },
  failed:  { bg:'rgba(239,68,68,0.1)',   color:'#f87171', border:'rgba(239,68,68,0.2)'   },
}

export default function GalleryClient({
  sessions, devices, totalCount, totalPages, currentPage, isSuperAdmin, filters
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const [isPending, startTransition] = useTransition()

  const [lightbox, setLightbox]       = useState<Session | null>(null)
  const [lightboxTab, setLightboxTab] = useState<'strip'|'photos'>('strip')
  const [selected, setSelected]       = useState<Set<string>>(new Set())
  const [selectMode, setSelectMode]   = useState(false)
  const [downloading, setDownloading] = useState<string | null>(null)
  const [bulkDownloading, setBulkDl]  = useState(false)
  const [localSearch, setLocalSearch] = useState(filters.search)

  const pushFilter = useCallback((updates: Record<string, string>) => {
    const sp     = new URLSearchParams()
    const merged = { ...filters, page: '1', ...updates }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }, [filters, pathname, router])

  const goPage = (p: number) => {
    const sp     = new URLSearchParams()
    const merged = { ...filters, page: String(p) }
    Object.entries(merged).forEach(([k, v]) => { if (v) sp.set(k, v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  const downloadFile = async (url: string, filename: string) => {
    try {
      const res  = await fetch(url)
      const blob = await res.blob()
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = filename
      a.click()
      URL.revokeObjectURL(a.href)
    } catch (e) { console.error(e) }
  }

  const handleDownloadStrip = async (s: Session) => {
    if (!s.result_url) return
    setDownloading(s.id)
    await downloadFile(s.result_url, `strip_${s.transaction_code.slice(0,12)}.png`)
    setDownloading(null)
  }

  const handleBulkDownload = async () => {
    if (selected.size === 0) return
    setBulkDl(true)
    const toDownload = sessions.filter(s => selected.has(s.id) && s.result_url)
    for (const s of toDownload) {
      await downloadFile(s.result_url!, `strip_${s.transaction_code.slice(0,12)}.png`)
      await new Promise(r => setTimeout(r, 300))
    }
    setBulkDl(false)
    setSelected(new Set())
    setSelectMode(false)
  }

  const toggleSelect = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  const selectAll = () => {
    if (selected.size === sessions.length) setSelected(new Set())
    else setSelected(new Set(sessions.map(s => s.id)))
  }

  const formatDate      = (d: string) => new Date(d).toLocaleString('id-ID', { dateStyle:'medium', timeStyle:'short' })
  const formatDateShort = (d: string) => new Date(d).toLocaleString('id-ID', { day:'2-digit', month:'short', hour:'2-digit', minute:'2-digit' })

  const activeFilterCount = [filters.device, filters.date, filters.search].filter(Boolean).length

  return (
    <>
      <style>{`
        @keyframes fade-up  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes scale-in { from{opacity:0;transform:scale(.94)} to{opacity:1;transform:scale(1)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .page-header  { animation:fade-up .45s ease both }
        .toolbar-row  { animation:fade-up .45s ease .08s both }
        .gallery-grid { animation:fade-up .45s ease .16s both }
        .pager-row    { animation:fade-up .45s ease .24s both }
        .card-item    { animation:scale-in .35s ease both }
        .card-item:hover .card-overlay { opacity:1!important }
        .card-item:hover .card-img     { transform:scale(1.04) }
        .card-item.selected            { outline:2px solid #6366f1; outline-offset:2px }
        .lb-backdrop { animation:fade-in .15s ease both }
        .lb-content  { animation:scale-in .2s ease both }
        .btn-icon { display:flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; border:1px solid transparent; font-family:'Plus Jakarta Sans',sans-serif; }
        .btn-icon:hover { filter:brightness(1.1); transform:translateY(-1px) }
        .btn-icon:active { transform:translateY(0) }
        .page-btn { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(255,255,255,.08); background:rgba(255,255,255,.04); color:rgba(255,255,255,.4); cursor:pointer; transition:all .15s; font-size:13px; font-weight:600; font-family:'Plus Jakarta Sans',sans-serif; }
        .page-btn:hover:not(:disabled) { background:rgba(99,102,241,.15); border-color:rgba(99,102,241,.3); color:#a5b4fc }
        .page-btn.active { background:linear-gradient(135deg,#6366f1,#8b5cf6); border-color:transparent; color:white }
        .page-btn:disabled { opacity:.3; cursor:default }
        .input-field { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-radius:10px; color:white; font-size:13px; padding:8px 12px 8px 36px; outline:none; transition:all .2s; font-family:'Plus Jakarta Sans',sans-serif; width:100%; }
        .input-field::placeholder { color:rgba(255,255,255,.25) }
        .input-field:focus { border-color:rgba(99,102,241,.4); background:rgba(255,255,255,.08); box-shadow:0 0 0 3px rgba(99,102,241,.1) }
        .select-field { background:rgba(255,255,255,.06); border:1px solid rgba(255,255,255,.08); border-radius:10px; color:rgba(255,255,255,.7); font-size:13px; padding:8px 12px; outline:none; cursor:pointer; font-family:'Plus Jakarta Sans',sans-serif; }
        .select-field:focus { border-color:rgba(99,102,241,.4) }
        option { background:#1a1535; color:white }
        @media (max-width:768px) { .gallery-grid-inner { grid-template-columns:repeat(2,1fr)!important } }
      `}</style>

      <div style={{ fontFamily:"'Plus Jakarta Sans',sans-serif", minHeight:'100vh' }}>

        {/* PAGE HEADER */}
        <div className="page-header" style={{ marginBottom:'28px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
            <div style={{ width:'3px', height:'20px', borderRadius:'2px', background:'linear-gradient(to bottom,#6366f1,#8b5cf6)' }}/>
            <p style={{ color:'rgba(255,255,255,.3)', fontSize:'11px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif' }}>
              {isSuperAdmin ? 'Super Admin' : 'Admin'} · Gallery
            </p>
          </div>
          <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <h1 style={{ color:'white', fontSize:'28px', fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:'4px' }}>Galeri Foto</h1>
              <p style={{ color:'rgba(255,255,255,.3)', fontSize:'14px' }}>{totalCount.toLocaleString('id-ID')} hasil foto tersimpan</p>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8 }}>
              {selectMode && selected.size > 0 && (
                <button className="btn-icon" disabled={bulkDownloading} onClick={handleBulkDownload}
                  style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white', boxShadow:'0 4px 16px rgba(99,102,241,.3)' }}>
                  {bulkDownloading
                    ? <><div style={{ width:13,height:13,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin .8s linear infinite' }}/>{selected.size} file...</>
                    : <><DownloadCloud size={14}/>{selected.size} Download</>}
                </button>
              )}
              {selectMode && (
                <button className="btn-icon" onClick={selectAll}
                  style={{ background:'rgba(255,255,255,.06)', color:'rgba(255,255,255,.6)', border:'1px solid rgba(255,255,255,.1)' }}>
                  {selected.size === sessions.length ? <CheckSquare size={14}/> : <Square size={14}/>}
                  {selected.size === sessions.length ? 'Batal Semua' : 'Pilih Semua'}
                </button>
              )}
              <button className="btn-icon"
                onClick={() => { setSelectMode(v => !v); setSelected(new Set()) }}
                style={{ background:selectMode?'rgba(239,68,68,.1)':'rgba(255,255,255,.06)', color:selectMode?'#f87171':'rgba(255,255,255,.6)', border:selectMode?'1px solid rgba(239,68,68,.2)':'1px solid rgba(255,255,255,.1)' }}>
                {selectMode ? <><X size={14}/>Batal</> : <><CheckSquare size={14}/>Pilih</>}
              </button>
            </div>
          </div>
        </div>

        {/* TOOLBAR */}
        <div className="toolbar-row glass-card" style={{ padding:'14px 16px', marginBottom:'20px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
          <div style={{ position:'relative', flex:1, minWidth:200 }}>
            <Search size={14} style={{ position:'absolute', left:11, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.3)', pointerEvents:'none' }}/>
            <input className="input-field" placeholder="Cari kode transaksi..." value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              onKeyDown={e => { if (e.key==='Enter') pushFilter({ search:localSearch }) }}/>
          </div>
          <div style={{ position:'relative' }}>
            <Monitor size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.3)', pointerEvents:'none' }}/>
            <select className="select-field" style={{ paddingLeft:30 }} value={filters.device} onChange={e => pushFilter({ device:e.target.value })}>
              <option value="">Semua Perangkat</option>
              {devices.map(d => <option key={d.id} value={d.id}>{d.device_name}</option>)}
            </select>
          </div>
          <div style={{ position:'relative' }}>
            <Calendar size={13} style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'rgba(255,255,255,.3)', pointerEvents:'none' }}/>
            <input type="date" className="select-field" style={{ paddingLeft:30, colorScheme:'dark' }} value={filters.date} onChange={e => pushFilter({ date:e.target.value })}/>
          </div>
          {activeFilterCount > 0 && (
            <button className="btn-icon" onClick={() => { setLocalSearch(''); pushFilter({ device:'', date:'', search:'' }) }}
              style={{ background:'rgba(239,68,68,.08)', color:'#f87171', border:'1px solid rgba(239,68,68,.15)' }}>
              <X size={13}/>Reset ({activeFilterCount})
            </button>
          )}
          {isPending && <div style={{ width:16,height:16,border:'2px solid rgba(99,102,241,.3)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .8s linear infinite',flexShrink:0 }}/>}
          <div style={{ marginLeft:'auto', color:'rgba(255,255,255,.25)', fontSize:'12px', flexShrink:0 }}>{sessions.length} / {totalCount} foto</div>
        </div>

        {/* GALLERY GRID */}
        <div className="gallery-grid">
          {sessions.length === 0 ? (
            <div className="glass-card" style={{ padding:'80px 20px', textAlign:'center' }}>
              <div style={{ width:56,height:56,borderRadius:16,background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.15)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px' }}>
                <Images size={24} color="rgba(99,102,241,.6)"/>
              </div>
              <p style={{ color:'rgba(255,255,255,.4)', fontSize:'15px', fontWeight:500, marginBottom:6 }}>Belum ada foto</p>
              <p style={{ color:'rgba(255,255,255,.2)', fontSize:'13px' }}>{activeFilterCount > 0 ? 'Coba ubah filter pencarian' : 'Foto akan muncul setelah sesi selesai'}</p>
            </div>
          ) : (
            <div className="gallery-grid-inner" style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14 }}>
              {sessions.map((s, idx) => {
                const thumb      = s.result_url ?? s.photos[0]?.photo_url ?? null
                const isSelected = selected.has(s.id)
                const st         = STATUS_STYLE[s.payment_status] ?? STATUS_STYLE.failed
                return (
                  <div key={s.id} className={`card-item glass-card ${isSelected?'selected':''}`}
                    style={{ borderRadius:14, overflow:'hidden', cursor:'pointer', position:'relative', animationDelay:`${idx*.03}s`, transition:'transform .2s,box-shadow .2s' }}
                    onClick={() => { if (selectMode) toggleSelect(s.id); else { setLightbox(s); setLightboxTab('strip') } }}>
                    <div style={{ position:'relative', aspectRatio:'2/3', overflow:'hidden', background:'rgba(255,255,255,.03)' }}>
                      {thumb
                        ? <img src={thumb} alt="strip" className="card-img" style={{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'top',display:'block',transition:'transform .3s ease' }}/>
                        : <div style={{ width:'100%',height:'100%',display:'flex',alignItems:'center',justifyContent:'center' }}><Camera size={28} color="rgba(255,255,255,.1)"/></div>
                      }
                      <div className="card-overlay" style={{ position:'absolute',inset:0,opacity:0,transition:'opacity .2s',background:'linear-gradient(to top,rgba(0,0,0,.85) 0%,rgba(0,0,0,.2) 50%,transparent 100%)',display:'flex',flexDirection:'column',justifyContent:'flex-end',padding:12,gap:6 }}>
                        <div style={{ display:'flex', gap:6 }}>
                          <div style={{ flex:1,background:'rgba(255,255,255,.15)',backdropFilter:'blur(8px)',borderRadius:8,padding:'6px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:5,color:'white',fontSize:11,fontWeight:600 }}>
                            <Eye size={11}/>Lihat
                          </div>
                          {s.result_url && (
                            <div style={{ flex:1,background:'rgba(99,102,241,.6)',backdropFilter:'blur(8px)',borderRadius:8,padding:'6px 0',display:'flex',alignItems:'center',justifyContent:'center',gap:5,color:'white',fontSize:11,fontWeight:600 }}
                              onClick={e => { e.stopPropagation(); handleDownloadStrip(s) }}>
                              <Download size={11}/>Simpan
                            </div>
                          )}
                        </div>
                      </div>
                      {selectMode && (
                        <div style={{ position:'absolute',top:8,left:8,width:22,height:22,borderRadius:6,border:`2px solid ${isSelected?'#6366f1':'rgba(255,255,255,.5)'}`,background:isSelected?'#6366f1':'rgba(0,0,0,.4)',backdropFilter:'blur(4px)',display:'flex',alignItems:'center',justifyContent:'center' }}>
                          {isSelected && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      )}
                      {s.photos.length > 0 && (
                        <div style={{ position:'absolute',top:8,right:8,background:'rgba(0,0,0,.65)',backdropFilter:'blur(4px)',borderRadius:6,padding:'2px 7px',display:'flex',alignItems:'center',gap:4,color:'rgba(255,255,255,.8)',fontSize:10,fontWeight:700 }}>
                          <Layers size={9}/>{s.photos.length}
                        </div>
                      )}
                    </div>
                    <div style={{ padding:'10px 12px' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:4 }}>
                        <span style={{ background:st.bg, color:st.color, border:`1px solid ${st.border}`, borderRadius:6, padding:'2px 8px', fontSize:10, fontWeight:700, textTransform:'capitalize' as const }}>
                          {s.payment_status}
                        </span>
                        {downloading === s.id && <div style={{ width:12,height:12,border:'2px solid rgba(99,102,241,.3)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .8s linear infinite' }}/>}
                      </div>
                      <p style={{ color:'rgba(255,255,255,.5)',fontSize:11,fontFamily:'monospace',marginBottom:2,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' }}>
                        {s.transaction_code.slice(0,20)}…
                      </p>
                      <div style={{ display:'flex', alignItems:'center', gap:4, color:'rgba(255,255,255,.25)', fontSize:10 }}>
                        <Clock size={9}/>{formatDateShort(s.created_at)}
                      </div>
                      {s.devices && (
                        <div style={{ display:'flex', alignItems:'center', gap:4, color:'rgba(255,255,255,.2)', fontSize:10, marginTop:2 }}>
                          <Monitor size={9}/>{s.devices.device_name}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="pager-row" style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:6, marginTop:28 }}>
            <button className="page-btn" disabled={currentPage<=1} onClick={() => goPage(currentPage-1)}><ChevronLeft size={14}/></button>
            {Array.from({ length:totalPages },(_,i)=>i+1)
              .filter(p => p===1 || p===totalPages || Math.abs(p-currentPage)<=2)
              .reduce<(number|'...')[]>((acc,p,i,arr) => {
                if (i>0 && p-(arr[i-1] as number)>1) acc.push('...')
                acc.push(p); return acc
              },[])
              .map((p,i) => p==='...'
                ? <span key={`d${i}`} style={{ color:'rgba(255,255,255,.2)',fontSize:12,padding:'0 4px' }}>…</span>
                : <button key={p} className={`page-btn ${p===currentPage?'active':''}`} onClick={() => goPage(p as number)}>{p}</button>
              )
            }
            <button className="page-btn" disabled={currentPage>=totalPages} onClick={() => goPage(currentPage+1)}><ChevronRight size={14}/></button>
            <span style={{ color:'rgba(255,255,255,.2)', fontSize:12, marginLeft:8 }}>Hal. {currentPage} / {totalPages}</span>
          </div>
        )}
      </div>

      {/* LIGHTBOX */}
      {lightbox && (
        <div className="lb-backdrop" onClick={() => setLightbox(null)}
          style={{ position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.92)',backdropFilter:'blur(16px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20 }}>
          <div className="lb-content" onClick={e => e.stopPropagation()}
            style={{ background:'rgba(15,12,30,.95)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,width:'100%',maxWidth:820,maxHeight:'90vh',overflow:'hidden',display:'flex',flexDirection:'column' }}>
            {/* Header */}
            <div style={{ padding:'16px 20px',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0 }}>
              <div>
                <p style={{ color:'rgba(255,255,255,.3)',fontSize:'10px',letterSpacing:'2px',textTransform:'uppercase',fontFamily:'Poppins,sans-serif',marginBottom:2 }}>Detail Sesi</p>
                <p style={{ color:'white',fontSize:'14px',fontWeight:600,fontFamily:'monospace' }}>{lightbox.transaction_code}</p>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <a href={`/download/${lightbox.transaction_code}`} target="_blank" rel="noopener noreferrer"
                  style={{ display:'flex',alignItems:'center',gap:6,padding:'7px 12px',borderRadius:9,background:'rgba(99,102,241,.12)',border:'1px solid rgba(99,102,241,.2)',color:'#a5b4fc',fontSize:12,fontWeight:600,textDecoration:'none' }}>
                  <ExternalLink size={12}/>Halaman Download
                </a>
                {lightbox.result_url && (
                  <button className="btn-icon" onClick={() => handleDownloadStrip(lightbox)}
                    style={{ background:'linear-gradient(135deg,#6366f1,#8b5cf6)', color:'white' }}>
                    <Download size={13}/>Download Strip
                  </button>
                )}
                <button onClick={() => setLightbox(null)}
                  style={{ width:32,height:32,borderRadius:8,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.5)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',fontSize:16 }}>✕</button>
              </div>
            </div>
            {/* Body */}
            <div style={{ display:'flex', flex:1, overflow:'hidden', minHeight:0 }}>
              {/* Kiri — gambar */}
              <div style={{ flex:1, overflow:'auto', padding:20, display:'flex', flexDirection:'column', gap:12 }}>
                <div style={{ display:'flex', gap:6 }}>
                  {(['strip','photos'] as const).map(tab => (
                    <button key={tab} onClick={() => setLightboxTab(tab)}
                      style={{ padding:'6px 14px',borderRadius:8,border:'1px solid',fontSize:12,fontWeight:600,cursor:'pointer',background:lightboxTab===tab?'rgba(99,102,241,.2)':'rgba(255,255,255,.04)',borderColor:lightboxTab===tab?'rgba(99,102,241,.4)':'rgba(255,255,255,.08)',color:lightboxTab===tab?'#a5b4fc':'rgba(255,255,255,.3)',fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                      {tab==='strip' ? '📸 Strip' : `🖼 ${lightbox.photos.length} Foto`}
                    </button>
                  ))}
                </div>
                {lightboxTab==='strip' ? (
                  lightbox.result_url
                    ? <img src={lightbox.result_url} alt="Strip" style={{ maxWidth:'100%',maxHeight:'65vh',objectFit:'contain',borderRadius:10,border:'1px solid rgba(255,255,255,.06)',display:'block',margin:'0 auto' }}/>
                    : <div style={{ flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'rgba(255,255,255,.2)',fontSize:14 }}>Strip belum tersedia</div>
                ) : (
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:8 }}>
                    {lightbox.photos.map((p,i) => (
                      <div key={i} style={{ position:'relative',borderRadius:8,overflow:'hidden',aspectRatio:'1' }}>
                        <img src={p.photo_url} alt={`Foto ${i+1}`} style={{ width:'100%',height:'100%',objectFit:'cover',objectPosition:'top',display:'block' }}/>
                        <div style={{ position:'absolute',top:6,left:6,background:'rgba(0,0,0,.65)',borderRadius:5,padding:'1px 6px',color:'rgba(255,255,255,.8)',fontSize:10,fontWeight:700 }}>{i+1}</div>
                        <button onClick={() => downloadFile(p.photo_url, `foto_${i+1}_${lightbox.transaction_code.slice(0,8)}.jpg`)}
                          style={{ position:'absolute',bottom:6,right:6,background:'rgba(0,0,0,.65)',backdropFilter:'blur(4px)',border:'1px solid rgba(255,255,255,.15)',borderRadius:6,padding:'4px 8px',color:'white',fontSize:10,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontFamily:"'Plus Jakarta Sans',sans-serif" }}>
                          <Download size={9}/>Simpan
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {/* Kanan — meta */}
              <div style={{ width:220,borderLeft:'1px solid rgba(255,255,255,.06)',padding:20,flexShrink:0,overflow:'auto',display:'flex',flexDirection:'column',gap:16 }}>
                <div>
                  <p style={{ color:'rgba(255,255,255,.2)',fontSize:'10px',letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'Poppins,sans-serif',marginBottom:10 }}>Info Sesi</p>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {([
                      { label:'Status',    value:lightbox.payment_status, badge:true  },
                      { label:'Metode',    value:lightbox.payment_method,  badge:false },
                      { label:'Perangkat', value:lightbox.devices?.device_name??'—',  badge:false },
                      ...(isSuperAdmin ? [{ label:'Client', value:lightbox.clients?.name??'—', badge:false }] : []),
                      { label:'Waktu',     value:formatDate(lightbox.created_at),     badge:false },
                      { label:'Foto',      value:`${lightbox.photos.length} foto`,    badge:false },
                    ] as { label:string; value:string; badge:boolean }[]).map(({ label,value,badge }) => {
                      const st2 = STATUS_STYLE[value] ?? STATUS_STYLE.failed
                      return (
                        <div key={label}>
                          <p style={{ color:'rgba(255,255,255,.25)',fontSize:10,marginBottom:3 }}>{label}</p>
                          {badge
                            ? <span style={{ background:st2.bg,color:st2.color,border:`1px solid ${st2.border}`,borderRadius:6,padding:'2px 8px',fontSize:11,fontWeight:700,textTransform:'capitalize',display:'inline-block' }}>{value}</span>
                            : <p style={{ color:'rgba(255,255,255,.65)',fontSize:12,fontWeight:500 }}>{value}</p>
                          }
                        </div>
                      )
                    })}
                  </div>
                </div>
                {lightbox.photos.length > 0 && (
                  <button className="btn-icon"
                    onClick={async () => {
                      for (const p of lightbox.photos) {
                        await downloadFile(p.photo_url, `foto_${p.photo_order+1}_${lightbox.transaction_code.slice(0,8)}.jpg`)
                        await new Promise(r => setTimeout(r,250))
                      }
                    }}
                    style={{ background:'rgba(16,185,129,.08)',color:'#34d399',border:'1px solid rgba(16,185,129,.15)',width:'100%',justifyContent:'center' }}>
                    <Download size={13}/>Download Semua Foto
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
