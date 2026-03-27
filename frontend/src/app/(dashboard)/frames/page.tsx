import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import FramesManager from './FramesManager'

export default async function FramesPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role, client_id').eq('id', user.id).single()

  if (adminUser?.role === 'super_admin') redirect('/dashboard')

  const { data: frames } = await supabase
    .from('frames')
    .select('*')
    .eq('client_id', adminUser?.client_id)
    .eq('type', 'static')
    .order('sort_order', { ascending: true })

  return (
    <FramesManager
      initialFrames={frames ?? []}
      clientId={adminUser?.client_id ?? ''}
    />
  )
}
