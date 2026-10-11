import { ArrowRight } from 'lucide-react'

/*
 * Info promo Papan Kenangan ("foto 5x, yang ke-6 gratis") di halaman download.
 * Hanya mengenalkan promonya; menempel strip tetap dilakukan di /stamp.
 * Gambarnya contoh papan terisi dari artboard pemilik (public/stamp).
 *
 * Judul "Gratis Photobooth!" permintaan pemilik (b kecil Bristol mirip "l");
 * baris kuning sengaja tanpa huruf "b".
 */
export default function PapanSection() {
  return (
    <section className="blok papan-promo">
      <h2 className="sub-judul">
        <span>Gratis Photobooth!</span>
        <span className="kuning">untuk kamu yang udah ngumpulin 5 sesi foto</span>
      </h2>
      <p className="teks papan-ket">
        Caranya gampang: tiap habis foto, pin stripnya ke Papan Kenangan. Udah
        nempel lima, pamerin papannya di IG dan tag @pabrikenangan. Voucher
        sesi gratisnya kami kirim lewat DM.
      </p>

      <img
        className="papan-contoh"
        src="/stamp/contoh-terisi.webp"
        alt="Contoh Papan Kenangan yang sudah terisi lima photo strip"
        width={828}
        height={1472}
        loading="lazy"
      />

      <a className="tombol kuning" style={{ marginTop: 26 }} href="/stamp">
        Mulai pin strip<ArrowRight size={18} />
      </a>
      <p className="teks papan-catatan">
        Di sana tinggal tempel link halaman ini. Berlaku untuk sesi berbayar.
      </p>
    </section>
  )
}
