import { ambilSesiAdmin } from '@/lib/admin-session'
import { redirect } from 'next/navigation'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const { supabase, adminUser } = await ambilSesiAdmin()

  // Super admin tidak perlu halaman ini
  if (adminUser.role === 'super_admin') redirect('/dashboard')

  const { data: client } = await supabase
    .from('clients')
    .select('id, name')
    .eq('id', adminUser.client_id)
    .single()

  // Durasi dibaca dari client_settings — tabel yang sama yang dipakai backend
  // (utils/settings.js) untuk kios dan estimasi antrean. Dulu halaman ini
  // membaca/menulis clients.session_duration_minutes yang tidak pernah dibaca
  // server, sehingga durasi yang disetel di sini tidak pernah sampai ke kios.
  const { data: setelan } = await supabase
    .from('client_settings')
    .select('session_duration_minutes')
    .eq('client_id', adminUser.client_id)
    .maybeSingle()

  return (
    <SettingsClient
      client={client}
      durasiAwal={setelan?.session_duration_minutes ?? null}
    />
  )
}
