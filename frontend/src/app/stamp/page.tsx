import type { Metadata } from 'next'
import Stamp from './Stamp'

/*
 * /stamp — Papan Kenangan, promo "foto 5x, sesi ke-6 gratis".
 *
 * Pelanggan menempel link halaman download tiap sesinya; strip hasil foto
 * ditempel ke papan gabus. Setelah 5 stamp, papannya disimpan sebagai gambar
 * Story IG, diposting dengan tag @pabrikenangan, lalu admin mengirim voucher.
 * Tanpa login: kartu diingat lewat localStorage HP pelanggan.
 */
export const metadata: Metadata = {
  title: 'Papan Kenangan | Pabrik Kenangan',
  description: 'Foto 5x di Pabrik Kenangan, yang ke-6 kami traktir. Pin tiap hasil fotomu ke Papan Kenangan dan ambil sesi gratisnya.',
  openGraph: {
    title: 'Papan Kenangan · Pabrik Kenangan',
    description: 'Foto 5x, yang ke-6 kami traktir!',
    type: 'website',
    locale: 'id_ID',
  },
}

export default function StampPage() {
  return <Stamp />
}
