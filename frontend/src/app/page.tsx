import type { Metadata } from 'next'
import Landing from './Landing'

/* Root "/" adalah halaman sewa photobooth. Dashboard tetap bisa dibuka di
   /dashboard dan /login sampai subdomain app.pabrikenangan.my.id disiapkan. */
export const metadata: Metadata = {
  title: 'Sewa Photobooth Bandar Lampung | Pabrik Kenangan',
  description:
    'Sewa photobooth untuk pernikahan, ulang tahun, dan acara kantor di Bandar Lampung. Cetak 4R langsung di lokasi, plus GIF animasi dan live photo lewat QR.',
  openGraph: {
    title: 'Sewa Photobooth Bandar Lampung | Pabrik Kenangan',
    description:
      'Cetak 4R langsung di lokasi, plus GIF animasi dan live photo lewat QR. Operator, kertas, dan properti sudah termasuk.',
    type: 'website',
    locale: 'id_ID',
  },
}

export default function RootPage() {
  return <Landing />
}
