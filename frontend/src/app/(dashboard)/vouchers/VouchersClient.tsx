'use client'

import { useState, useTransition, useCallback } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Ticket, Plus, Search, X, Copy, Check, RefreshCw, Trash2,
  ChevronLeft, ChevronRight, ToggleLeft, ToggleRight,
  Sparkles, Clock, Hash, Percent, Gift, AlertCircle, Printer
} from 'lucide-react'

type Voucher = {
  id: string; code: string; discount_type: 'full'|'percent'|'fixed'
  discount_value: number; max_uses: number|null; used_count: number
  valid_until: string|null; is_active: boolean; created_at: string; client_id: string
}
type Stats = { totalActive:number; totalUsed:number; usedToday:number; total:number }
type Props = {
  vouchers: Voucher[]; totalCount:number; totalPages:number; currentPage:number
  clientId:string; stats:Stats; filters:{ status:string; search:string }
}

const generateCode = (prefix='') => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  const rand  = Array.from({length:8},()=>chars[Math.floor(Math.random()*chars.length)]).join('')
  return prefix ? `${prefix.toUpperCase()}-${rand}` : rand
}
const generateBulkCodes = (count:number, prefix='') => {
  const codes = new Set<string>()
  while (codes.size < count) codes.add(generateCode(prefix))
  return [...codes]
}

