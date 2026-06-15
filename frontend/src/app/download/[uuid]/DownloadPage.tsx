'use client'

import { useState, useEffect, useRef } from 'react'
import { Download, Images, Sparkles, Clock, CheckCircle2, Camera, Loader2 } from 'lucide-react'

type Session = {
  id: string
  transaction_code: string
  payment_status: string
  created_at: string
  result_url: string | null
  clients: { name: string; email: string } | null
  devices: { device_name: string } | null
}
type Photo = { photo_url: string; photo_order: number }

// Layout sama persis Flutter
const LAYOUTS: Record<number, {
  topPadding:number; bottomPadding:number
  leftPadding:number; rightPadding:number
  horizontalSpacing:number; verticalSpacing:number
  cols:number
}> = {
  3: { topPadding:59,  bottomPadding:59,  leftPadding:10, rightPadding:10, horizontalSpacing:20, verticalSpacing:10,  cols:1 },
  4: { topPadding:25,  bottomPadding:40,  leftPadding:10, rightPadding:5,  horizontalSpacing:5,  verticalSpacing:13,  cols:2 },
}

export default function DownloadPage({
  session, photos, uuid, frameWidth, frameHeight
}: {
  session: Session; photos: Photo[]; uuid: string
  frameWidth: number; frameHeight: number
}) {
  const [activeTab, setActiveTab]     = useState<'strip'|'photos'|'gif'>('strip')
  const [gifFrame, setGifFrame]       = useState(0)
  const [lightbox, setLightbox]       = useState<string|null>(null)
  const [downloading, setDownloading] = useState<string|null>(null)
  const [gifUrl, setGifUrl]           = useState<string|null>(null)
  const [gifLoading, setGifLoading]   = useState(false)
  const [gifProgress, setGifProgress] = useState(0)
  const [gifError, setGifError]       = useState<string|null>(null)
  const gifGenRef                     = useRef(false)

  const clientName = session.clients?.name ?? 'Photobooth'
  const photoCount = photos.length
  const layout     = LAYOUTS[photoCount] ?? LAYOUTS[4]
  const cols       = layout.cols
  const rows       = Math.ceil(photoCount / cols)

  // Cell size calculation — sama persis Flutter canvas render
  const cellW = (frameWidth  - layout.leftPadding - layout.rightPadding  - (cols-1)*layout.horizontalSpacing) / cols
  const cellH = (frameHeight - layout.topPadding  - layout.bottomPadding - (rows-1)*layout.verticalSpacing)   / rows

  // Scale down untuk preview di layar
  const MAX_PREVIEW_W = 300
  const previewScale  = Math.min(1, MAX_PREVIEW_W / frameWidth)
  const previewW      = frameWidth  * previewScale

  // GIF slideshow interval
  useEffect(() => {
    if (activeTab !== 'gif' || photos.length === 0) return
    const iv = setInterval(() => setGifFrame(f => (f+1) % photos.length), 700)
    return () => clearInterval(iv)
  }, [activeTab, photos.length])

  // Auto-generate GIF saat tab gif dibuka
  useEffect(() => {
    if (activeTab !== 'gif' || gifUrl || gifLoading || gifGenRef.current || photos.length < 2) return
    gifGenRef.current = true
    generateGif()
  }, [activeTab])

  const generateGif = async () => {
    setGifLoading(true); setGifProgress(0); setGifError(null)
    try {
      // Load gif.js library
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js')
      const GIF = (window as any).GIF

      // ✅ FIX: Fetch worker → Blob URL
      // Browser memblokir Web Worker dari external URL meski CORS OK.
      // Solusi: fetch dulu script-nya, buat Blob URL, gunakan sebagai workerScript.
      const workerRes  = await fetch('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js')
      if (!workerRes.ok) throw new Error(`Worker fetch failed: ${workerRes.status}`)
      const workerBlob = await workerRes.blob()
      const workerUrl  = URL.createObjectURL(workerBlob)

      const size = 400
      const gif  = new GIF({ workers:2, quality:8, width:size, height:size, workerScript: workerUrl })

      // Load semua foto
      let loaded = 0
      const images: HTMLImageElement[] = []
      for (const p of photos) {
        await new Promise<void>(res => {
          const im = new Image(); im.crossOrigin = 'anonymous'
          im.onload  = () => { images.push(im); loaded++; setGifProgress(Math.round((loaded/photos.length)*60)); res() }
          im.onerror = () => {
            // ✅ FIX: Retry tanpa crossOrigin sebagai fallback (Supabase CORS edge case)
            const im2 = new Image()
            im2.onload  = () => { images.push(im2); loaded++; setGifProgress(Math.round((loaded/photos.length)*60)); res() }
            im2.onerror = () => { loaded++; res() }
            im2.src = p.photo_url + '?t=' + Date.now()
          }
          im.src = p.photo_url
        })
      }

      if (images.length === 0) {
        setGifError('Gagal memuat foto. Coba lagi.')
        setGifLoading(false)
        gifGenRef.current = false
        URL.revokeObjectURL(workerUrl)
        return
      }

      // Render setiap foto ke canvas → tambah ke GIF
      const canvas = document.createElement('canvas')
      canvas.width = size; canvas.height = size
      const ctx = canvas.getContext('2d')!
      for (const im of images) {
        ctx.clearRect(0,0,size,size)
        const r = im.naturalWidth/im.naturalHeight
        let sx=0,sy=0,sw=im.naturalWidth,sh=im.naturalHeight
        if (r>1) { sw=sh; sx=(im.naturalWidth-sw)/2 } else { sh=sw; sy=0 }
        ctx.drawImage(im,sx,sy,sw,sh,0,0,size,size)
        gif.addFrame(canvas,{delay:800,copy:true})
      }

      gif.on('progress',(p:number)=>setGifProgress(60+Math.round(p*40)))
      gif.on('finished',(blob:Blob)=>{
        URL.revokeObjectURL(workerUrl) // cleanup blob URL
        setGifUrl(URL.createObjectURL(blob))
        setGifLoading(false)
        setGifProgress(100)
      })
      gif.render()

    } catch(e) {
      console.error('GIF error:', e)
      setGifError('Gagal membuat GIF. Coba klik tombol di bawah untuk retry.')
      setGifLoading(false)
      gifGenRef.current = false // allow retry
    }
  }

  const retryGif = () => {
    setGifError(null)
    setGifProgress(0)
    gifGenRef.current = false
    generateGif()
  }

  const loadScript = (src:string) => new Promise<void>((res,rej)=>{
    if (document.querySelector(`script[src="${src}"]`)) { res(); return }
    const s=document.createElement('script'); s.src=src; s.onload=()=>res(); s.onerror=rej
    document.head.appendChild(s)
  })

  const handleDownload = async (url:string, filename:string) => {
    setDownloading(filename)
    try {
      const res = await fetch(url); const blob = await res.blob()
      const a = document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=filename; a.click()
      URL.revokeObjectURL(a.href)
    } catch(e) { console.error(e) }
    setTimeout(()=>setDownloading(null),1500)
  }

  const formatDate = (d:string) => new Date(d).toLocaleString('id-ID',{dateStyle:'long',timeStyle:'short'})

  // Render strip dengan layout pixel-perfect sama Flutter
  const StripPreview = ({ scale=1, frameUrl }: { scale?:number; frameUrl:string|null }) => {
    const W = frameWidth  * scale
    const H = frameHeight * scale
    const cW = cellW * scale
    const cH = cellH * scale
    const lTop   = layout.topPadding        * scale
    const lLeft  = layout.leftPadding       * scale
    const lHSp   = layout.horizontalSpacing * scale
    const lVSp   = layout.verticalSpacing   * scale
    return (
      <div style={{position:'relative',width:W,height:H,background:'#150C09',flexShrink:0,overflow:'hidden'}}>
        {photos.slice(0,photoCount).map((p,i)=>{
          const col = i % cols
          const row = Math.floor(i / cols)
          const x = lLeft + col*(cW+lHSp)
          const y = lTop  + row*(cH+lVSp)
          return (
            <div key={i} style={{position:'absolute',left:x,top:y,width:cW,height:cH,overflow:'hidden'}}>
              <img src={p.photo_url} alt="" crossOrigin="anonymous"
                style={{width:'100%',height:'100%',objectFit:'cover',objectPosition:'center top',display:'block'}}/>
            </div>
          )
        })}
        {frameUrl && (
          <img src={frameUrl} alt="frame" crossOrigin="anonymous"
            style={{position:'absolute',inset:0,width:'100%',height:'100%',objectFit:'fill',pointerEvents:'none'}}/>
        )}
      </div>
    )
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@300;400;500;600;700;800&family=Poppins:wght@400;500;600;700;800&display=swap');
        *,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
        html{scroll-behavior:smooth}
        body{font-family:'Poppins',sans-serif;background:#FAF7F5;overflow-x:hidden}
        @keyframes float-1{0%,100%{transform:translate(0,0)}50%{transform:translate(25px,-20px)}}
        @keyframes float-2{0%,100%{transform:translate(0,0)}50%{transform:translate(-20px,25px)}}
        @keyframes fade-up{from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fade-in{from{opacity:0}to{opacity:1}}
        @keyframes spin{to{transform:rotate(360deg)}}
        @keyframes gif-glow{0%,100%{opacity:1}50%{opacity:.6}}
        .fu1{animation:fade-up .5s ease .05s both}
        .fu2{animation:fade-up .5s ease .15s both}
        .fu3{animation:fade-up .5s ease .25s both}
        .fu4{animation:fade-up .5s ease .35s both}
        .glass{background:rgba(212,43,34,0.05);backdrop-filter:blur(24px) saturate(180%);border:1px solid rgba(212,43,34,0.07)}
        .photo-card{transition:transform .2s cubic-bezier(.34,1.56,.64,1),box-shadow .2s;cursor:pointer}
        .photo-card:hover{transform:scale(1.03) translateY(-3px);box-shadow:0 16px 40px rgba(0,0,0,.6)!important}
        .tab-btn{padding:8px 18px;border-radius:10px;border:1px solid rgba(212,43,34,0.07);background:transparent;color:rgba(122,98,89,0.88);font-size:13px;font-weight:600;cursor:pointer;transition:all .2s;font-family:'Poppins',sans-serif;display:flex;align-items:center;gap:6px;white-space:nowrap}
        .tab-btn.active{background:rgba(212,43,34,.2);border-color:rgba(212,43,34,.5);color:#E83530}
        .tab-btn:hover:not(.active){background:rgba(212,43,34,0.05);color:rgba(21,12,9,0.8)}
        .dl-btn{display:flex;align-items:center;justify-content:center;gap:8px;padding:12px 20px;border-radius:12px;border:none;font-size:14px;font-weight:600;cursor:pointer;transition:all .2s;font-family:'Poppins',sans-serif;width:100%}
        .dl-btn:hover:not(:disabled){transform:translateY(-2px);filter:brightness(1.1)}
        .dl-btn:disabled{opacity:.5;cursor:not-allowed}
        .lb{animation:fade-in .15s ease both}
        ::-webkit-scrollbar{width:4px;height:4px}
        ::-webkit-scrollbar-thumb{background:rgba(212,43,34,0.08);border-radius:2px}
        @media(max-width:768px){.main-grid{grid-template-columns:1fr !important}.right-panel{order:-1}}
      `}</style>

      <div style={{minHeight:'100vh',position:'relative',overflow:'hidden',background:'linear-gradient(135deg,#FAF7F5 0%,#FAF7F5 50%,#FAF7F5 100%)'}}>
        <div style={{position:'fixed',width:600,height:600,top:-150,left:-150,borderRadius:'50%',filter:'blur(80px)',pointerEvents:'none',zIndex:0,background:'radial-gradient(circle,rgba(212,43,34,.15) 0%,transparent 70%)',animation:'float-1 18s ease-in-out infinite'}}/>
        <div style={{position:'fixed',width:500,height:500,bottom:-100,right:-100,borderRadius:'50%',filter:'blur(80px)',pointerEvents:'none',zIndex:0,background:'radial-gradient(circle,rgba(212,43,34,.12) 0%,transparent 70%)',animation:'float-2 22s ease-in-out infinite'}}/>
        <div style={{position:'fixed',inset:0,pointerEvents:'none',zIndex:0,backgroundImage:'linear-gradient(rgba(255,255,255,.015) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.015) 1px,transparent 1px)',backgroundSize:'56px 56px'}}/>

        <div style={{position:'relative',zIndex:10,maxWidth:1000,margin:'0 auto',padding:'36px 20px 80px'}}>

          {/* Header */}
          <div className="fu1" style={{textAlign:'center',marginBottom:32}}>
            <div style={{display:'inline-flex',alignItems:'center',gap:8,marginBottom:16,background:'rgba(212,43,34,.1)',border:'1px solid rgba(212,43,34,.25)',borderRadius:100,padding:'7px 16px'}}>
              <Camera size={14} color="#E83530"/>
              <span style={{color:'#E83530',fontSize:12,fontWeight:600}}>{clientName}</span>
            </div>
            <h1 style={{color:'#150C09',fontSize:'clamp(24px,5vw,44px)',fontWeight:800,fontFamily:'Poppins,sans-serif',lineHeight:1.2,marginBottom:10}}>
              Foto kamu sudah siap! 🎉
            </h1>
            <p style={{color:'rgba(122,98,89,0.95)',fontSize:14,maxWidth:480,margin:'0 auto'}}>
              Scan QR Code atau buka link ini untuk download hasil fotomu
            </p>
          </div>

          {/* Session info */}
          <div className="fu2 glass" style={{borderRadius:14,padding:'12px 20px',marginBottom:24,display:'flex',alignItems:'center',gap:14,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:7}}>
              <CheckCircle2 size={15} color="#059669"/>
              <span style={{color:'#059669',fontSize:13,fontWeight:600}}>
                {session.payment_status==='paid'?'Pembayaran Sukses':session.payment_status==='free'?'Sesi Gratis':'Sesi Demo'}
              </span>
            </div>
            <div style={{width:1,height:14,background:'rgba(212,43,34,0.08)'}}/>
            <div style={{display:'flex',alignItems:'center',gap:6}}>
              <Clock size={13} color="rgba(122,98,89,0.8)"/>
              <span style={{color:'rgba(122,98,89,0.8)',fontSize:12}}>{formatDate(session.created_at)}</span>
            </div>
            <code style={{marginLeft:'auto',color:'rgba(212,43,34,0.10)',fontSize:10,fontFamily:'monospace'}}>{uuid.slice(0,24)}...</code>
          </div>

          {/* Main grid */}
          <div className="main-grid" style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:20,alignItems:'start'}}>

            {/* LEFT */}
            <div>
              <div className="fu3" style={{display:'flex',gap:8,marginBottom:16,flexWrap:'wrap'}}>
                <button className={`tab-btn ${activeTab==='strip'?'active':''}`} onClick={()=>setActiveTab('strip')}><Sparkles size={13}/>Strip</button>
                {photos.length>0&&<button className={`tab-btn ${activeTab==='photos'?'active':''}`} onClick={()=>setActiveTab('photos')}><Images size={13}/>{photos.length} Foto</button>}
                {photos.length>1&&<button className={`tab-btn ${activeTab==='gif'?'active':''}`} onClick={()=>setActiveTab('gif')}>
                  <span style={{fontSize:11,fontWeight:700,background:'linear-gradient(135deg,#E83530,#E83530)',WebkitBackgroundClip:'text',WebkitTextFillColor:'transparent'}}>GIF</span>&nbsp;Animasi
                </button>}
              </div>

              <div className="fu4">
                {/* TAB STRIP */}
                {activeTab==='strip'&&(
                  <div style={{display:'flex',justifyContent:'center'}}>
                    {session.result_url ? (
                      <div className="photo-card" onClick={()=>setLightbox(session.result_url!)}
                        style={{borderRadius:14,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.5)',border:'1px solid rgba(212,43,34,0.06)',maxWidth:previewW,width:'100%'}}>
                        <img src={session.result_url} alt="Photo strip" style={{width:'100%',display:'block'}}/>
                      </div>
                    ) : photos.length>0 ? (
                      <div className="photo-card" style={{borderRadius:14,overflow:'hidden',boxShadow:'0 8px 32px rgba(0,0,0,.5)',border:'1px solid rgba(212,43,34,0.06)'}}>
                        <div style={{transform:`scale(${previewScale})`,transformOrigin:'top left',width:frameWidth,height:frameHeight}}>
                          <StripPreview frameUrl={null}/>
                        </div>
                      </div>
                    ) : (
                      <div className="glass" style={{borderRadius:14,padding:'60px 40px',textAlign:'center',width:'100%'}}>
                        <div style={{width:44,height:44,borderRadius:'50%',border:'3px solid rgba(212,43,34,.4)',borderTopColor:'#D42B22',animation:'spin 1s linear infinite',margin:'0 auto 14px'}}/>
                        <p style={{color:'rgba(122,98,89,0.8)',fontSize:14}}>Memproses foto...</p>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB PHOTOS */}
                {activeTab==='photos'&&photos.length>0&&(
                  <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(150px,1fr))',gap:10}}>
                    {photos.map((p,i)=>(
                      <div key={i} className="photo-card" onClick={()=>setLightbox(p.photo_url)}
                        style={{borderRadius:10,overflow:'hidden',boxShadow:'0 4px 16px rgba(0,0,0,.4)',border:'1px solid rgba(212,43,34,0.055)',position:'relative'}}>
                        <img src={p.photo_url} alt={`Foto ${i+1}`} style={{width:'100%',aspectRatio:'1',objectFit:'cover',objectPosition:'center top',display:'block'}}/>
                        <div style={{position:'absolute',top:7,left:7,background:'rgba(0,0,0,.65)',borderRadius:5,padding:'2px 7px',color:'rgba(21,12,9,0.9)',fontSize:11,fontWeight:700}}>{i+1}</div>
                        <div style={{position:'absolute',bottom:0,left:0,right:0,padding:'18px 8px 8px',background:'linear-gradient(to top,rgba(0,0,0,.75),transparent)',display:'flex',justifyContent:'center'}}>
                          <button onClick={e=>{e.stopPropagation();handleDownload(p.photo_url,`foto_${i+1}_${uuid.slice(0,8)}.jpg`)}}
                            style={{background:'rgba(212,43,34,0.10)',border:'1px solid rgba(158,136,128,0.85)',borderRadius:7,padding:'4px 10px',color:'#150C09',fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',gap:4,fontFamily:"'Poppins',sans-serif"}}>
                            <Download size={10}/>Simpan
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* TAB GIF */}
                {activeTab==='gif'&&photos.length>0&&(
                  <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:20}}>
                    {/* Slideshow preview */}
                    <div style={{position:'relative'}}>
                      <div style={{position:'absolute',inset:-10,borderRadius:18,background:'linear-gradient(135deg,rgba(212,43,34,.25),rgba(212,43,34,.25))',filter:'blur(16px)',animation:'gif-glow .8s ease infinite'}}/>
                      <div style={{position:'relative',borderRadius:14,overflow:'hidden',border:'1px solid rgba(212,43,34,0.08)',width:260}}>
                        <img src={photos[gifFrame]?.photo_url} alt="GIF preview"
                          style={{width:'100%',aspectRatio:'1',objectFit:'cover',objectPosition:'center top',display:'block'}}/>
                        <div style={{position:'absolute',top:8,right:8,background:'rgba(0,0,0,.75)',borderRadius:5,padding:'2px 8px',color:'#E83530',fontSize:10,fontWeight:700}}>
                          PREVIEW {gifFrame+1}/{photos.length}
                        </div>
                      </div>
                    </div>

                    {/* Loading progress */}
                    {gifLoading&&(
                      <div style={{width:'100%',maxWidth:300}}>
                        <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8}}>
                          <Loader2 size={14} color="#E83530" style={{animation:'spin .8s linear infinite'}}/>
                          <span style={{color:'rgba(74,46,34,0.9)',fontSize:12}}>Membuat GIF... {gifProgress}%</span>
                        </div>
                        <div style={{height:4,background:'rgba(212,43,34,0.07)',borderRadius:2,overflow:'hidden'}}>
                          <div style={{height:'100%',width:`${gifProgress}%`,background:'linear-gradient(90deg,#D42B22,#D42B22)',borderRadius:2,transition:'width .3s'}}/>
                        </div>
                      </div>
                    )}

                    {/* Error state */}
                    {gifError&&!gifLoading&&(
                      <div style={{width:'100%',maxWidth:300,textAlign:'center'}}>
                        <p style={{color:'#B82018',fontSize:13,marginBottom:10}}>{gifError}</p>
                        <button className="dl-btn" onClick={retryGif}
                          style={{background:'rgba(212,43,34,.1)',color:'#E83530',border:'1px solid rgba(212,43,34,.2)',maxWidth:200}}>
                          <Sparkles size={13}/>Coba Lagi
                        </button>
                      </div>
                    )}

                    {/* GIF result */}
                    {gifUrl&&!gifLoading&&(
                      <div style={{display:'flex',flexDirection:'column',alignItems:'center',gap:12}}>
                        <img src={gifUrl} alt="GIF" style={{borderRadius:12,maxWidth:260,border:'1px solid rgba(212,43,34,0.08)'}}/>
                        <button className="dl-btn" onClick={()=>handleDownload(gifUrl,`photobooth_gif_${uuid.slice(0,8)}.gif`)}
                          style={{background:'linear-gradient(135deg,#E83530,#C02018)',color:'#fff',maxWidth:260,boxShadow:'0 4px 20px rgba(212,43,34,.3)'}}>
                          <Download size={15}/>Download GIF
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT PANEL */}
            <div className="right-panel" style={{display:'flex',flexDirection:'column',gap:14}}>
              {session.result_url&&(
                <div className="glass fu3" style={{borderRadius:18,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'#D42B22',boxShadow:'0 0 6px #D42B22'}}/>
                    <p style={{color:'#150C09',fontSize:13,fontWeight:700}}>Photo Strip</p>
                  </div>
                  <p style={{color:'rgba(158,136,128,0.95)',fontSize:11,marginBottom:14,paddingLeft:15}}>Hasil final dengan frame</p>
                  <button className="dl-btn" disabled={downloading==='strip'}
                    onClick={()=>handleDownload(session.result_url!,`photobooth_strip_${uuid.slice(0,8)}.png`)}
                    style={{background:'linear-gradient(135deg,#E83530,#C02018)',color:'#fff',boxShadow:'0 4px 16px rgba(212,43,34,.3)'}}>
                    {downloading==='strip'
                      ?<><div style={{width:14,height:14,border:'2px solid rgba(122,98,89,0.8)',borderTopColor:'#150C09',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>Mengunduh...</>
                      :<><Download size={14}/>Download Strip</>}
                  </button>
                </div>
              )}

              {photos.length>0&&(
                <div className="glass fu3" style={{borderRadius:18,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'#059669',boxShadow:'0 0 6px #059669'}}/>
                    <p style={{color:'#150C09',fontSize:13,fontWeight:700}}>Foto Individual</p>
                  </div>
                  <p style={{color:'rgba(158,136,128,0.95)',fontSize:11,marginBottom:14,paddingLeft:15}}>{photos.length} foto tanpa frame</p>
                  <div style={{display:'flex',flexDirection:'column',gap:7}}>
                    {photos.map((p,i)=>(
                      <button key={i} className="dl-btn" disabled={downloading===`photo_${i}`}
                        onClick={()=>handleDownload(p.photo_url,`foto_${i+1}_${uuid.slice(0,8)}.jpg`)}
                        style={{background:'rgba(16,185,129,.1)',color:'#059669',border:'1px solid rgba(16,185,129,.2)'}}>
                        {downloading===`photo_${i}`?<div style={{width:13,height:13,border:'2px solid rgba(52,211,153,.3)',borderTopColor:'#059669',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>:<Download size={13}/>}
                        Foto {i+1}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {photos.length>1&&(
                <div className="glass fu4" style={{borderRadius:18,padding:20}}>
                  <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                    <div style={{width:7,height:7,borderRadius:'50%',background:'#E83530',boxShadow:'0 0 6px #E83530'}}/>
                    <p style={{color:'#150C09',fontSize:13,fontWeight:700}}>GIF Animasi</p>
                  </div>
                  <p style={{color:'rgba(158,136,128,0.95)',fontSize:11,marginBottom:14,paddingLeft:15}}>Dibuat otomatis di browser</p>
                  {gifUrl?(
                    <button className="dl-btn" onClick={()=>handleDownload(gifUrl,`photobooth_gif_${uuid.slice(0,8)}.gif`)}
                      style={{background:'linear-gradient(135deg,#E83530,#C02018)',color:'#fff',boxShadow:'0 4px 16px rgba(212,43,34,.25)'}}>
                      <Download size={14}/>Download GIF
                    </button>
                  ):gifLoading?(
                    <button className="dl-btn" disabled style={{background:'rgba(212,43,34,.08)',color:'#E83530',border:'1px solid rgba(212,43,34,.15)'}}>
                      <div style={{width:13,height:13,border:'2px solid rgba(212,43,34,.3)',borderTopColor:'#E83530',borderRadius:'50%',animation:'spin .8s linear infinite'}}/>
                      Membuat GIF... {gifProgress}%
                    </button>
                  ):gifError?(
                    <button className="dl-btn" onClick={retryGif}
                      style={{background:'rgba(212,43,34,.08)',color:'#E83530',border:'1px solid rgba(212,43,34,.15)'}}>
                      <Sparkles size={14}/>Coba Lagi
                    </button>
                  ):(
                    <button className="dl-btn" onClick={()=>setActiveTab('gif')}
                      style={{background:'rgba(212,43,34,.08)',color:'#E83530',border:'1px solid rgba(212,43,34,.15)'}}>
                      <Sparkles size={14}/>Buat GIF
                    </button>
                  )}
                </div>
              )}

              <div className="fu4" style={{textAlign:'center',paddingTop:4}}>
                <p style={{color:'rgba(212,43,34,0.08)',fontSize:10,letterSpacing:'1.5px',fontFamily:'Poppins,sans-serif',textTransform:'uppercase'}}>Powered by</p>
                <p style={{color:'rgba(158,136,128,0.95)',fontSize:15,fontWeight:700,fontFamily:'Poppins,sans-serif',marginTop:2}}>{clientName}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {lightbox&&(
        <div className="lb" onClick={()=>setLightbox(null)}
          style={{position:'fixed',inset:0,zIndex:200,background:'rgba(0,0,0,.92)',backdropFilter:'blur(12px)',display:'flex',alignItems:'center',justifyContent:'center',padding:20,cursor:'pointer'}}>
          <img src={lightbox} alt="Preview"
            style={{maxWidth:'92vw',maxHeight:'92vh',objectFit:'contain',borderRadius:12,boxShadow:'0 32px 64px rgba(0,0,0,.8)'}}
            onClick={e=>e.stopPropagation()}/>
          <button onClick={()=>setLightbox(null)}
            style={{position:'fixed',top:16,right:16,background:'rgba(212,43,34,0.08)',border:'1px solid rgba(212,43,34,0.10)',borderRadius:'50%',width:40,height:40,color:'#150C09',fontSize:18,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center'}}>
            ✕
          </button>
        </div>
      )}
    </>
  )
}