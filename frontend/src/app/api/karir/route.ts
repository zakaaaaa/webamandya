import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

/*
 * PENERIMA FORM TALENT POOL (/karir)
 *
 * Endpoint publik tanpa login, jadi tiga hal dijaga di sini:
 *
 *   1. Insert dikerjakan SERVER dengan service role, bukan dari browser.
 *      Tabel crew_applicants tidak punya policy RLS sama sekali, sehingga
 *      anon key yang ikut terbundel di JavaScript tidak bisa membaca daftar
 *      pelamar meski endpoint ini diketahui orang.
 *   2. Nomor dinormalisasi SEBELUM insert. Unique constraint pada kolom phone
 *      hanya berguna kalau semua baris memakai format yang sama.
 *   3. Bot pengisi form dijegal honeypot, bukan captcha. Halaman ini dibuka
 *      calon crew sambil berdiri di mana saja; captcha akan memakan lebih
 *      banyak pendaftar asli daripada spam yang dicegahnya.
 */

// Batas panjang nama. Bukan soal keamanan (Postgres text tidak terbatas),
// melainkan supaya satu baris tempelan teks panjang tidak masuk sebagai nama.
const NAMA_MIN = 2
const NAMA_MAX = 80

// Media sosial: opsional, dan panjangnya dibatasi karena orang cenderung
// menempel tautan penuh berikut seluruh parameter pelacaknya.
const SOSMED_MAX = 120

/**
 * Ubah apa pun yang diketik orang menjadi 62xxxxxxxxx.
 *
 * Yang benar-benar ditemui di lapangan: "0812...", "+62 812...", "62812...",
 * "812...", dan semuanya bisa bercampur spasi, strip, atau tanda kurung.
 * Mengembalikan null kalau hasilnya tidak masuk akal sebagai nomor HP.
 */
function normalisasiNomor(mentah: string): string | null {
  let d = mentah.replace(/\D/g, '')

  // "0062..." — hasil orang mengetik kode negara gaya lama.
  if (d.startsWith('00')) d = d.slice(2)

  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  else if (!d.startsWith('62')) return null

  // Nomor seluler Indonesia selalu 62 + 8 + 8..11 digit lagi.
  if (!/^628\d{7,11}$/.test(d)) return null

  return d
}

export async function POST(req: Request) {
  try {
    const body = await req.json()

    // Honeypot: input tersembunyi yang hanya diisi pengisi-otomatis. Dijawab
    // seolah berhasil supaya bot tidak belajar mencari celah lain.
    if (typeof body.website === 'string' && body.website.trim() !== '') {
      return NextResponse.json({ ok: true })
    }

    const nama = typeof body.nama === 'string' ? body.nama.trim().replace(/\s+/g, ' ') : ''
    const teleponMentah = typeof body.telepon === 'string' ? body.telepon : ''

    // Disimpan apa adanya, hanya dirapikan spasinya. Menebak platform dari
    // "@nama" lalu mengubahnya jadi tautan Instagram akan salah untuk orang
    // yang menulis akun TikTok-nya. Kosong berarti null, bukan string kosong,
    // supaya "tidak mengisi" bisa dibedakan dari "mengisi lalu dihapus".
    const sosmedMentah = typeof body.sosmed === 'string' ? body.sosmed.trim().replace(/\s+/g, ' ') : ''
    const sosmed = sosmedMentah === '' ? null : sosmedMentah.slice(0, SOSMED_MAX)

    if (nama.length < NAMA_MIN || nama.length > NAMA_MAX) {
      return NextResponse.json(
        { error: 'Nama belum diisi dengan benar.' },
        { status: 400 },
      )
    }

    const telepon = normalisasiNomor(teleponMentah)
    if (!telepon) {
      return NextResponse.json(
        { error: 'Nomor WhatsApp tidak dikenali. Contoh: 0812xxxxxxx.' },
        { status: 400 },
      )
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    const { error } = await supabase
      .from('crew_applicants')
      .insert({ full_name: nama, phone: telepon, social: sosmed })

    if (error) {
      // 23505 = unique_violation pada kolom phone. Ini bukan kegagalan dari
      // sisi pendaftar — datanya memang sudah ada — jadi dijawab sebagai
      // keadaan, bukan galat teknis.
      if (error.code === '23505') {
        return NextResponse.json({ ok: true, sudahTerdaftar: true })
      }
      console.error('[karir] gagal insert:', error.message)
      return NextResponse.json(
        { error: 'Pendaftaran gagal tersimpan. Coba lagi sebentar lagi.' },
        { status: 500 },
      )
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak terbaca.' }, { status: 400 })
  }
}
