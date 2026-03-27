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
    .select(`id, transaction_code, payment_status, created_at, result_url, clients(name, email), devices(device_name)`)
    .eq('transaction_code', uuid)
    .maybeSingle()

  if (!session) {
    return (
      <div style={{ color:'white', padding:40, background:'#080614', minHeight:'100vh' }}>
        <h2>Session tidak ditemukan</h2>
        <p>UUID: {uuid}</p>
        <p>Error: {error?.message ?? 'null'}</p>
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
