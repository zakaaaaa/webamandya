import { ambilSesiAdmin } from '@/lib/admin-session'
import GalleryClient from './GalleryClient'
import { rentangHariJakarta } from '@/lib/waktu'

export default async function GalleryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; device?: string; date?: string; search?: string }>
}) {
  const { supabase, adminUser } = await ambilSesiAdmin()

  const isSuperAdmin = adminUser?.role === 'super_admin'
  const clientId     = adminUser?.client_id

  const params   = await searchParams
  const page     = Math.max(1, parseInt(params.page ?? '1'))
  const perPage  = 24
  const offset   = (page - 1) * perPage
  const devFilter  = params.device ?? ''
  const dateFilter = params.date   ?? ''
  const search     = params.search ?? ''

  // Devices untuk filter dropdown
  let devQ = supabase.from('devices').select('id,device_name').order('device_name')
  if (!isSuperAdmin) devQ = devQ.eq('client_id', clientId)
  const { data: devices } = await devQ

  // Sessions dengan foto
  let q = supabase
    .from('sessions')
    .select(`
      id, transaction_code, created_at, result_url, payment_status, payment_method,
      devices(id,device_name),
      clients(name),
      photos(photo_url, photo_order)
    `, { count: 'exact' })
    .not('result_url', 'is', null)
    .order('created_at', { ascending: false })

  if (!isSuperAdmin)  q = q.eq('client_id', clientId)
  if (devFilter)      q = q.eq('device_id', devFilter)
  if (dateFilter) {
    const { dari, sampai } = rentangHariJakarta(dateFilter)
    q = q.gte('created_at', dari).lte('created_at', sampai)
  }
  if (search) q = q.ilike('transaction_code', `%${search}%`)
  q = q.range(offset, offset + perPage - 1)

  const { data: sessions, count } = await q
  const totalPages = Math.ceil((count ?? 0) / perPage)

  const normalized = (sessions ?? []).map((s: any) => ({
    ...s,
    devices: Array.isArray(s.devices) ? s.devices[0] ?? null : s.devices,
    clients: Array.isArray(s.clients) ? s.clients[0] ?? null : s.clients,
    photos:  (s.photos ?? []).sort((a: any, b: any) => a.photo_order - b.photo_order),
  }))

  return (
    <GalleryClient
      sessions={normalized}
      devices={devices ?? []}
      totalCount={count ?? 0}
      totalPages={totalPages}
      currentPage={page}
      isSuperAdmin={isSuperAdmin}
      filters={{ device: devFilter, date: dateFilter, search }}
    />
  )
}
