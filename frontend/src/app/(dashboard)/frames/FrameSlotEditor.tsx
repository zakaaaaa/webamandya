'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { RotateCcw, Plus, Trash2, RotateCw, ZoomIn, ZoomOut, Eye, EyeOff } from 'lucide-react'

export type PhotoSlot = {
  id: number
  x: number
  y: number
  width: number
  height: number
  rotation: number
  photo_index: number
}

type Props = {
  frameUrl: string
  outputWidth: number
  outputHeight: number
  photoCount: number
  defaultSlotCount?: number
  initialSlots?: PhotoSlot[] | null
  onChange: (slots: PhotoSlot[]) => void
}

const PREVIEW_PHOTO = 'https://dmfzqdalantgqgqftalv.supabase.co/storage/v1/object/public/element-web/preview.webp'

const COLORS = [
  { b:'#D42B22', bg:'rgba(212,43,34,.85)',  t:'#fff' },
  { b:'#10b981', bg:'rgba(16,185,129,.85)',  t:'#fff' },
  { b:'#f59e0b', bg:'rgba(245,158,11,.85)',  t:'#fff' },
  { b:'#ef4444', bg:'rgba(239,68,68,.85)',   t:'#fff' },
  { b:'#D42B22', bg:'rgba(212,43,34,.85)',  t:'#fff' },
  { b:'#06b6d4', bg:'rgba(6,182,212,.85)',   t:'#fff' },
  { b:'#E83530', bg:'rgba(212,43,34,.85)', t:'#fff' },
  { b:'#84cc16', bg:'rgba(132,204,22,.85)',  t:'#fff' },
  { b:'#fb923c', bg:'rgba(251,146,60,.85)',  t:'#fff' },
  { b:'#E83530', bg:'rgba(232,53,48,.85)',  t:'#fff' },
]

function makeDefaults(photoCount: number, slotCount: number, w: number, h: number): PhotoSlot[] {
  const p = Math.round(w * 0.03)
  if (slotCount === 6 && photoCount === 3) {
    const sw = Math.floor((w - p * 3) / 2)
    const sh = Math.floor((h - p * 4) / 3)
    return Array.from({ length: 6 }, (_, i) => ({
      id: i+1, x: p+(i%2)*(sw+p), y: p+Math.floor(i/2)*(sh+p),
      width: sw, height: sh, rotation: 0, photo_index: i % photoCount,
    }))
  }
  if (slotCount >= 2) {
    const cols = slotCount >= 4 ? 2 : 1
    const rows = Math.ceil(slotCount / cols)
    const sw   = Math.floor((w - p*(cols+1)) / cols)
    const sh   = Math.floor((h - p*(rows+1)) / rows)
    return Array.from({ length: slotCount }, (_, i) => ({
      id: i+1, x: p+(i%cols)*(sw+p), y: p+Math.floor(i/cols)*(sh+p),
      width: sw, height: sh, rotation: 0, photo_index: i % photoCount,
    }))
  }
  const sh = Math.floor((h - p*(slotCount+1)) / slotCount)
  return Array.from({ length: slotCount }, (_, i) => ({
    id: i+1, x: p, y: p+i*(sh+p),
    width: w-p*2, height: sh, rotation: 0, photo_index: i % photoCount,
  }))
}

const HANDLES = [
  { id:'nw', cx:0,  cy:0  }, { id:'n', cx:.5, cy:0  }, { id:'ne', cx:1,  cy:0  },
  { id:'e',  cx:1,  cy:.5 }, { id:'se',cx:1,  cy:1  }, { id:'s',  cx:.5, cy:1  },
  { id:'sw', cx:0,  cy:1  }, { id:'w', cx:0,  cy:.5 },
]
const CUR: Record<string,string> = {
  nw:'nw-resize', n:'n-resize', ne:'ne-resize', e:'e-resize',
  se:'se-resize', s:'s-resize', sw:'sw-resize', w:'w-resize',
}

