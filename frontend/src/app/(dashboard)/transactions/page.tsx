import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import TransactionsClient from './TransactionsClient'

type SP = {
  page?: string; status?: string; method?: string; device?: string
  client?: string; from?: string; to?: string; search?: string
}

const PER_PAGE = 25

export default async function TransactionsPage({
  searchParams,
}: {
  searchParams: Promise<SP>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users')
    .select('role,client_id,full_name')
    .eq('id', user.id)
    .single()
  if (!adminUser) redirect('/login')

  const isSuperAdmin  = adminUser.role === 'super_admin'
  const scopeClientId = adminUser.client_id

  const p    = await searchParams
  const page = Math.max(1, parseInt(p.page ?? '1') || 1)

  const filters = {
    status: p.status ?? '',
    method: p.method ?? '',
    device: p.device ?? '',
    // Admin biasa tidak boleh memilih client — scope-nya dipaksa di query.
    client: isSuperAdmin ? (p.client ?? '') : '',
    from:   p.from   ?? '',
    to:     p.to     ?? '',
    search: p.search ?? '',
  }

  // `to` mencakup seluruh hari itu, bukan tengah malam awal hari.
  const fromISO = filters.from ? new Date(`${filters.from}T00:00:00`).toISOString() : ''
  const toISO   = filters.to   ? new Date(`${filters.to}T23:59:59.999`).toISOString() : ''

  // Semua filter KECUALI status. Status dipisah supaya kartu statistik bisa
  // memecah jumlah per status di dalam rentang filter yang sama.
  const applyBase = (q: any) => {
    if (!isSuperAdmin)        q = q.eq('client_id', scopeClientId)
    else if (filters.client)  q = q.eq('client_id', filters.client)
    if (filters.method)       q = q.eq('payment_method', filters.method)
    if (filters.device)       q = q.eq('device_id', filters.device)
    if (fromISO)              q = q.gte('created_at', fromISO)
    if (toISO)                q = q.lte('created_at', toISO)
    if (filters.search)       q = q.ilike('transaction_code', `%${filters.search}%`)
    return q
  }

  const countBy = async (status?: string) => {
    let q = supabase.from('sessions').select('*', { count: 'exact', head: true })
    q = applyBase(q)
    if (status) q = q.eq('payment_status', status)
    const { count } = await q
    return count ?? 0
  }

  // Dropdown filter
  let devQ = supabase.from('devices').select('id,device_name').order('device_name')
  if (!isSuperAdmin) devQ = devQ.eq('client_id', scopeClientId)

  const [
    devicesRes,
    clientsRes,
    total, paidCount, pendingCount, expiredCount, freeCount,
    paidAmountsRes,
  ] = await Promise.all([
    devQ,
    isSuperAdmin
      ? supabase.from('clients').select('id,name').order('name')
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    countBy(),
    countBy('paid'),
    countBy('pending'),
    countBy('expired'),
    countBy('free'),
    applyBase(supabase.from('sessions').select('amount').eq('payment_status', 'paid')).limit(10000),
  ])

  const revenue = (paidAmountsRes.data ?? [])
    .reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0)

  // Daftar utama (halaman aktif)
  let listQ = supabase
    .from('sessions')
    .select(
      `id, transaction_code, payment_method, payment_status, amount, original_amount,
       created_at, paid_at, result_url, voucher_id,
       devices(id,device_name), clients(id,name)`,
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
  listQ = applyBase(listQ)
  if (filters.status) listQ = listQ.eq('payment_status', filters.status)
  listQ = listQ.range((page - 1) * PER_PAGE, page * PER_PAGE - 1)

  const { data: rows, count: filteredCount } = await listQ

  // Supabase mengembalikan relasi sebagai array pada beberapa bentuk query.
  const sessions = (rows ?? []).map((s: any) => ({
    ...s,
    devices: Array.isArray(s.devices) ? s.devices[0] ?? null : s.devices,
    clients: Array.isArray(s.clients) ? s.clients[0] ?? null : s.clients,
  }))

  return (
    <TransactionsClient
      sessions={sessions}
      devices={devicesRes.data ?? []}
      clients={clientsRes.data ?? []}
      isSuperAdmin={isSuperAdmin}
      filters={filters}
      currentPage={page}
      perPage={PER_PAGE}
      filteredCount={filteredCount ?? 0}
      stats={{
        total,
        paid: paidCount,
        pending: pendingCount,
        expired: expiredCount,
        free: freeCount,
        revenue,
      }}
    />
  )
}
