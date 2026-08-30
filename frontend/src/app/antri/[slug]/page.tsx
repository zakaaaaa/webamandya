import { createClient } from '@supabase/supabase-js'
import QueuePage from './QueuePage'

// Halaman ini dibuka pengunjung dari QR di standee CETAK. Dua hal yang
// menentukan bentuknya:
//
//   1. Standee tidak bisa diralat. Slug yang salah ketik atau booth yang sudah
//      dibongkar harus dijawab dengan bahasa manusia, bukan 404 mentah.
//   2. Isi antreannya berubah tiap beberapa detik, jadi seluruh keadaan
//      diambil klien dari backend. Server hanya memastikan booth-nya ada dan
//      memberi namanya, supaya cat pertama tidak berkedip kosong.

export const dynamic = 'force-dynamic'

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  return {
    title: 'Antrean Photobooth — Pabrik Kenangan',
    description: `Ambil nomor antrean photobooth tanpa perlu berdiri mengantre.`,
    robots: { index: false },
    other: { slug },
  }
}

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { data: booth } = await supabase
    .from('device_queue_state')
    .select('queue_slug, devices(device_name)')
    .eq('queue_slug', slug.toLowerCase())
    .maybeSingle()

  if (!booth) {
    return (
      <div style={{
        minHeight: '100dvh', background: '#FAF7F5', color: '#150C09',
        fontFamily: "'Poppins',sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ textAlign: 'center', maxWidth: 340 }}>
          <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110}
            style={{ width: 140, height: 'auto', margin: '0 auto 24px', display: 'block' }} />
          <h1 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Booth tidak ditemukan</h1>
          <p style={{ fontSize: 13.5, color: '#9E8880', lineHeight: 1.6 }}>
            Kode booth ini tidak dikenal. Coba pindai ulang QR di standee, atau tanya
            petugas di lokasi.
          </p>
          <code style={{ display: 'block', marginTop: 20, fontSize: 11, color: '#C7B8B2', fontFamily: 'monospace' }}>
            /antri/{slug}
          </code>
        </div>
      </div>
    )
  }

  const devices = Array.isArray(booth.devices) ? booth.devices[0] : booth.devices

  return <QueuePage slug={booth.queue_slug} boothName={devices?.device_name ?? 'Photobooth'} />
}
