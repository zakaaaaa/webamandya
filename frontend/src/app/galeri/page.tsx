import type { Metadata } from 'next'
import Galeri from './Galeri'

export const metadata: Metadata = {
  title: 'Galeri Hasil Photobooth | Pabrik Kenangan',
  description:
    'Strip foto, GIF animasi, dan live photo asli dari booth Pabrik Kenangan di Bandar Lampung, tanpa sunting.',
  openGraph: {
    title: 'Galeri Hasil Photobooth | Pabrik Kenangan',
    description: 'Strip foto, GIF animasi, dan live photo asli dari booth Pabrik Kenangan, tanpa sunting.',
    type: 'website',
    locale: 'id_ID',
  },
}

export default function GaleriPage() {
  return <Galeri />
}
