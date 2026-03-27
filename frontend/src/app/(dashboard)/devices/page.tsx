import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import DevicesManager from './DevicesManager'

export default async function DevicesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role, client_id').eq('id', user.id).single()

  const isSuperAdmin = adminUser?.role === 'super_admin'

  // Ambil devices
  let devicesQuery = supabase
    .from('devices')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })

  if (!isSuperAdmin) {
    devicesQuery = devicesQuery.eq('client_id', adminUser?.client_id)
  }

  const { data: devices } = await devicesQuery

  // Ambil clients untuk dropdown (super admin only)
  const { data: clients } = isSuperAdmin
    ? await supabase.from('clients').select('id, name').eq('is_active', true).order('name')
    : { data: [] }

  return (
    <DevicesManager
      initialDevices={devices ?? []}
      clients={clients ?? []}
      isSuperAdmin={isSuperAdmin}
      myClientId={adminUser?.client_id ?? null}
    />
  )
}
