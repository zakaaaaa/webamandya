import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div className="p-8 min-h-screen">
      <p className="text-white/30 text-xs font-medium tracking-widest uppercase mb-1">Menu</p>
      <h1 className="text-white text-3xl font-bold capitalize mb-4">transactions</h1>
      <div className="glass rounded-2xl p-12 text-center">
        <p className="text-white/30 text-sm">Halaman ini sedang dalam pengembangan</p>
      </div>
    </div>
  )
}
