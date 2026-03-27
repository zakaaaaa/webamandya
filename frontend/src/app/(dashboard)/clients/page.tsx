import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import ClientsManager from './ClientsManager'

export default async function ClientsPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role').eq('id', user.id).single()

  if (adminUser?.role !== 'super_admin') redirect('/dashboard')

  const { data: clients } = await supabase
    .from('clients')
    .select(`
      id, name, email, phone, is_active, created_at,
      devices(count),
      admin_users(count)
    `)
    .order('created_at', { ascending: false })

  return <ClientsManager initialClients={clients ?? []} />
}
