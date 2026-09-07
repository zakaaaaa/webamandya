/*
 * Sesi dash.pabrikenangan.my.id — satu kata sandi bersama, bukan akun per orang.
 *
 * KENAPA BUKAN SUPABASE AUTH
 * Dasbor ini sengaja dipisah dari app.pabrikenangan.my.id yang memakai
 * admin_users. Di sini tidak ada konsep "siapa", hanya "boleh masuk atau
 * tidak", jadi menyeret seluruh mesin auth Supabase ke sini hanya menambah
 * bagian yang bisa rusak.
 *
 * BENTUK COOKIE-NYA: "<terbit>.<tanda tangan>"
 * Tanda tangan = HMAC-SHA256 dengan kunci = kata sandi itu sendiri. Tiga akibat
 * yang memang diinginkan:
 *   1. Tidak ada rahasia kedua yang harus dijaga. Kunci HMAC-nya ya sandi itu.
 *   2. Mengganti DASH_PASSWORD otomatis mematikan semua sesi yang beredar —
 *      tanda tangan lama tidak akan pernah cocok lagi. Ini satu-satunya cara
 *      "logout paksa" pada model sandi bersama.
 *   3. Stempel waktu ikut ditandatangani, jadi umur sesi tidak bisa dipalsukan
 *      dari sisi browser.
 *
 * Web Crypto, bukan node:crypto — berkas ini dipakai proxy.ts yang berjalan di
 * runtime edge Vercel, dan node:crypto tidak ada di sana.
 */

export const DASH_COOKIE = 'dash_sesi'

// 30 hari. Dasbor ini dibuka dari HP di sela acara; memaksa masuk ulang tiap
// beberapa jam akan membuat sandinya diketik di tempat umum berkali-kali.
const UMUR_SESI_MS = 30 * 24 * 60 * 60 * 1000

const PESAN = 'dash-talent-v1'

function b64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let s = ''
  for (const b of bytes) s += String.fromCharCode(b)
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function tandaTangan(sandi: string, terbit: string): Promise<string> {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey(
    'raw', enc.encode(sandi), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  )
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(`${PESAN}|${terbit}`))
  return b64url(sig)
}

/** Bandingkan tanpa keluar lebih awal saat karakter pertama berbeda. */
function samaPersis(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let beda = 0
  for (let i = 0; i < a.length; i++) beda |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return beda === 0
}

/** Nilai cookie untuk sesi baru. */
export async function buatSesi(sandi: string): Promise<string> {
  const terbit = String(Date.now())
  return `${terbit}.${await tandaTangan(sandi, terbit)}`
}

/**
 * True kalau cookie sah DAN belum kedaluwarsa.
 *
 * Mengembalikan false (bukan melempar) untuk apa pun yang aneh: cookie kosong,
 * bentuk salah, stempel waktu bukan angka. Halaman ini dibuka dari internet
 * terbuka, dan galat yang bocor ke pengunjung hanya memberi tahu penebak
 * seberapa jauh tebakannya benar.
 */
export async function sesiSah(nilai: string | undefined, sandi: string): Promise<boolean> {
  if (!nilai || !sandi) return false
  const titik = nilai.indexOf('.')
  if (titik < 1) return false

  const terbit = nilai.slice(0, titik)
  const sig = nilai.slice(titik + 1)

  const ms = Number(terbit)
  if (!Number.isFinite(ms) || ms <= 0) return false
  if (Date.now() - ms > UMUR_SESI_MS) return false

  return samaPersis(sig, await tandaTangan(sandi, terbit))
}

/** Opsi cookie yang sama di tempat mana pun cookie ini disetel. */
export function opsiCookie() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    path: '/',
    maxAge: Math.floor(UMUR_SESI_MS / 1000),
  }
}
