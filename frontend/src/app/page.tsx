import type { Metadata } from 'next'
import { Bagel_Fat_One, Plus_Jakarta_Sans } from 'next/font/google'
import Landing from './Landing'

/* Font khusus landing; dashboard tetap memakai Poppins dari globals.css. */
const bagel = Bagel_Fat_One({ weight: '400', subsets: ['latin'], variable: '--font-bagel', display: 'swap' })
const jakarta = Plus_Jakarta_Sans({ weight: ['400', '500', '600', '700'], subsets: ['latin'], variable: '--font-jakarta', display: 'swap' })

/* Root "/" adalah halaman sewa photobooth. Dashboard ada di app.pabrikenangan.my.id. */
export const metadata: Metadata = {
  title: 'Sewa Photobooth Bandar Lampung | Pabrik Kenangan',
  description:
    'Sewa photobooth untuk pernikahan, ulang tahun, dan acara kantor di Bandar Lampung. Cetak 4R langsung di lokasi, plus video slideshow dan live photo lewat QR.',
  openGraph: {
    title: 'Sewa Photobooth Bandar Lampung | Pabrik Kenangan',
    description:
      'Cetak 4R langsung di lokasi, plus video slideshow dan live photo lewat QR. Operator, kertas, dan properti sudah termasuk.',
    type: 'website',
    locale: 'id_ID',
  },
}

export default function RootPage() {
  return (
    <div className={`${bagel.variable} ${jakarta.variable}`}>
      <Landing />
    </div>
  )
}
