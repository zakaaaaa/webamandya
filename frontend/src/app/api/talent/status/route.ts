import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { NextResponse } from 'next/server'

import { DASH_COOKIE, sesiSah } from '@/lib/dash-auth'

/*
 * Ubah status penanganan satu pelamar.
 *
 * Rute /api/* TIDAK dilewati proxy (lihat matcher di proxy.ts), jadi
 * penjagaan sesi WAJIB diulang di sini. Kalau tidak, siapa pun yang menebak
 * alamat endpoint ini bisa mengubah data tanpa pernah melihat halaman masuk.
 */

const STATUS_SAH = new Set(['baru', 'dihubungi', 'siap', 'tidak_cocok'])

export async function POST(req: Request) {
  const jar = await cookies()
  const sah = await sesiSah(jar.get(DASH_COOKIE)?.value, process.env.DASH_PASSWORD ?? '')
  if (!sah) return NextResponse.json({ error: 'Tidak berwenang.' }, { status: 401 })

  let id = ''
  let status = ''
  try {
    const body = await req.json()
    id = typeof body.id === 'string' ? body.id : ''
    status = typeof body.status === 'string' ? body.status : ''
  } catch {
    return NextResponse.json({ error: 'Permintaan tidak terbaca.' }, { status: 400 })
  }

  // Divalidasi di sini juga, bukan hanya mengandalkan CHECK di Postgres:
  // pesan "status tidak dikenal" jauh lebih berguna daripada galat constraint
  // yang bocor apa adanya ke antarmuka.
  if (!id || !STATUS_SAH.has(status)) {
    return NextResponse.json({ error: 'Status tidak dikenal.' }, { status: 400 })
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const { error } = await supabase
    .from('crew_applicants')
    .update({ status })
    .eq('id', id)

  if (error) {
    console.error('[dash] gagal ubah status:', error.message)
    return NextResponse.json({ error: 'Gagal menyimpan.' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
