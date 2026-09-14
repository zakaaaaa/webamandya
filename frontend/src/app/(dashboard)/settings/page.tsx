import { ambilSesiAdmin } from '@/lib/admin-session'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { supabase, adminUser } = await ambilSesiAdmin()

  // Super admin tidak perlu halaman ini
  if (adminUser.role === 'super_admin') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('id, name, session_duration_minutes')
    .eq('id', adminUser.client_id)
    .single()

  return <SettingsClient client={client} />
}
