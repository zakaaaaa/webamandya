import { NextResponse } from 'next/server'

import { DASH_COOKIE, buatSesi, opsiCookie } from '@/lib/dash-auth'

/*
 * Pintu masuk dash.pabrikenangan.my.id.
 *
 * POST   { sandi }  -> setel cookie sesi kalau sandinya benar
 * DELETE            -> hapus cookie (keluar)
 *
 * Jeda 600ms pada sandi salah. Ini bukan teater keamanan: endpoint-nya terbuka
 * di internet dan sandinya cuma satu, jadi menebak berulang-ulang adalah
 * serangan yang paling masuk akal di sini. Jeda itu mengubah "ribuan tebakan
 * per menit" menjadi "seratusan", dan itu selisih yang menentukan.
 */

const JEDA_SALAH_MS = 600

export async function POST(req: Request) {
  const sandiAsli = process.env.DASH_PASSWORD ?? ''
  if (!sandiAsli) {
    // Salah pasang, bukan salah pengguna. Kalau env belum diisi, JANGAN
    // membiarkan siapa pun masuk dengan sandi kosong.
    console.error('[dash] DASH_PASSWORD belum disetel di environment')
    return NextResponse.json(
      { error: 'Dasbor belum dikonfigurasi. Hubungi pengelola.' },
      { status: 503 },
    )
  }

  let sandi = ''
  try {
    const body = await req.json()
    sandi = typeof body.sandi === 'string' ? body.sandi : ''
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak terbaca.' }, { status: 400 })
  }

  if (sandi !== sandiAsli) {
    await new Promise((r) => setTimeout(r, JEDA_SALAH_MS))
    return NextResponse.json({ error: 'Kata sandi salah.' }, { status: 401 })
  }

  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASH_COOKIE, await buatSesi(sandiAsli), opsiCookie())
  return res
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true })
  res.cookies.set(DASH_COOKIE, '', { ...opsiCookie(), maxAge: 0 })
  return res
}
