import { createClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { DASH_COOKIE, sesiSah } from '@/lib/dash-auth'
import TalentClient from './TalentClient'
import { awalBulanJakarta, awalHariJakarta } from '@/lib/waktu'

export const metadata: Metadata = {
  title: 'Talent Pool - Pabrik Kenangan',
  robots: { index: false, follow: false },
}

// Angka pendapatan berubah tiap sesi selesai; halaman ini tidak boleh disajikan
// dari cache prerender.
export const dynamic = 'force-dynamic'

// Batas hari & bulan memakai WIB, bukan UTC server Vercel — lihat lib/waktu.

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
    // Sama dengan dasbor: hanya sesi lunas/gratis, tanpa baris Tambah Cetakan.
    supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', hariIni)
      .in('payment_status', ['paid', 'free'])
      .or('transaction_type.is.null,transaction_type.neq.extra_print'),
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
