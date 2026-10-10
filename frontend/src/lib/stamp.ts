/*
 * Promo kartu stamp — konfigurasi papan dan aturan yang dipakai bersama oleh
 * halaman /stamp (tampilan + ekspor gambar) dan API /api/stamp.
 *
 * Papan digambar di kanvas 1080x1920 (ukuran Story IG). Tampilan di layar dan
 * gambar yang diunduh memakai SATU daftar slot ini, jadi yang dilihat
 * pelanggan sama persis dengan yang mereka posting.
 *
 * Mengganti desain papan cukup dengan mengganti berkas di public/stamp/:
 *   papan.jpg  latar 1080x1920 (gabus, judul, dsb.), di belakang strip
 *   stiker.png opsional, lapisan transparan 1080x1920 di DEPAN strip
 * lalu menyesuaikan SLOT_STAMP di bawah bila posisi strip ikut berubah.
 */

export const KLIEN_STAMP = '8b7e2163-239b-4267-8f8a-f088ee3541a5' // Pabrik Kenangan
export const JUMLAH_STAMP = 5

export const PAPAN_W = 1080
export const PAPAN_H = 1920
export const LATAR_PAPAN = '/stamp/papan.jpg'
export const STIKER_PAPAN: string | null = '/stamp/stiker.png'

export type Hiasan = 'pin' | 'selotip' | 'klip'

/*
 * Kotak tempat strip ditempel, dalam piksel kanvas 1080x1920. Strip dipasang
 * "contain" di tengah kotak (4R berdiri 2:3, koran A4 sedikit lebih ramping).
 * rot = derajat searah jarum jam, poros di tengah kotak, sama seperti CSS.
 * Urutan = urutan tumpukan: slot belakang ditimpa slot sesudahnya.
 */
export type SlotStamp = { x: number; y: number; w: number; h: number; rot: number; hiasan: Hiasan; warna: string }

export const SLOT_STAMP: SlotStamp[] = [
  // Artboard "Photobooth Recap" (desain pemilik, 10 Okt 2026): 3 strip kecil
  // di baris atas, 2 strip lebih besar di bawah.
  { x: 118, y: 705,  w: 270, h: 405, rot: -4, hiasan: 'pin', warna: '#E8508A' },
  { x: 405, y: 690,  w: 270, h: 405, rot: 2,  hiasan: 'pin', warna: '#E8508A' },
  { x: 692, y: 705,  w: 270, h: 405, rot: 5,  hiasan: 'pin', warna: '#E8508A' },
  { x: 225, y: 1170, w: 300, h: 450, rot: 3,  hiasan: 'pin', warna: '#E8508A' },
  { x: 560, y: 1165, w: 300, h: 450, rot: -3, hiasan: 'pin', warna: '#E8508A' },
]

// Papan sengaja TIDAK memuat kode kartu (pemilik: merusak estetika). Admin
// mencocokkan postingan IG lewat username yang diisi pelanggan.

/** Ukuran gambar setelah dipasang "contain" di kotak slot. */
export function pasDiSlot(slot: SlotStamp, lebarAsli: number, tinggiAsli: number) {
  const skala = Math.min(slot.w / lebarAsli, slot.h / tinggiAsli)
  const w = lebarAsli * skala
  const h = tinggiAsli * skala
  return { w, h, x: slot.x + (slot.w - w) / 2, y: slot.y + (slot.h - h) / 2 }
}

/*
 * Ambil kode sesi dari apa pun yang ditempel pelanggan: tautan lengkap
 * (https://www.pabrikenangan.my.id/download/sesi-123), tautan tanpa https,
 * atau kodenya saja.
 */
export function kodeDariTautan(masukan: string): string | null {
  const teks = masukan.trim()
  if (!teks) return null
  const cocok = teks.match(/\/download\/([^/?#\s]+)/i)
  const kode = cocok ? decodeURIComponent(cocok[1]) : teks
  return /^[A-Za-z0-9_-]{6,80}$/.test(kode) ? kode : null
}

/** Username IG tanpa "@" dan tanpa tautan profil; null bila tidak sah. */
export function bersihkanIg(masukan: string): string | null {
  let u = masukan.trim()
  const tautan = u.match(/instagram\.com\/([^/?#\s]+)/i)
  if (tautan) u = tautan[1]
  u = u.replace(/^@+/, '').toLowerCase()
  return /^[a-z0-9._]{1,30}$/.test(u) ? u : null
}

/** Thumbnail strip lewat optimasi gambar Next (asli di R2 2-12 MB). */
export function gambarKecil(url: string, lebar = 828) {
  return `/_next/image?url=${encodeURIComponent(url)}&w=${lebar}&q=75`
}
