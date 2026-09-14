import { cache } from 'react'
import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'

export type AdminUser = { role: string; client_id: string | null; full_name: string | null }

/*
 * Identitas admin untuk satu request dasbor — dipanggil layout DAN page.
 *
 * Dulu keduanya masing-masing memanggil auth.getUser() (perjalanan jaringan ke
 * Supabase Auth) lalu query admin_users, sehingga satu buka halaman = 2x auth
 * + 2x query, di atas getUser() yang sudah dijalankan proxy.ts. Sekarang:
 * - `cache` React membagi hasilnya antara layout dan page dalam request sama;
 * - getClaims() memverifikasi tanda tangan JWT secara lokal. Project memakai
 *   signing key ES256 (JWKS diambil sekali lalu disimpan di memori); token HS256
 *   lama otomatis jatuh ke getUser(). Proxy tetap memanggil getUser() yang
 *   menyegarkan sesi, dan admin_users tetap dibaca lewat RLS dengan token user.
 */
export const ambilSesiAdmin = cache(async () => {
  const supabase = await createServerSupabaseClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role, client_id, full_name').eq('id', userId).single()
  if (!adminUser) redirect('/login')

  return { supabase, userId, adminUser: adminUser as AdminUser }
})
