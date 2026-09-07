import type { Metadata } from 'next'
import KarirForm from './KarirForm'

// Halaman publik yang dibagikan lewat link atau QR, jadi metadata-nya ikut
// terbaca saat link ditempel di WhatsApp/Instagram. Tidak ada data yang perlu
// diambil server: seluruh isinya statis sampai orangnya menekan kirim.

export const metadata: Metadata = {
  title: 'Gabung Jadi Crew - Pabrik Kenangan',
  description:
    'Daftar jadi crew freelance photobooth Pabrik Kenangan. Cukup tinggalkan nama dan nomor WhatsApp.',
}

export default function KarirPage() {
  return <KarirForm />
}
