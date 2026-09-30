import type { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import Dlogok, { type FrameKatalog } from './Dlogok'

/*
 * /dlogok — halaman yang dibuka dari QR tent card di meja warmindo d'Logok.
 * Pengunjungnya sedang duduk makan dan memegang HP, jadi halaman ini dibuat
 * mobile-first: promo, harga per jenis cetakan, contoh hasil, katalog frame,
 * dan cara foto.
 *
 * Katalog frame dibaca langsung dari tabel frames (hanya yang aktif) supaya
 * frame baru dari dasbor ikut muncul tanpa deploy ulang. Di-cache 10 menit.
 */

export const revalidate = 600

export const metadata: Metadata = {
  title: "Photobooth di d'Logok | Pabrik Kenangan",
  description:
    "Kelar makan, foto dulu yuk! Photobooth Pabrik Kenangan di d'Logok mulai Rp20.000: strip cetak, soft file, GIF, dan video.",
  openGraph: {
    title: "Photobooth di d'Logok | Pabrik Kenangan",
    description: 'Kelar makan, foto dulu yuk! Mulai Rp20.000 per sesi.',
    type: 'website',
    locale: 'id_ID',
  },
}

// Klien Pabrik Kenangan — pemilik booth di d'Logok.
const KLIEN_PK = '8b7e2163-239b-4267-8f8a-f088ee3541a5'

type SlotMentah = { x: number; y: number; width: number; height: number; rotation?: number; photo_index?: number }

async function ambilFrame(): Promise<FrameKatalog[]> {
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )
    const { data } = await supabase
      .from('frames')
      .select('id, name, thumbnail_url, image_url, sort_order, output_width, output_height, photo_slots, frame_categories(name)')
      .eq('client_id', KLIEN_PK)
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
    return (data ?? []).map((f) => {
      const kat = f.frame_categories as unknown as { name?: string } | null
      return {
        id: f.id as string,
        nama: (f.name as string).trim(),
        gambar: (f.thumbnail_url || f.image_url) as string,
        kategori: kat?.name ?? '4R',
        lebar: Number(f.output_width) || 344,
        tinggi: Number(f.output_height) || 515,
        slot: ((f.photo_slots as SlotMentah[] | null) ?? []).map((sl) => ({
          x: sl.x, y: sl.y, w: sl.width, h: sl.height,
          putar: sl.rotation ?? 0, foto: sl.photo_index ?? 0,
        })),
      }
    })
  } catch {
    // Katalog gagal dimuat bukan alasan halaman promo ikut gagal.
    return []
  }
}

export default async function DlogokPage() {
  const frames = await ambilFrame()
  return <Dlogok frames={frames} />
}
