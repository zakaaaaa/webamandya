import { createClient } from '@supabase/supabase-js'
import DownloadPage from './DownloadPage'

export default async function Page({ params }: { params: Promise<{ uuid: string }> }) {
  const { uuid } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: session, error } = await supabase
    .from('sessions')
    .select(`id, transaction_code, payment_status, created_at, result_url, gif_url, gif_status, video_url, video_status, clients(name, email), devices(device_name)`)
    .eq('transaction_code', uuid)
    .maybeSingle()

  // Halaman ini dibuka pelanggan dari QR code. Kalau kodenya salah ketik atau
  // sesinya sudah dihapus, jangan lempar pesan teknis — cukup beri tahu
  // dengan bahasa manusia. Detail error tetap ada di log server.
  if (!session) {
    if (error) console.error('[download] gagal memuat sesi', uuid, error.message)
    return (
      <div style={{
        minHeight:'100dvh', background:'#FAF7F5', color:'#150C09',
        fontFamily:"'Poppins',sans-serif",
        display:'flex', alignItems:'center', justifyContent:'center', padding:24,
      }}>
        <div style={{ textAlign:'center', maxWidth:360 }}>
          <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110}
            style={{ width:150, height:'auto', margin:'0 auto 24px', display:'block' }}/>
          <h1 style={{ fontSize:20, fontWeight:800, marginBottom:8, letterSpacing:'-0.01em' }}>
            Sesi tidak ditemukan
          </h1>
          <p style={{ fontSize:13.5, color:'#9E8880', lineHeight:1.6 }}>
            Link ini sudah tidak berlaku atau kodenya keliru. Coba scan ulang QR code
            di layar photobooth, atau hubungi petugas di lokasi.
          </p>
          <code style={{ display:'block', marginTop:20, fontSize:10, color:'#C7B8B2', fontFamily:'monospace' }}>
            {uuid}
          </code>
        </div>
      </div>
    )
  }

  const { data: photos } = await supabase
    .from('photos')
    .select('photo_url, photo_order')
    .eq('session_id', session.id)
    .order('photo_order', { ascending: true })

  const photoCount = photos?.length ?? 4

  // Ambil frame info berdasarkan jumlah foto
  const { data: frameInfo } = await supabase
    .from('frames')
    .select('output_width, output_height')
    .eq('photo_count', photoCount)
    .maybeSingle()

  const normalizedSession = {
    ...session,
    clients: Array.isArray(session.clients) ? session.clients[0] ?? null : session.clients,
    devices: Array.isArray(session.devices) ? session.devices[0] ?? null : session.devices,
  }

  return (
    <DownloadPage
      session={normalizedSession}
      photos={photos ?? []}
      uuid={uuid}
      frameWidth={frameInfo?.output_width ?? 344}
      frameHeight={frameInfo?.output_height ?? 515}
    />
  )
}
