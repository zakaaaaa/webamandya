import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import VouchersClient from './VouchersClient'

export default async function VouchersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; status?: string; search?: string }>
}) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role,client_id,full_name').eq('id', user.id).single()

  if (adminUser?.role === 'super_admin') redirect('/dashboard')

  const clientId = adminUser?.client_id
  const params       = await searchParams
  const page         = Math.max(1, parseInt(params.page ?? '1'))
  const perPage      = 20
  const offset       = (page - 1) * perPage
  const statusFilter = params.status ?? ''
  const search       = params.search ?? ''

  let q = supabase.from('vouchers').select('*', { count: 'exact' })
    .eq('client_id', clientId).order('created_at', { ascending: false })

  if (statusFilter === 'active')   q = q.eq('is_active', true)
  if (statusFilter === 'inactive') q = q.eq('is_active', false)
  if (search) q = q.ilike('code', `%${search}%`)
  q = q.range(offset, offset + perPage - 1)

  const { data: vouchers, count } = await q

  const [
    { count: totalActive },
    { count: totalUsed },
    { data: usedToday },
  ] = await Promise.all([
    supabase.from('vouchers').select('*', { count:'exact', head:true }).eq('client_id', clientId).eq('is_active', true),
    supabase.from('vouchers').select('*', { count:'exact', head:true }).eq('client_id', clientId).gt('used_count', 0),
    supabase.from('sessions').select('id').eq('client_id', clientId).eq('payment_method', 'voucher')
      .gte('created_at', new Date(new Date().setHours(0,0,0,0)).toISOString()),
  ])

  return (
    <VouchersClient
      vouchers={vouchers ?? []}
      totalCount={count ?? 0}
      totalPages={Math.ceil((count ?? 0) / perPage)}
      currentPage={page}
      clientId={clientId}
      stats={{ totalActive: totalActive??0, totalUsed: totalUsed??0, usedToday: usedToday?.length??0, total: count??0 }}
      filters={{ status: statusFilter, search }}
    />
  )
}