export default function VouchersClient({ vouchers, totalCount, totalPages, currentPage, clientId, stats, filters }: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [modal, setModal]         = useState<'single'|'bulk'|'print'|null>(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
  const [form, setForm]           = useState({ code:generateCode(), discount_type:'full' as any, discount_value:0, max_uses:1, valid_until:'', unlimited_uses:true, no_expiry:true })
  const [bulk, setBulk]           = useState({ prefix:'', count:10, discount_type:'full' as any, discount_value:0, max_uses:1, valid_until:'', no_expiry:true })
  const [printCodes, setPrintCodes] = useState<string[]>([])
  const [copiedId, setCopiedId]   = useState<string|null>(null)
  const [localSearch, setLocalSearch] = useState(filters.search)
  const [togglingId, setTogglingId]   = useState<string|null>(null)
  const [deletingId, setDeletingId]   = useState<string|null>(null)

  const pushFilter = useCallback((updates: Record<string,string>) => {
    const sp = new URLSearchParams()
    Object.entries({ ...filters, page:'1', ...updates }).forEach(([k,v]) => { if(v) sp.set(k,v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }, [filters, pathname, router])

  const goPage = (p:number) => {
    const sp = new URLSearchParams()
    Object.entries({ ...filters, page:String(p) }).forEach(([k,v]) => { if(v) sp.set(k,v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  const copyCode = async (code:string, id:string) => {
    await navigator.clipboard.writeText(code)
    setCopiedId(id); setTimeout(()=>setCopiedId(null),2000)
  }

  const handleCreateSingle = async () => {
    if (!form.code.trim()) { setError('Kode tidak boleh kosong'); return }
    setSaving(true); setError('')
    try {
      const { error:err } = await supabase.from('vouchers').insert({
        code: form.code.trim().toUpperCase(), client_id: clientId,
        discount_type: form.discount_type,
        discount_value: form.discount_type==='full' ? 100 : form.discount_value,
        max_uses: form.unlimited_uses ? null : form.max_uses,
        valid_until: form.no_expiry ? null : form.valid_until || null,
        is_active: true, used_count: 0,
      })
      if (err) throw new Error(err.message)
      setSuccess('Voucher berhasil dibuat!'); setModal(null)
      startTransition(() => router.refresh())
    } catch(e:any) { setError(e.message.includes('duplicate')?'Kode sudah dipakai.':e.message) }
    finally { setSaving(false) }
  }

  const handleCreateBulk = async () => {
    if (bulk.count<1||bulk.count>500) { setError('Jumlah 1–500'); return }
    setSaving(true); setError('')
    try {
      const codes = generateBulkCodes(bulk.count, bulk.prefix)
      const { error:err } = await supabase.from('vouchers').insert(codes.map(code => ({
        code, client_id:clientId, discount_type:bulk.discount_type,
        discount_value: bulk.discount_type==='full'?100:bulk.discount_value,
        max_uses:1, valid_until: bulk.no_expiry?null:bulk.valid_until||null,
        is_active:true, used_count:0,
      })))
      if (err) throw new Error(err.message)
      setPrintCodes(codes); setModal('print')
      startTransition(() => router.refresh())
    } catch(e:any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const handleToggle = async (v:Voucher) => {
    setTogglingId(v.id)
    await supabase.from('vouchers').update({ is_active:!v.is_active }).eq('id',v.id)
    setTogglingId(null); startTransition(()=>router.refresh())
  }

  const handleDelete = async (id:string) => {
    if (!confirm('Hapus voucher ini?')) return
    setDeletingId(id)
    await supabase.from('vouchers').delete().eq('id',id)
    setDeletingId(null); startTransition(()=>router.refresh())
  }

  const formatDate = (d:string|null) => d ? new Date(d).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'}) : '∞ Selamanya'
  const isExpired  = (v:Voucher) => v.valid_until && new Date(v.valid_until) < new Date()
  const isFull     = (v:Voucher) => v.max_uses !== null && v.used_count >= v.max_uses

  const discountLabel = (v:Voucher) => v.discount_type==='full'?'GRATIS':v.discount_type==='percent'?`${v.discount_value}% OFF`:`Rp ${Number(v.discount_value).toLocaleString('id-ID')}`
  const discountColor = (v:Voucher) => v.discount_type==='full'
    ? { bg:'rgba(16,185,129,.12)',  color:'#34d399', border:'rgba(16,185,129,.2)' }
    : v.discount_type==='percent'
    ? { bg:'rgba(99,102,241,.12)',  color:'#a5b4fc', border:'rgba(99,102,241,.2)' }
    : { bg:'rgba(245,158,11,.12)', color:'#fbbf24', border:'rgba(245,158,11,.2)' }
  const usagePct = (v:Voucher) => v.max_uses ? Math.min(100,(v.used_count/v.max_uses)*100) : 0

  return (
    <>
      <style>{`
        @keyframes fade-up  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes scale-in { from{opacity:0;transform:scale(.96)} to{opacity:1;transform:scale(1)} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .ph{animation:fade-up .45s ease both} .sh{animation:fade-up .45s ease .06s both} .tb{animation:fade-up .45s ease .12s both} .tbl{animation:fade-up .45s ease .18s both}
        .modal-bg{animation:fade-in .15s ease both} .modal-box{animation:scale-in .2s ease both}
        .vrow:hover{background:rgba(255,255,255,.025)}
        .btn{display:flex;align-items:center;gap:6px;padding:8px 16px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;border:1px solid transparent;font-family:'Plus Jakarta Sans',sans-serif}
        .btn:hover:not(:disabled){filter:brightness(1.1);transform:translateY(-1px)} .btn:active{transform:translateY(0)} .btn:disabled{opacity:.4;cursor:not-allowed;transform:none;filter:none}
        .inp{width:100%;background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.1);border-radius:10px;color:white;font-size:13px;padding:9px 13px;outline:none;transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif}
        .inp::placeholder{color:rgba(255,255,255,.25)} .inp:focus{border-color:rgba(99,102,241,.5);box-shadow:0 0 0 3px rgba(99,102,241,.12)}
        .inp-label{color:rgba(255,255,255,.4);font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;margin-bottom:6px;display:block;font-family:'Poppins',sans-serif}
        .seg{display:flex;border-radius:10px;overflow:hidden;border:1px solid rgba(255,255,255,.1);background:rgba(255,255,255,.04)}
        .seg-btn{flex:1;padding:8px 4px;font-size:12px;font-weight:600;cursor:pointer;border:none;background:transparent;color:rgba(255,255,255,.35);transition:all .15s;font-family:'Plus Jakarta Sans',sans-serif}
        .seg-btn.active{background:linear-gradient(135deg,rgba(99,102,241,.3),rgba(139,92,246,.2));color:white}
        .page-btn{width:32px;height:32px;border-radius:8px;display:flex;align-items:center;justify-content:center;border:1px solid rgba(255,255,255,.08);background:rgba(255,255,255,.04);color:rgba(255,255,255,.4);cursor:pointer;transition:all .15s;font-size:13px;font-weight:600}
        .page-btn:hover:not(:disabled){background:rgba(99,102,241,.15);border-color:rgba(99,102,241,.3);color:#a5b4fc} .page-btn.active{background:linear-gradient(135deg,#6366f1,#8b5cf6);border-color:transparent;color:white} .page-btn:disabled{opacity:.3;cursor:default}
        .sinp{background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.08);border-radius:10px;color:white;font-size:13px;padding:8px 12px 8px 36px;outline:none;transition:all .2s;font-family:'Plus Jakarta Sans',sans-serif;width:100%}
        .sinp::placeholder{color:rgba(255,255,255,.25)} .sinp:focus{border-color:rgba(99,102,241,.4);background:rgba(255,255,255,.08)}
        select.inp option,select.sinp option{background:#1a1535;color:white}
        @media print{body *{visibility:hidden}.print-area,.print-area *{visibility:visible}.print-area{position:fixed;top:0;left:0;width:100%;padding:20px}.no-print{display:none!important}}
      `}</style>

      <div style={{fontFamily:"'Plus Jakarta Sans',sans-serif",minHeight:'100vh'}}>
        {/* HEADER */}
        <div className="ph" style={{marginBottom:28}}>
          <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
            <div style={{width:3,height:20,borderRadius:2,background:'linear-gradient(to bottom,#6366f1,#8b5cf6)'}}/>
            <p style={{color:'rgba(255,255,255,.3)',fontSize:11,fontWeight:600,letterSpacing:'2.5px',textTransform:'uppercase',fontFamily:'Poppins,sans-serif'}}>Admin · Voucher</p>
          </div>
          <div style={{display:'flex',alignItems:'flex-end',justifyContent:'space-between',flexWrap:'wrap',gap:12}}>
            <div>
              <h1 style={{color:'white',fontSize:28,fontWeight:700,fontFamily:'Poppins,sans-serif',marginBottom:4}}>Kelola Voucher</h1>
              <p style={{color:'rgba(255,255,255,.3)',fontSize:14}}>Buat & bagikan voucher gratis untuk customer</p>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn" onClick={()=>{setModal('bulk');setError('')}} style={{background:'rgba(99,102,241,.12)',color:'#a5b4fc',border:'1px solid rgba(99,102,241,.2)'}}>
                <Sparkles size={14}/>Generate Massal
              </button>
              <button className="btn" onClick={()=>{setForm(f=>({...f,code:generateCode()}));setModal('single');setError('')}} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'white',boxShadow:'0 4px 16px rgba(99,102,241,.3)'}}>
                <Plus size={14}/>Buat Voucher
              </button>
            </div>
          </div>
          {success&&<div style={{marginTop:12,padding:'10px 16px',borderRadius:10,background:'rgba(16,185,129,.1)',border:'1px solid rgba(16,185,129,.2)',color:'#34d399',fontSize:13,display:'flex',alignItems:'center',gap:8}}>
            <Check size={14}/>{success}<button onClick={()=>setSuccess('')} style={{marginLeft:'auto',background:'none',border:'none',color:'#34d399',cursor:'pointer'}}><X size={12}/></button>
          </div>}
        </div>

        {/* STATS */}
        <div className="sh" style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:14,marginBottom:24}}>
          {[
            {label:'Total Voucher',value:stats.total,color:'rgba(99,102,241,.25)',icon:Ticket},
            {label:'Aktif',value:stats.totalActive,color:'rgba(16,185,129,.25)',icon:Check},
            {label:'Pernah Dipakai',value:stats.totalUsed,color:'rgba(245,158,11,.25)',icon:Hash},
            {label:'Dipakai Hari Ini',value:stats.usedToday,color:'rgba(236,72,153,.25)',icon:Sparkles},
          ].map(({label,value,color,icon:Icon})=>(
            <div key={label} className="glass-card" style={{padding:20,boxShadow:`0 0 24px ${color}`}}>
              <p style={{color:'rgba(255,255,255,.3)',fontSize:10,fontWeight:600,letterSpacing:'1px',textTransform:'uppercase',fontFamily:'Poppins,sans-serif',marginBottom:12}}>{label}</p>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                <p style={{color:'white',fontSize:26,fontWeight:700,fontFamily:'Poppins,sans-serif'}}>{value}</p>
                <div style={{width:34,height:34,borderRadius:10,background:color,display:'flex',alignItems:'center',justifyContent:'center'}}><Icon size={16} color="white"/></div>
              </div>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="tb glass-card" style={{padding:'12px 16px',marginBottom:18,display:'flex',gap:10,alignItems:'center',flexWrap:'wrap'}}>
          <div style={{position:'relative',flex:1,minWidth:180}}>
            <Search size={13} style={{position:'absolute',left:11,top:'50%',transform:'translateY(-50%)',color:'rgba(255,255,255,.3)',pointerEvents:'none'}}/>
            <input className="sinp" placeholder="Cari kode voucher..." value={localSearch} onChange={e=>setLocalSearch(e.target.value)} onKeyDown={e=>{if(e.key==='Enter')pushFilter({search:localSearch})}}/>
          </div>
          <select className="inp" style={{width:'auto',padding:'8px 12px'}} value={filters.status} onChange={e=>pushFilter({status:e.target.value})}>
            <option value="">Semua Status</option>
            <option value="active">Aktif</option>
            <option value="inactive">Nonaktif</option>
          </select>
          {(filters.status||filters.search)&&<button className="btn" onClick={()=>{setLocalSearch('');pushFilter({status:'',search:''})}} style={{background:'rgba(239,68,68,.08)',color:'#f87171',border:'1px solid rgba(239,68,68,.15)'}}><X size={13}/>Reset</button>}
          {isPending&&<div style={{width:15,height:15,border:'2px solid rgba(99,102,241,.3)',borderTopColor:'#6366f1',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>}
          <span style={{marginLeft:'auto',color:'rgba(255,255,255,.25)',fontSize:12}}>{totalCount} voucher</span>
        </div>

        {/* TABLE */}
        <div className="tbl glass-card" style={{overflow:'hidden'}}>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr style={{borderBottom:'1px solid rgba(255,255,255,.05)'}}>
                  {['Kode','Diskon','Pemakaian','Berlaku Hingga','Status','Dibuat','Aksi'].map(h=>(
                    <th key={h} style={{padding:'12px 18px',textAlign:'left',color:'rgba(255,255,255,.25)',fontSize:10,fontWeight:600,letterSpacing:'1.5px',textTransform:'uppercase',fontFamily:'Poppins,sans-serif',whiteSpace:'nowrap'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {vouchers.length===0&&<tr><td colSpan={7} style={{padding:'60px 20px',textAlign:'center',color:'rgba(255,255,255,.2)',fontSize:14}}>
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:10}}><Ticket size={32} color="rgba(99,102,241,.3)"/>Belum ada voucher — buat sekarang!</div>
                </td></tr>}
                {vouchers.map(v=>{
                  const dc=discountColor(v); const expired=isExpired(v); const full=isFull(v); const bad=expired||full||!v.is_active
                  return (
                    <tr key={v.id} className="vrow" style={{borderBottom:'1px solid rgba(255,255,255,.03)',transition:'background .15s'}}>
                      <td style={{padding:'14px 18px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:8}}>
                          <code style={{color:bad?'rgba(255,255,255,.3)':'white',fontSize:15,fontWeight:700,letterSpacing:2,fontFamily:'monospace',textDecoration:bad?'line-through':'none'}}>{v.code}</code>
                          <button onClick={()=>copyCode(v.code,v.id)} style={{background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.3)',padding:3,borderRadius:5,display:'flex'}}>
                            {copiedId===v.id?<Check size={13} color="#34d399"/>:<Copy size={13}/>}
                          </button>
                        </div>
                      </td>
                      <td style={{padding:'14px 18px'}}>
                        <span style={{background:dc.bg,color:dc.color,border:`1px solid ${dc.border}`,borderRadius:7,padding:'3px 10px',fontSize:11,fontWeight:700}}>{discountLabel(v)}</span>
                      </td>
                      <td style={{padding:'14px 18px'}}>
                        <div style={{minWidth:100}}>
                          <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
                            <span style={{color:'rgba(255,255,255,.5)',fontSize:12}}>{v.used_count} / {v.max_uses??'∞'}</span>
                            {full&&<span style={{color:'#f87171',fontSize:10,fontWeight:700}}>HABIS</span>}
                          </div>
                          {v.max_uses&&<div style={{height:3,borderRadius:2,background:'rgba(255,255,255,.06)',overflow:'hidden'}}>
                            <div style={{height:'100%',width:`${usagePct(v)}%`,borderRadius:2,background:usagePct(v)>=100?'#f87171':usagePct(v)>=70?'#fbbf24':'#6366f1',transition:'width .3s'}}/>
                          </div>}
                        </div>
                      </td>
                      <td style={{padding:'14px 18px'}}>
                        <div style={{display:'flex',alignItems:'center',gap:5,color:expired?'#f87171':'rgba(255,255,255,.45)',fontSize:12}}>
                          <Clock size={11}/>{formatDate(v.valid_until)}
                          {expired&&<span style={{fontSize:9,fontWeight:700,color:'#f87171'}}>EXPIRED</span>}
                        </div>
                      </td>
                      <td style={{padding:'14px 18px'}}>
                        <button onClick={()=>handleToggle(v)} disabled={togglingId===v.id} style={{display:'flex',alignItems:'center',gap:5,background:'none',border:'none',cursor:'pointer',transition:'all .2s'}}>
                          {togglingId===v.id?<div style={{width:14,height:14,border:'2px solid rgba(255,255,255,.2)',borderTopColor:'white',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
                            :v.is_active?<ToggleRight size={22} color="#34d399"/>:<ToggleLeft size={22} color="rgba(255,255,255,.2)"/>}
                          <span style={{fontSize:11,fontWeight:600,color:v.is_active?'#34d399':'rgba(255,255,255,.2)'}}>{v.is_active?'Aktif':'Nonaktif'}</span>
                        </button>
                      </td>
                      <td style={{padding:'14px 18px',color:'rgba(255,255,255,.25)',fontSize:11,whiteSpace:'nowrap'}}>
                        {new Date(v.created_at).toLocaleDateString('id-ID',{day:'2-digit',month:'short',year:'numeric'})}
                      </td>
                      <td style={{padding:'14px 18px'}}>
                        <div style={{display:'flex',gap:6}}>
                          <button onClick={()=>copyCode(v.code,v.id+'_a')} title="Copy" style={{width:30,height:30,borderRadius:7,background:'rgba(99,102,241,.1)',border:'1px solid rgba(99,102,241,.15)',color:'#a5b4fc',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {copiedId===v.id+'_a'?<Check size={12} color="#34d399"/>:<Copy size={12}/>}
                          </button>
                          <button onClick={()=>handleDelete(v.id)} disabled={deletingId===v.id} title="Hapus" style={{width:30,height:30,borderRadius:7,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.12)',color:'#f87171',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
                            {deletingId===v.id?<div style={{width:11,height:11,border:'2px solid rgba(239,68,68,.3)',borderTopColor:'#f87171',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>:<Trash2 size={12}/>}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {totalPages>1&&<div style={{padding:'16px 18px',borderTop:'1px solid rgba(255,255,255,.05)',display:'flex',alignItems:'center',justifyContent:'center',gap:6}}>
            <button className="page-btn" disabled={currentPage<=1} onClick={()=>goPage(currentPage-1)}><ChevronLeft size={13}/></button>
            {Array.from({length:totalPages},(_,i)=>i+1).filter(p=>p===1||p===totalPages||Math.abs(p-currentPage)<=2)
              .reduce<(number|'...')[]>((acc,p,i,arr)=>{if(i>0&&p-(arr[i-1] as number)>1)acc.push('...');acc.push(p);return acc},[])
              .map((p,i)=>p==='...'?<span key={`d${i}`} style={{color:'rgba(255,255,255,.2)',fontSize:12,padding:'0 3px'}}>…</span>
                :<button key={p} className={`page-btn ${p===currentPage?'active':''}`} onClick={()=>goPage(p as number)}>{p}</button>)}
            <button className="page-btn" disabled={currentPage>=totalPages} onClick={()=>goPage(currentPage+1)}><ChevronRight size={13}/></button>
          </div>}
        </div>
      </div>

      {/* MODAL SINGLE */}
      {modal==='single'&&<div className="modal-bg" onClick={()=>setModal(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'rgba(12,10,26,.97)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,width:'100%',maxWidth:480,overflow:'hidden'}}>
          <div style={{padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div><h2 style={{color:'white',fontSize:16,fontWeight:700,fontFamily:'Poppins,sans-serif',marginBottom:2}}>Buat Voucher</h2><p style={{color:'rgba(255,255,255,.3)',fontSize:12}}>Voucher untuk 1 customer</p></div>
            <button onClick={()=>setModal(null)} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          <div style={{padding:22,display:'flex',flexDirection:'column',gap:18}}>
            {error&&<div style={{padding:'10px 14px',borderRadius:9,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.15)',color:'#f87171',fontSize:12,display:'flex',alignItems:'center',gap:7}}><AlertCircle size={13}/>{error}</div>}
            <div>
              <label className="inp-label">Kode Voucher</label>
              <div style={{display:'flex',gap:8}}>
                <input className="inp" value={form.code} onChange={e=>setForm(f=>({...f,code:e.target.value.toUpperCase()}))} placeholder="Misal: GRATIS01"/>
                <button className="btn" onClick={()=>setForm(f=>({...f,code:generateCode()}))} style={{background:'rgba(255,255,255,.07)',color:'rgba(255,255,255,.5)',border:'1px solid rgba(255,255,255,.1)',flexShrink:0,padding:'8px 12px'}}><RefreshCw size={13}/></button>
              </div>
            </div>
            <div>
              <label className="inp-label">Jenis Diskon</label>
              <div className="seg">
                {[{val:'full',label:'🎁 Gratis 100%'},{val:'percent',label:'% Persen'},{val:'fixed',label:'Rp Nominal'}].map(({val,label})=>(
                  <button key={val} className={`seg-btn ${form.discount_type===val?'active':''}`} onClick={()=>setForm(f=>({...f,discount_type:val as any}))}>{label}</button>
                ))}
              </div>
            </div>
            {form.discount_type!=='full'&&<div>
              <label className="inp-label">{form.discount_type==='percent'?'Persen Diskon (%)':'Nominal Diskon (Rp)'}</label>
              <input className="inp" type="number" min={1} max={form.discount_type==='percent'?100:undefined} value={form.discount_value||''} onChange={e=>setForm(f=>({...f,discount_value:Number(e.target.value)}))} placeholder={form.discount_type==='percent'?'50':'10000'}/>
            </div>}
            <div>
              <label className="inp-label">Batas Pemakaian</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <button onClick={()=>setForm(f=>({...f,unlimited_uses:!f.unlimited_uses}))} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:form.unlimited_uses?'#6366f1':'rgba(255,255,255,.4)',fontSize:13,fontWeight:500}}>
                  {form.unlimited_uses?<ToggleRight size={20} color="#6366f1"/>:<ToggleLeft size={20}/>}Tidak terbatas
                </button>
              </div>
              {!form.unlimited_uses&&<input className="inp" type="number" min={1} value={form.max_uses} onChange={e=>setForm(f=>({...f,max_uses:Number(e.target.value)}))} placeholder="1"/>}
            </div>
            <div>
              <label className="inp-label">Batas Berlaku</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <button onClick={()=>setForm(f=>({...f,no_expiry:!f.no_expiry}))} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:form.no_expiry?'#6366f1':'rgba(255,255,255,.4)',fontSize:13,fontWeight:500}}>
                  {form.no_expiry?<ToggleRight size={20} color="#6366f1"/>:<ToggleLeft size={20}/>}Tidak ada batas waktu
                </button>
              </div>
              {!form.no_expiry&&<input className="inp" type="date" style={{colorScheme:'dark'}} value={form.valid_until} onChange={e=>setForm(f=>({...f,valid_until:e.target.value}))}/>}
            </div>
          </div>
          <div style={{padding:'16px 22px',borderTop:'1px solid rgba(255,255,255,.06)',display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button className="btn" onClick={()=>setModal(null)} style={{background:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.5)',border:'1px solid rgba(255,255,255,.1)'}}>Batal</button>
            <button className="btn" onClick={handleCreateSingle} disabled={saving} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'white',boxShadow:'0 4px 14px rgba(99,102,241,.3)'}}>
              {saving?<><div style={{width:13,height:13,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Menyimpan...</>:<><Ticket size={13}/>Buat Voucher</>}
            </button>
          </div>
        </div>
      </div>}

      {/* MODAL BULK */}
      {modal==='bulk'&&<div className="modal-bg" onClick={()=>setModal(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.85)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'rgba(12,10,26,.97)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,width:'100%',maxWidth:480,overflow:'hidden'}}>
          <div style={{padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <div><h2 style={{color:'white',fontSize:16,fontWeight:700,fontFamily:'Poppins,sans-serif',marginBottom:2}}>Generate Massal</h2><p style={{color:'rgba(255,255,255,.3)',fontSize:12}}>Buat banyak voucher sekaligus</p></div>
            <button onClick={()=>setModal(null)} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
          </div>
          <div style={{padding:22,display:'flex',flexDirection:'column',gap:18}}>
            {error&&<div style={{padding:'10px 14px',borderRadius:9,background:'rgba(239,68,68,.08)',border:'1px solid rgba(239,68,68,.15)',color:'#f87171',fontSize:12,display:'flex',alignItems:'center',gap:7}}><AlertCircle size={13}/>{error}</div>}
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
              <div><label className="inp-label">Jumlah Voucher</label><input className="inp" type="number" min={1} max={500} value={bulk.count} onChange={e=>setBulk(b=>({...b,count:Number(e.target.value)}))}/></div>
              <div><label className="inp-label">Prefix (opsional)</label><input className="inp" value={bulk.prefix} placeholder="Misal: PROMO" onChange={e=>setBulk(b=>({...b,prefix:e.target.value.toUpperCase()}))}/></div>
            </div>
            <div>
              <label className="inp-label">Jenis Diskon</label>
              <div className="seg">
                {[{val:'full',label:'🎁 Gratis 100%'},{val:'percent',label:'% Persen'},{val:'fixed',label:'Rp Nominal'}].map(({val,label})=>(
                  <button key={val} className={`seg-btn ${bulk.discount_type===val?'active':''}`} onClick={()=>setBulk(b=>({...b,discount_type:val as any}))}>{label}</button>
                ))}
              </div>
            </div>
            {bulk.discount_type!=='full'&&<div>
              <label className="inp-label">{bulk.discount_type==='percent'?'Persen (%)':'Nominal (Rp)'}</label>
              <input className="inp" type="number" min={1} value={bulk.discount_value||''} onChange={e=>setBulk(b=>({...b,discount_value:Number(e.target.value)}))}/>
            </div>}
            <div>
              <label className="inp-label">Batas Berlaku</label>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:8}}>
                <button onClick={()=>setBulk(b=>({...b,no_expiry:!b.no_expiry}))} style={{display:'flex',alignItems:'center',gap:6,background:'none',border:'none',cursor:'pointer',color:bulk.no_expiry?'#6366f1':'rgba(255,255,255,.4)',fontSize:13,fontWeight:500}}>
                  {bulk.no_expiry?<ToggleRight size={20} color="#6366f1"/>:<ToggleLeft size={20}/>}Tidak ada batas waktu
                </button>
              </div>
              {!bulk.no_expiry&&<input className="inp" type="date" style={{colorScheme:'dark'}} value={bulk.valid_until} onChange={e=>setBulk(b=>({...b,valid_until:e.target.value}))}/>}
            </div>
            <div style={{padding:'12px 14px',borderRadius:10,background:'rgba(99,102,241,.06)',border:'1px solid rgba(99,102,241,.12)'}}>
              <p style={{color:'rgba(255,255,255,.3)',fontSize:10,marginBottom:6,letterSpacing:'1px',textTransform:'uppercase',fontFamily:'Poppins,sans-serif'}}>Contoh kode</p>
              <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>
                {generateBulkCodes(3,bulk.prefix).map(c=>(
                  <code key={c} style={{color:'#a5b4fc',fontSize:12,fontWeight:700,letterSpacing:1.5,fontFamily:'monospace',background:'rgba(99,102,241,.1)',padding:'3px 8px',borderRadius:5}}>{c}</code>
                ))}
                <span style={{color:'rgba(255,255,255,.2)',fontSize:12,alignSelf:'center'}}>+{Math.max(0,bulk.count-3)} lainnya</span>
              </div>
            </div>
          </div>
          <div style={{padding:'16px 22px',borderTop:'1px solid rgba(255,255,255,.06)',display:'flex',gap:10,justifyContent:'flex-end'}}>
            <button className="btn" onClick={()=>setModal(null)} style={{background:'rgba(255,255,255,.06)',color:'rgba(255,255,255,.5)',border:'1px solid rgba(255,255,255,.1)'}}>Batal</button>
            <button className="btn" onClick={handleCreateBulk} disabled={saving} style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)',color:'white',boxShadow:'0 4px 14px rgba(99,102,241,.3)'}}>
              {saving?<><div style={{width:13,height:13,border:'2px solid rgba(255,255,255,.3)',borderTopColor:'white',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Generating...</>:<><Sparkles size={13}/>Generate {bulk.count} Voucher</>}
            </button>
          </div>
        </div>
      </div>}

      {/* MODAL PRINT */}
      {modal==='print'&&printCodes.length>0&&<div className="modal-bg" onClick={()=>setModal(null)} style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.88)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20}}>
        <div className="modal-box" onClick={e=>e.stopPropagation()} style={{background:'rgba(12,10,26,.97)',border:'1px solid rgba(255,255,255,.08)',borderRadius:20,width:'100%',maxWidth:700,maxHeight:'85vh',overflow:'hidden',display:'flex',flexDirection:'column'}}>
          <div className="no-print" style={{padding:'18px 22px',borderBottom:'1px solid rgba(255,255,255,.06)',display:'flex',alignItems:'center',justifyContent:'space-between',flexShrink:0}}>
            <div><h2 style={{color:'white',fontSize:16,fontWeight:700,fontFamily:'Poppins,sans-serif',marginBottom:2}}>✅ {printCodes.length} Voucher Berhasil Dibuat</h2><p style={{color:'rgba(255,255,255,.3)',fontSize:12}}>Simpan atau print untuk dibagikan ke customer</p></div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn no-print" onClick={()=>window.print()} style={{background:'rgba(16,185,129,.1)',color:'#34d399',border:'1px solid rgba(16,185,129,.2)'}}><Printer size={13}/>Print</button>
              <button onClick={()=>{setModal(null);setSuccess(`${printCodes.length} voucher berhasil dibuat!`)}} style={{width:30,height:30,borderRadius:8,background:'rgba(255,255,255,.06)',border:'1px solid rgba(255,255,255,.08)',color:'rgba(255,255,255,.4)',cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>✕</button>
            </div>
          </div>
          <div className="print-area" style={{overflow:'auto',padding:22,flex:1}}>
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
              {printCodes.map((code,i)=>(
                <div key={i} style={{border:'2px dashed rgba(99,102,241,.3)',borderRadius:10,padding:'14px 10px',textAlign:'center',background:'rgba(99,102,241,.05)',position:'relative'}}>
                  <div style={{display:'flex',justifyContent:'center',marginBottom:6}}><Gift size={18} color="rgba(99,102,241,.6)"/></div>
                  <p style={{color:'rgba(255,255,255,.3)',fontSize:8,letterSpacing:'1.5px',marginBottom:4,fontFamily:'Poppins,sans-serif',textTransform:'uppercase'}}>Voucher Gratis</p>
                  <code style={{color:'white',fontSize:13,fontWeight:800,letterSpacing:2,fontFamily:'monospace',display:'block',marginBottom:8}}>{code}</code>
                  <div style={{height:1,background:'rgba(255,255,255,.06)',marginBottom:8}}/>
                  <p style={{color:'rgba(255,255,255,.2)',fontSize:8,fontFamily:'monospace'}}>Photobooth · Gratis 1x</p>
                  <button className="no-print" onClick={()=>copyCode(code,`p${i}`)} style={{position:'absolute',top:6,right:6,background:'none',border:'none',cursor:'pointer',color:'rgba(255,255,255,.2)',padding:3}}>
                    {copiedId===`p${i}`?<Check size={11} color="#34d399"/>:<Copy size={11}/>}
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>}
    </>
  )
}