export default function FrameSlotEditor({
  frameUrl, outputWidth, outputHeight, photoCount,
  defaultSlotCount, initialSlots, onChange,
}: Props) {
  const wrapperRef   = useRef<HTMLDivElement>(null)
  const canvasRef     = useRef<HTMLDivElement>(null)
  const tgtSlots     = defaultSlotCount ?? photoCount

  const [slots, setSlots]       = useState<PhotoSlot[]>(() =>
    initialSlots?.length ? initialSlots : makeDefaults(photoCount, tgtSlots, outputWidth, outputHeight)
  )
  const [selected, setSelected] = useState<number | null>(null)
  const [baseW, setBaseW]       = useState(320)
  const [zoom, setZoom]         = useState(1.0)
  const [guides, setGuides]     = useState(false)
  const [preview, setPreview]   = useState(false)

  // Base canvas always fits container — zoom only scales inner canvas (with scroll)
  // Viewport height: cap at 560px so it never grows unbounded
  const MAX_VIEWPORT_H = 560
  const baseScaleW = baseW / outputWidth
  const baseScaleH = MAX_VIEWPORT_H / outputHeight
  const baseScale  = Math.min(baseScaleW, baseScaleH)
  const scale      = baseScale * zoom
  const editorW    = outputWidth  * scale
  const editorH    = outputHeight * scale
  const viewportH  = Math.min(MAX_VIEWPORT_H, outputHeight * baseScale)

  useEffect(() => {
    if (!wrapperRef.current) return
    const ro = new ResizeObserver(entries => {
      const w = entries[0]?.contentRect.width
      if (w && w > 0) setBaseW(Math.floor(w))
    })
    ro.observe(wrapperRef.current)
    return () => ro.disconnect()
  }, [])

  useEffect(() => { onChange(slots) }, [slots])

  const clamp = (s: PhotoSlot): PhotoSlot => ({
    ...s,
    x: Math.max(0, Math.min(outputWidth-s.width, s.x)),
    y: Math.max(0, Math.min(outputHeight-s.height, s.y)),
    width: Math.max(12, s.width), height: Math.max(12, s.height),
  })

  const startDrag = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault(); e.stopPropagation(); setSelected(id)
    const s0 = slots.find(s=>s.id===id)!
    const ox=s0.x, oy=s0.y, mx=e.clientX, my=e.clientY
    const move = (me: MouseEvent) => setSlots(prev => prev.map(s =>
      s.id===id ? clamp({...s, x:Math.round(ox+(me.clientX-mx)/scale), y:Math.round(oy+(me.clientY-my)/scale)}) : s
    ))
    const up = () => { window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up) }
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up)
  }, [slots, scale])

  const startResize = useCallback((e: React.MouseEvent, id: number, h: string) => {
    e.preventDefault(); e.stopPropagation()
    const orig = { ...slots.find(s=>s.id===id)! }
    const mx=e.clientX, my=e.clientY
    const move = (me: MouseEvent) => {
      const dx=(me.clientX-mx)/scale, dy=(me.clientY-my)/scale
      setSlots(prev => prev.map(s => {
        if (s.id!==id) return s
        let {x,y,width,height} = orig
        if (h.includes('e')) width  = Math.round(Math.max(12, orig.width+dx))
        if (h.includes('s')) height = Math.round(Math.max(12, orig.height+dy))
        if (h.includes('w')) { x=Math.round(orig.x+dx); width=Math.round(Math.max(12,orig.width-dx)) }
        if (h.includes('n')) { y=Math.round(orig.y+dy); height=Math.round(Math.max(12,orig.height-dy)) }
        return clamp({...s,x,y,width,height})
      }))
    }
    const up = () => { window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up) }
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up)
  }, [slots, scale])

  const startRotate = useCallback((e: React.MouseEvent, id: number) => {
    e.preventDefault(); e.stopPropagation()
    const slot = slots.find(s=>s.id===id)!
    const rect = canvasRef.current!.getBoundingClientRect()
    const cx = (slot.x+slot.width/2)*scale+rect.left
    const cy = (slot.y+slot.height/2)*scale+rect.top
    const move = (me: MouseEvent) => {
      const deg = Math.atan2(me.clientY-cy, me.clientX-cx)*(180/Math.PI)+90
      setSlots(prev => prev.map(s => s.id===id ? {...s, rotation:Math.round(((deg%360)+360)%360)} : s))
    }
    const up = () => { window.removeEventListener('mousemove',move); window.removeEventListener('mouseup',up) }
    window.addEventListener('mousemove',move); window.addEventListener('mouseup',up)
  }, [slots, scale])

  const addSlot = () => {
    const newId = Math.max(0, ...slots.map(s=>s.id)) + 1
    setSlots(prev => [...prev, { id:newId, x:20, y:20, width:80, height:100, rotation:0, photo_index:slots.length%photoCount }])
    setSelected(newId)
  }

  const removeSlot = (id: number) => {
    setSlots(prev => prev.filter(s=>s.id!==id).map((s,i) => ({...s, photo_index:i%photoCount})))
    if (selected===id) setSelected(null)
  }

  const ROT_OFFSET = 36
  const TRASH_OFFSET = 36

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14, width:'100%' }}>
      <style>{`
        @keyframes slot-blink{0%,100%{opacity:1}50%{opacity:.6}}
        .slot-sel{animation:slot-blink 1.8s ease infinite}
        .rh:hover{transform:scale(1.4)!important;background:#fff!important}
        .slot-row:hover{background:rgba(212,43,34,0.05)!important}
        .tool-btn:hover{background:rgba(212,43,34,0.08)!important;color:#D42B22!important}
        .zoom-btn:hover{background:rgba(212,43,34,.2)!important;border-color:rgba(212,43,34,.4)!important;}

        /* Mobile responsive */
        .fse-body { display:flex; gap:16px; align-items:flex-start; }
        .fse-side  { width:210px; flex-shrink:0; display:flex; flex-direction:column; gap:10px; }
        @media (max-width: 768px) {
          .fse-body  { flex-direction:column; }
          .fse-side  { width:100% !important; flex-direction:row; flex-wrap:wrap; gap:8px; }
          .fse-slot-list { flex:1; min-width:200px; }
          .fse-legend    { width:100% !important; }
        }
      `}</style>

      {/* ── TOOLBAR ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, flexWrap:'wrap' }}>
        {/* Progress */}
        <div style={{ display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:64, height:6, borderRadius:3, background:'rgba(212,43,34,0.07)', overflow:'hidden' }}>
            <div style={{ height:'100%', borderRadius:3, transition:'width .3s',
              background: slots.length===tgtSlots ? '#10b981' : '#D42B22',
              width:`${Math.min(100,(slots.length/Math.max(1,tgtSlots))*100)}%`
            }}/>
          </div>
          <span style={{ fontSize:14, fontWeight:700, fontFamily:'Poppins,sans-serif',
            color: slots.length===tgtSlots ? '#059669' : 'rgba(74,46,34,0.9)'
          }}>
            {slots.length} / {tgtSlots} slot{slots.length===tgtSlots ? ' — Lengkap' : ''}
          </span>
        </div>

        {/* Actions */}
        <div style={{ display:'flex', gap:7, flexWrap:'wrap' }}>
          {/* Preview toggle */}
          <button onClick={()=>setPreview(v=>!v)} className="tool-btn" style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, cursor:'pointer',
            fontSize:13, fontFamily:"'Poppins',sans-serif", transition:'all .15s',
            border:`1px solid ${preview?'rgba(212,43,34,.5)':'rgba(212,43,34,0.08)'}`,
            background:preview?'rgba(212,43,34,.15)':'rgba(212,43,34,0.025)',
            color:preview?'#E83530':'rgba(122,98,89,0.95)',
          }}>
            {preview ? <EyeOff size={13}/> : <Eye size={13}/>}
            {preview ? 'Edit Mode' : 'Preview'}
          </button>

          <button onClick={()=>setGuides(v=>!v)} className="tool-btn" style={{
            padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13,
            fontFamily:"'Poppins',sans-serif", transition:'all .15s',
            border:`1px solid rgba(255,255,255,${guides?.2:.08})`,
            background:`rgba(255,255,255,${guides?.07:.02})`,
            color:`rgba(255,255,255,${guides?.6:.3})`,
          }}>Grid</button>

          <button onClick={()=>{setSlots(makeDefaults(photoCount,tgtSlots,outputWidth,outputHeight));setSelected(null)}}
            className="tool-btn"
            style={{ display:'flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:8, cursor:'pointer', fontSize:13, fontFamily:"'Poppins',sans-serif", transition:'all .15s', border:'1px solid rgba(212,43,34,0.08)', background:'rgba(212,43,34,0.03)', color:'rgba(122,98,89,0.95)' }}>
            <RotateCcw size={13}/>Reset
          </button>

          <button onClick={addSlot} style={{
            display:'flex', alignItems:'center', gap:6, padding:'7px 16px', borderRadius:8,
            cursor:'pointer', fontSize:13, fontWeight:600, fontFamily:"'Poppins',sans-serif",
            border:'1px solid rgba(212,43,34,.4)', background:'rgba(212,43,34,.12)', color:'#E83530',
          }}>
            <Plus size={14}/>Tambah Slot
          </button>
        </div>
      </div>

      {/* ── CANVAS + SIDE PANEL ── */}
      <div className="fse-body">

        {/* CANVAS COLUMN */}
        <div ref={wrapperRef} style={{ flex:1, minWidth:0, display:'flex', flexDirection:'column', gap:8 }}>

          {/* Canvas wrapper — scrollable viewport, inner canvas scales with zoom */}
          <div style={{ position:'relative', width:'100%' }}>
            {/* Scrollable viewport — fixed height at natural fit, scrollable when zoomed */}
            <div style={{
              width:'100%', height: viewportH,
              overflow: zoom > 1 ? 'auto' : 'hidden',
              border:'1.5px solid rgba(212,43,34,.25)', borderRadius:12,
              background:'#0d0d18',
            }}>
            <div ref={canvasRef}
              onClick={()=>setSelected(null)}
              style={{
                position:'relative', width:editorW, height:editorH,
                userSelect:'none', cursor:'default', flexShrink:0,
              }}>

              {/* Preview: per-slot photo — shown behind frame overlay */}
              {preview && slots.map(slot => (
                <div key={`prev-${slot.id}`} style={{
                  position:'absolute',
                  left: slot.x * scale, top: slot.y * scale,
                  width: slot.width * scale, height: slot.height * scale,
                  transform:`rotate(${slot.rotation}deg)`, transformOrigin:'center center',
                  overflow:'hidden', zIndex:5, pointerEvents:'none',
                }}>
                  <img src={PREVIEW_PHOTO} alt="preview" draggable={false}
                    style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}/>
                </div>
              ))}

              {/* Frame overlay */}
              <img src={frameUrl} alt="frame" draggable={false}
                style={{ position:'absolute', inset:0, width:'100%', height:'100%', objectFit:'fill', pointerEvents:'none', zIndex:15 }}/>

              {/* Guide grid */}
              {guides && (
                <svg style={{ position:'absolute', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:6 }}>
                  {Array.from({length:9},(_,i)=>(
                    <g key={i}>
                      <line x1={`${(i+1)*10}%`} y1="0" x2={`${(i+1)*10}%`} y2="100%" stroke="rgba(212,43,34,0.04)" strokeWidth="0.5"/>
                      <line x1="0" y1={`${(i+1)*10}%`} x2="100%" y2={`${(i+1)*10}%`} stroke="rgba(212,43,34,0.04)" strokeWidth="0.5"/>
                    </g>
                  ))}
                  {[33.3,66.6].map(p=>(
                    <g key={p}>
                      <line x1={`${p}%`} y1="0" x2={`${p}%`} y2="100%" stroke="rgba(212,43,34,0.08)" strokeWidth="0.5" strokeDasharray="3,3"/>
                      <line x1="0" y1={`${p}%`} x2="100%" y2={`${p}%`} stroke="rgba(212,43,34,0.08)" strokeWidth="0.5" strokeDasharray="3,3"/>
                    </g>
                  ))}
                </svg>
              )}

              {/* SLOTS */}
              {!preview && slots.map((slot, idx) => {
                const c     = COLORS[slot.photo_index % COLORS.length]
                const isSel = selected===slot.id
                const sx    = slot.x*scale
                const sy    = slot.y*scale
                const sw    = slot.width*scale
                const sh    = slot.height*scale

                return (
                  <div key={slot.id}>
                    {/* Rotate handle — above slot */}
                    {isSel && (
                      <div onMouseDown={e=>startRotate(e,slot.id)} title="Drag untuk rotasi"
                        style={{
                          position:'absolute', left:sx+sw/2-14, top:sy-ROT_OFFSET,
                          width:28, height:28, borderRadius:'50%',
                          background:c.b, border:'2.5px solid white',
                          cursor:'grab', zIndex:55,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:`0 2px 8px rgba(0,0,0,.7),0 0 0 3px ${c.b}40`,
                        }}>
                        <RotateCw size={13} color="#fff"/>
                        <svg style={{ position:'absolute', left:'50%', top:'100%', transform:'translateX(-50%)', pointerEvents:'none', overflow:'visible' }}>
                          <line x1="0" y1="0" x2="0" y2={ROT_OFFSET-2} stroke={c.b} strokeWidth="1.5" strokeDasharray="3,2" opacity=".7"/>
                        </svg>
                      </div>
                    )}

                    {/* Trash handle — right of slot */}
                    {isSel && (
                      <div onMouseDown={e=>e.stopPropagation()} onClick={e=>{e.stopPropagation();removeSlot(slot.id)}}
                        title="Hapus slot"
                        style={{
                          position:'absolute',
                          left: sx + sw + TRASH_OFFSET > editorW ? sx - TRASH_OFFSET + 4 : sx + sw + 6,
                          top:  sy + sh/2 - 14,
                          width:28, height:28, borderRadius:'50%',
                          background:'#ef4444', border:'2.5px solid white',
                          cursor:'pointer', zIndex:55,
                          display:'flex', alignItems:'center', justifyContent:'center',
                          boxShadow:'0 2px 8px rgba(0,0,0,.7)',
                        }}>
                        <Trash2 size={12} color="#fff"/>
                      </div>
                    )}

                    {/* Slot box */}
                    <div
                      className={isSel ? 'slot-sel' : ''}
                      onClick={e=>{e.stopPropagation();setSelected(slot.id)}}
                      onMouseDown={e=>startDrag(e,slot.id)}
                      style={{
                        position:'absolute', left:sx, top:sy, width:sw, height:sh,
                        transform:`rotate(${slot.rotation}deg)`,
                        transformOrigin:'center center',
                        zIndex: isSel ? 30 : 20,
                        border:`${isSel?2.5:1.5}px solid ${c.b}`,
                        background: c.bg,
                        boxShadow: isSel ? `0 0 0 2px ${c.b}30, 0 4px 16px rgba(0,0,0,.4)` : `0 2px 8px rgba(0,0,0,.3)`,
                        cursor:'move', overflow:'hidden',
                      }}>

                      {/* Big slot number — centered */}
                      <div style={{
                        position:'absolute', inset:0,
                        display:'flex', flexDirection:'column',
                        alignItems:'center', justifyContent:'center',
                        pointerEvents:'none', gap:4,
                      }}>
                        <span style={{
                          color:'rgba(255,255,255,.9)',
                          fontSize: Math.min(Math.max(sw*.3, 16), 48),
                          fontWeight:800, fontFamily:'Poppins,sans-serif',
                          lineHeight:1, textShadow:'0 2px 8px rgba(0,0,0,.4)',
                        }}>
                          {idx+1}
                        </span>
                        {sw > 50 && sh > 50 && (
                          <span style={{
                            color:'rgba(21,12,9,0.8)',
                            fontSize: Math.min(sw*.1, 14),
                            fontFamily:'Poppins,sans-serif', fontWeight:600,
                          }}>
                            F{slot.photo_index+1}
                          </span>
                        )}
                      </div>

                      {/* Size label bottom right */}
                      {sw > 54 && sh > 32 && (
                        <div style={{ position:'absolute', bottom:4, right:5, display:'flex', gap:3, pointerEvents:'none', zIndex:2 }}>
                          {slot.rotation !== 0 && (
                            <span style={{ color:'rgba(21,12,9,0.9)', fontSize:10, fontFamily:'monospace', background:'rgba(0,0,0,.5)', padding:'2px 4px', borderRadius:3 }}>
                              {Math.round(slot.rotation)}°
                            </span>
                          )}
                          <span style={{ color:'rgba(21,12,9,0.85)', fontSize:10, fontFamily:'monospace', background:'rgba(0,0,0,.5)', padding:'2px 4px', borderRadius:3 }}>
                            {Math.round(slot.width)}x{Math.round(slot.height)}
                          </span>
                        </div>
                      )}

                      {/* Resize handles */}
                      {isSel && HANDLES.map(h=>(
                        <div key={h.id} className="rh"
                          onMouseDown={e=>startResize(e,slot.id,h.id)}
                          style={{
                            position:'absolute',
                            left:   h.cx===0?-5:h.cx===.5?'50%':undefined,
                            right:  h.cx===1?-5:undefined,
                            top:    h.cy===0?-5:h.cy===.5?'50%':undefined,
                            bottom: h.cy===1?-5:undefined,
                            marginLeft: h.cx===.5?-5:undefined,
                            marginTop:  h.cy===.5?-5:undefined,
                            width:10, height:10, borderRadius:2,
                            background:c.b, border:'2px solid white',
                            cursor:CUR[h.id], zIndex:50,
                            boxShadow:'0 1px 4px rgba(0,0,0,.8)',
                            transition:'transform .1s, background .1s',
                          }}/>
                      ))}
                    </div>
                  </div>
                )
              })}

              {/* Hint bar */}
              {!preview && (
                <div style={{ position:'absolute', bottom:10, left:'50%', transform:'translateX(-50%)', background:'rgba(0,0,0,.65)', borderRadius:20, padding:'5px 14px', color:'rgba(122,98,89,0.88)', fontSize:11, fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap', zIndex:50, pointerEvents:'none' }}>
                  Drag — pindah &nbsp;|&nbsp; Sudut — resize &nbsp;|&nbsp; Atas — rotasi &nbsp;|&nbsp; Kanan — hapus
                </div>
              )}
            </div>
            </div>{/* end scrollable viewport */}
          </div>

          {/* Zoom controls — below canvas */}
          <div style={{ display:'flex', alignItems:'center', gap:8, justifyContent:'center' }}>
            <button onClick={()=>setZoom(v=>Math.max(0.4, parseFloat((v-0.1).toFixed(1))))} className="zoom-btn"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:8, background:'rgba(212,43,34,0.04)', border:'1px solid rgba(212,43,34,0.08)', color:'rgba(74,46,34,0.9)', cursor:'pointer', transition:'all .15s' }}>
              <ZoomOut size={14}/>
            </button>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(212,43,34,0.04)', border:'1px solid rgba(212,43,34,0.07)', borderRadius:8, padding:'6px 14px' }}>
              <span style={{ color:'rgba(74,46,34,0.9)', fontSize:13, fontFamily:'Poppins,sans-serif', fontWeight:600, minWidth:36, textAlign:'center' }}>
                {Math.round(zoom*100)}%
              </span>
            </div>
            <button onClick={()=>setZoom(v=>Math.min(2.0, parseFloat((v+0.1).toFixed(1))))} className="zoom-btn"
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:34, height:34, borderRadius:8, background:'rgba(212,43,34,0.04)', border:'1px solid rgba(212,43,34,0.08)', color:'rgba(74,46,34,0.9)', cursor:'pointer', transition:'all .15s' }}>
              <ZoomIn size={14}/>
            </button>
            <button onClick={()=>setZoom(1.0)}
              style={{ padding:'6px 12px', borderRadius:8, background:'rgba(212,43,34,0.03)', border:'1px solid rgba(212,43,34,0.07)', color:'rgba(122,98,89,0.8)', fontSize:12, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
              Reset
            </button>
          </div>
        </div>

        {/* SIDE PANEL */}
        <div className="fse-side">

          <p style={{ color:'rgba(122,98,89,0.88)', fontSize:12, fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif' }}>
            Daftar Slot ({slots.length})
          </p>

          <div className="fse-slot-list" style={{ display:'flex', flexDirection:'column', gap:5, maxHeight:320, overflowY:'auto' }}>
            {slots.map((slot, idx) => {
              const c     = COLORS[slot.photo_index % COLORS.length]
              const isSel = selected===slot.id
              return (
                <div key={slot.id} className="slot-row" onClick={()=>setSelected(isSel?null:slot.id)}
                  style={{
                    padding:'9px 11px', borderRadius:9, cursor:'pointer', transition:'all .12s',
                    border:`1px solid ${isSel?c.b:'rgba(212,43,34,0.07)'}`,
                    background: isSel ? c.bg.replace('.85','.2') : 'rgba(212,43,34,0.025)',
                    display:'flex', alignItems:'center', gap:9,
                  }}>
                  {/* Color dot */}
                  <div style={{ width:28, height:28, borderRadius:7, background:c.bg, border:`1.5px solid ${c.b}`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color:'#150C09', fontSize:13, fontWeight:800, fontFamily:'Poppins,sans-serif' }}>{idx+1}</span>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:3 }}>
                      <span style={{ color:'rgba(21,12,9,0.9)', fontSize:13, fontWeight:700, fontFamily:'Poppins,sans-serif' }}>Slot {idx+1}</span>
                      <span style={{ color:'rgba(122,98,89,0.95)', fontSize:12, fontFamily:'Poppins,sans-serif' }}>F{slot.photo_index+1}</span>
                    </div>
                    <div style={{ color:'rgba(122,98,89,0.8)', fontSize:11, fontFamily:'monospace' }}>
                      {Math.round(slot.width)}x{Math.round(slot.height)}{slot.rotation?` · ${Math.round(slot.rotation)}°`:''}
                    </div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();removeSlot(slot.id)}}
                    style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(158,136,128,0.85)', padding:4, display:'flex', flexShrink:0, transition:'color .15s' }}
                    onMouseOver={e=>(e.currentTarget.style.color='#B82018')}
                    onMouseOut={e=>(e.currentTarget.style.color='rgba(158,136,128,0.85)')}>
                    <Trash2 size={13}/>
                  </button>
                </div>
              )
            })}
          </div>

          {/* Photo index selector — shown when slot selected */}
          {selected !== null && slots.find(s=>s.id===selected) && (() => {
            const sel = slots.find(s=>s.id===selected)!
            return (
              <div style={{ padding:'12px 14px', borderRadius:10, border:'1px solid rgba(212,43,34,0.08)', background:'rgba(212,43,34,0.03)' }}>
                <p style={{ color:'rgba(122,98,89,0.95)', fontSize:12, fontWeight:600, marginBottom:10, fontFamily:'Poppins,sans-serif', textTransform:'uppercase', letterSpacing:'1px' }}>
                  Foto untuk Slot {slots.findIndex(s=>s.id===selected)+1}
                </p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {Array.from({length:photoCount},(_,i)=>{
                    const c = COLORS[i%COLORS.length]
                    const isActive = sel.photo_index===i
                    return (
                      <button key={i}
                        onClick={()=>setSlots(prev=>prev.map(s=>s.id===selected?{...s,photo_index:i}:s))}
                        style={{
                          minWidth:38, padding:'7px 10px', borderRadius:7,
                          border:`1.5px solid ${isActive?c.b:'rgba(212,43,34,0.08)'}`,
                          background: isActive ? c.bg.replace('.85','.2') : 'rgba(212,43,34,0.03)',
                          color: isActive ? '#150C09' : 'rgba(122,98,89,0.95)',
                          fontSize:13, fontWeight:700, cursor:'pointer',
                          fontFamily:'Poppins,sans-serif', transition:'all .15s',
                        }}>
                        {i+1}
                      </button>
                    )
                  })}
                </div>
              </div>
            )
          })()}

          {/* Legend */}
          <div className="fse-legend" style={{ padding:'12px 14px', borderRadius:10, background:'rgba(212,43,34,.05)', border:'1px solid rgba(212,43,34,.12)' }}>
            <p style={{ color:'rgba(165,180,252,.55)', fontSize:12, lineHeight:2, fontFamily:'Poppins,sans-serif' }}>
              Angka = urutan slot<br/>
              F1, F2 = foto ke berapa<br/>
              Slot F sama = foto diulang
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}