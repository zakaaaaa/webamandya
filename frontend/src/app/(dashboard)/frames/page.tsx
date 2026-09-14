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

  // Kategori yang nonaktif tetap dimuat di sini — dasbor perlu melihatnya
  // untuk bisa menyalakannya lagi; yang disaring is_active hanya API kios.
  const { data: categories } = await supabase
    .from('frame_categories')
    .select('*')
    .eq('client_id', adminUser?.client_id)
    .order('sort_order', { ascending: true })

  // Harga yang dipakai kategori tanpa harga sendiri. Unit yang punya
  // session_price di device_settings bisa berbeda; dasbor hanya menampilkan
  // harga level klien sebagai petunjuk. null kalau belum diatur/tak terbaca.
  const { data: setelan } = await supabase
    .from('client_settings')
    .select('session_price')
    .eq('client_id', adminUser?.client_id)
    .maybeSingle()

  return (
    <FramesManager
      initialFrames={frames ?? []}
      initialCategories={categories ?? []}
      clientId={adminUser?.client_id ?? ''}
      hargaDefault={setelan?.session_price ?? null}
    />
  )
}
