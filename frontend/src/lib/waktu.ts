/*
 * WAKTU SELALU WIB (Asia/Jakarta), APA PUN ZONA MESIN YANG MERENDER.
 *
 * Server Vercel berjalan di UTC. Tanpa zona eksplisit:
 * - `toLocaleString('id-ID')` di server component menampilkan jam 7 jam
 *   lebih awal (sesi pukul 15.10 WIB tertulis 08.10);
 * - `new Date().setHours(0,0,0,0)` berarti pukul 07.00 WIB, sehingga
 *   "hari ini" melewatkan sesi dini hari dan memasukkannya ke hari kemarin;
 * - `new Date('2026-09-14T00:00:00')` untuk filter tanggal juga dibaca UTC.
 * Indonesia tidak memakai DST, jadi offset tetap +07:00 aman.
 */
export const ZONA = 'Asia/Jakarta'
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

/** Awal hari (00.00 WIB) dari `sekarang`, sebagai Date UTC. */
export function awalHariJakarta(sekarang = new Date()): Date {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS)
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate()) - WIB_OFFSET_MS)
}

/** Awal bulan (tanggal 1, 00.00 WIB) dari `sekarang`, sebagai Date UTC. */
export function awalBulanJakarta(sekarang = new Date()): Date {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS)
  return new Date(Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1) - WIB_OFFSET_MS)
}

/** Tanggal `YYYY-MM-DD` menurut kalender WIB. */
export function tanggalJakarta(d = new Date()): string {
  return d.toLocaleDateString('en-CA', { timeZone: ZONA })
}

/** Rentang ISO satu hari WIB penuh untuk `YYYY-MM-DD` (awal inklusif, akhir inklusif). */
export function rentangHariJakarta(ymd: string): { dari: string; sampai: string } {
  const dari = new Date(`${ymd}T00:00:00+07:00`)
  return { dari: dari.toISOString(), sampai: new Date(dari.getTime() + 86_400_000 - 1).toISOString() }
}

/** `toLocaleString('id-ID')` yang dipaku ke WIB. */
export function formatWaktu(
  d: string | number | Date,
  opsi: Intl.DateTimeFormatOptions = { dateStyle: 'short', timeStyle: 'short' },
): string {
  return new Date(d).toLocaleString('id-ID', { ...opsi, timeZone: ZONA })
}
