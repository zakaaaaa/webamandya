import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role, client_id, full_name').eq('id', user.id).single()
  if (!adminUser) redirect('/login')

  // Super admin tidak perlu halaman ini
  if (adminUser.role === 'super_admin') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, session_duration_minutes')
    .eq('id', adminUser.client_id)
    .single()

  return <SettingsClient client={client} />
}
