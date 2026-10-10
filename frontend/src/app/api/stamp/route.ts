import { createHash, randomBytes, randomInt } from 'node:crypto'
import { createClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { JUMLAH_STAMP, KLIEN_STAMP, bersihkanIg, kodeDariTautan } from '@/lib/stamp'

/*
 * POST /api/stamp — semua aksi Papan Kenangan pelanggan (halaman /stamp).
 *
 *   { aksi: 'buat' }                          -> kartu baru { id, token, ... }
 *   { aksi: 'lihat',  id, token }             -> isi kartu
 *   { aksi: 'klaim',  id, token, tautan }     -> tempel satu sesi
 *   { aksi: 'ajukan', id, token, ig }         -> minta hadiah (5 stamp penuh)
 *
 * Pelanggan tidak login. Kepemilikan kartu dibuktikan dengan token acak yang
 * hanya disimpan di localStorage HP-nya; server hanya menyimpan hash-nya.
 */

type Kartu = {
  id: string; kode: string; token_hash: string; ig_username: string | null
  diajukan_at: string | null; voucher_kode: string | null; hadiah_at: string | null
  created_at: string
}

const db = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
)

const hash = (token: string) => createHash('sha256').update(token).digest('hex')

// Tanpa huruf/angka yang mirip (0/O, 1/I/L) karena kodenya dibaca dari foto.
const ABJAD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const kodeAcak = () => 'PK-' + Array.from({ length: 6 }, () => ABJAD[randomInt(ABJAD.length)]).join('')

const gagal = (pesan: string, status = 400) => NextResponse.json({ error: pesan }, { status })

async function ambilKartu(supabase: ReturnType<typeof db>, id: unknown, token: unknown) {
  if (typeof id !== 'string' || typeof token !== 'string' || !/^[0-9a-f-]{36}$/i.test(id)) return null
  const { data } = await supabase
    .from('stamp_cards')
    .select('id, kode, token_hash, ig_username, diajukan_at, voucher_kode, hadiah_at, created_at')
    .eq('id', id)
    .maybeSingle<Kartu>()
  if (!data || data.token_hash !== hash(token)) return null
  return data
}

async function isiKartu(supabase: ReturnType<typeof db>, kartu: Kartu) {
  const { data: klaim } = await supabase
    .from('stamp_claims')
    .select('urutan, created_at, sessions(result_url, created_at)')
    .eq('card_id', kartu.id)
    .order('urutan')
  return {
    id: kartu.id,
    kode: kartu.kode,
    ig_username: kartu.ig_username,
    diajukan_at: kartu.diajukan_at,
    voucher_kode: kartu.voucher_kode,
    hadiah_at: kartu.hadiah_at,
    stamps: (klaim ?? []).map((k) => {
      const s = k.sessions as unknown as { result_url: string | null; created_at: string } | null
      return { urutan: k.urutan as number, gambar: s?.result_url ?? null, tanggal_sesi: s?.created_at ?? null }
    }),
  }
}

export async function POST(request: Request) {
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return gagal('Permintaan tidak sah.') }
  const supabase = db()

  if (body.aksi === 'buat') {
    const token = randomBytes(24).toString('base64url')
    // Kode bentrok sangat jarang (31^6 ≈ 887 juta), tapi tetap dicoba ulang.
    for (let i = 0; i < 5; i++) {
      const { data, error } = await supabase
        .from('stamp_cards')
        .insert({ client_id: KLIEN_STAMP, kode: kodeAcak(), token_hash: hash(token) })
        .select('id, kode, token_hash, ig_username, diajukan_at, voucher_kode, hadiah_at, created_at')
        .single<Kartu>()
      if (!error && data) return NextResponse.json({ token, kartu: await isiKartu(supabase, data) })
      if (error?.code !== '23505') break
    }
    return gagal('Papan gagal dibuat, coba lagi.', 500)
  }

  const kartu = await ambilKartu(supabase, body.id, body.token)
  if (!kartu) return gagal('Papan tidak ditemukan.', 404)

  if (body.aksi === 'lihat') {
    return NextResponse.json({ kartu: await isiKartu(supabase, kartu) })
  }

  if (body.aksi === 'klaim') {
    const kode = kodeDariTautan(String(body.tautan ?? ''))
    if (!kode) return gagal('Itu bukan link hasil foto. Tempel link dari halaman download (…/download/…).')

    const { count } = await supabase
      .from('stamp_claims').select('id', { count: 'exact', head: true }).eq('card_id', kartu.id)
    const sudah = count ?? 0
    if (sudah >= JUMLAH_STAMP) return gagal('Papanmu sudah penuh. Saatnya pamer!')

    const { data: sesi } = await supabase
      .from('sessions')
      .select('id, client_id, payment_status, transaction_type, result_url')
      .eq('transaction_code', kode)
      .maybeSingle()

    if (!sesi || sesi.client_id !== KLIEN_STAMP) return gagal('Sesi foto tidak ditemukan. Cek lagi link-nya ya.')
    if (sesi.transaction_type === 'extra_print') return gagal('Tambah cetakan tidak bisa dipin. Pakai link dari sesi fotonya ya.')
    if (sesi.payment_status === 'free') return gagal('Sesi gratis atau pakai voucher tidak bisa dipin ke papan.')
    if (sesi.payment_status !== 'paid') return gagal('Sesi ini belum lunas, jadi belum bisa dipin.')
    if (!sesi.result_url) return gagal('Hasil foto sesi ini belum siap. Coba lagi beberapa menit lagi.')

    const { error } = await supabase
      .from('stamp_claims')
      .insert({ card_id: kartu.id, session_id: sesi.id, urutan: sudah + 1 })

    if (error?.code === '23505') {
      const { data: pemilik } = await supabase
        .from('stamp_claims').select('card_id').eq('session_id', sesi.id).maybeSingle()
      if (pemilik?.card_id === kartu.id) return gagal('Kenangan ini sudah ada di papanmu.')
      if (pemilik) return gagal('Kenangan ini sudah dipin di papan orang lain. Tiap sesi cuma bisa dipin sekali.')
      return gagal('Coba tempel sekali lagi.', 409)
    }
    if (error) return gagal('Gagal menempel, coba lagi.', 500)

    return NextResponse.json({ kartu: await isiKartu(supabase, kartu) })
  }

  if (body.aksi === 'ajukan') {
    if (kartu.hadiah_at) return gagal('Sesi gratis untuk papan ini sudah dikirim.')
    const ig = bersihkanIg(String(body.ig ?? ''))
    if (!ig) return gagal('Username Instagram tidak sah.')

    const { count } = await supabase
      .from('stamp_claims').select('id', { count: 'exact', head: true }).eq('card_id', kartu.id)
    if ((count ?? 0) < JUMLAH_STAMP) return gagal(`Penuhi ${JUMLAH_STAMP} slot papanmu dulu ya.`)

    const { data, error } = await supabase
      .from('stamp_cards')
      .update({ ig_username: ig, diajukan_at: kartu.diajukan_at ?? new Date().toISOString() })
      .eq('id', kartu.id)
      .select('id, kode, token_hash, ig_username, diajukan_at, voucher_kode, hadiah_at, created_at')
      .single<Kartu>()
    if (error || !data) return gagal('Gagal mengirim, coba lagi.', 500)
    return NextResponse.json({ kartu: await isiKartu(supabase, data) })
  }

  return gagal('Aksi tidak dikenal.')
}
