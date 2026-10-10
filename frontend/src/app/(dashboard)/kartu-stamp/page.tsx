import { redirect } from 'next/navigation'

import { ambilSesiAdmin } from '@/lib/admin-session'
import KartuStampClient, { type KartuAdmin } from './KartuStampClient'

/*
 * Papan Kenangan (promo stamp) — admin mengecek papan pelanggan yang sudah penuh (5 stamp),
 * mencocokkan postingan IG-nya, lalu membuat voucher sesi gratis.
 * Halaman pelanggannya ada di /stamp.
 */
export default async function KartuStampPage() {
  const { supabase, adminUser } = await ambilSesiAdmin()
  if (adminUser.role === 'super_admin') redirect('/dashboard')
  const clientId = adminUser.client_id ?? ''

  // Kartu tanpa stamp sama sekali tidak ditampilkan; itu pengunjung yang
  // baru mencoba lalu pergi.
  const { data } = await supabase
    .from('stamp_cards')
    .select('id, kode, ig_username, diajukan_at, voucher_kode, hadiah_at, created_at, stamp_claims!inner(urutan, created_at, sessions(transaction_code, result_url, created_at, amount))')
    .eq('client_id', clientId)
    .order('created_at', { ascending: false })
    .limit(300)

  const kartu: KartuAdmin[] = (data ?? []).map((k) => ({
    id: k.id,
    kode: k.kode,
    ig_username: k.ig_username,
    diajukan_at: k.diajukan_at,
    voucher_kode: k.voucher_kode,
    hadiah_at: k.hadiah_at,
    created_at: k.created_at,
    stamps: ((k.stamp_claims ?? []) as unknown as {
      urutan: number; created_at: string
      sessions: { transaction_code: string; result_url: string | null; created_at: string; amount: number | null } | null
    }[])
      .sort((a, b) => a.urutan - b.urutan)
      .map((s) => ({
        urutan: s.urutan,
        kode_sesi: s.sessions?.transaction_code ?? '',
        gambar: s.sessions?.result_url ?? null,
        tanggal_sesi: s.sessions?.created_at ?? s.created_at,
        harga: s.sessions?.amount ?? null,
      })),
  }))

  return <KartuStampClient kartu={kartu} clientId={clientId} />
}
