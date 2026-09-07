import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { DASH_COOKIE, sesiSah } from '@/lib/dash-auth'
import TalentClient from './TalentClient'

export const metadata: Metadata = {
  title: 'Talent Pool - Pabrik Kenangan',
  robots: { index: false, follow: false },
}

// Angka pendapatan berubah tiap sesi selesai; halaman ini tidak boleh disajikan
// dari cache prerender.
export const dynamic = 'force-dynamic'

/*
 * BATAS HARI MEMAKAI WAKTU JAKARTA, BUKAN UTC.
 *
 * Server Vercel berjalan di UTC. `new Date().setHours(0,0,0,0)` di sana berarti
 * pukul 07.00 WIB — jadi "pendapatan hari ini" akan kosong sepanjang pagi dan
 * pendapatan sebelum pukul 07.00 terhitung ke hari sebelumnya. Untuk photobooth
 * yang justru ramai malam hari, selisih itu mengubah angkanya secara mencolok.
 */
const WIB_OFFSET_MS = 7 * 60 * 60 * 1000

function awalHariJakarta(sekarang = new Date()): Date {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS)
  const utcTengahMalamWib = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), wib.getUTCDate())
  return new Date(utcTengahMalamWib - WIB_OFFSET_MS)
}

function awalBulanJakarta(sekarang = new Date()): Date {
  const wib = new Date(sekarang.getTime() + WIB_OFFSET_MS)
  const utcAwalBulanWib = Date.UTC(wib.getUTCFullYear(), wib.getUTCMonth(), 1)
  return new Date(utcAwalBulanWib - WIB_OFFSET_MS)
}

function jumlahkan(rows: { amount: number | string | null }[] | null): number {
  return rows?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0
}

export default async function TalentPage() {
  // Proxy sudah menjaga host dash, tapi pemeriksaan diulang di sini: kalau
  // suatu saat matcher proxy berubah, halaman ini tidak boleh ikut terbuka
  // diam-diam bersama perubahan itu.
  const jar = await cookies()
  if (!(await sesiSah(jar.get(DASH_COOKIE)?.value, process.env.DASH_PASSWORD ?? ''))) {
    redirect('/masuk')
  }

  // Service role: crew_applicants menyala RLS tanpa satu pun policy, jadi anon
  // key tidak akan mengembalikan apa pun di sini.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )

  const hariIni = awalHariJakarta().toISOString()
  const bulanIni = awalBulanJakarta().toISOString()

  const [
    { data: pelamar },
    { data: pendapatanHari },
    { data: pendapatanBulan },
    { count: sesiHari },
  ] = await Promise.all([
    supabase
      .from('crew_applicants')
      .select('id, full_name, phone, social, status, created_at')
      .order('created_at', { ascending: false }),
    supabase.from('sessions').select('amount').eq('payment_status', 'paid').gte('created_at', hariIni),
    supabase.from('sessions').select('amount').eq('payment_status', 'paid').gte('created_at', bulanIni),
    supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', hariIni),
  ])

  return (
    <TalentClient
      pelamar={pelamar ?? []}
      pendapatanHari={jumlahkan(pendapatanHari)}
      pendapatanBulan={jumlahkan(pendapatanBulan)}
      sesiHari={sesiHari ?? 0}
    />
  )
}
