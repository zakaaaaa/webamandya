import { ambilSesiAdmin } from '@/lib/admin-session'
import DevicesManager from './DevicesManager'
import ConsumablesPanel from './ConsumablesPanel'
import QueuePanel from './QueuePanel'

const kosong = { data: [] as never[] }

export default async function DevicesPage() {
  const { supabase, adminUser } = await ambilSesiAdmin()

  const isSuperAdmin = adminUser?.role === 'super_admin'

  // Ambil devices
  let devicesQuery = supabase
    .from('devices')
    .select('*, clients(id, name)')
    .order('created_at', { ascending: false })

  if (!isSuperAdmin) {
    devicesQuery = devicesQuery.eq('client_id', adminUser?.client_id)
  }

  // Dropdown clients tidak bergantung pada daftar devices, jadi dimulai
  // bersamaan dengannya (super admin only).
  const clientsPromise = isSuperAdmin
    ? Promise.resolve(supabase.from('clients').select('id, name').eq('is_active', true).order('name'))
    : Promise.resolve(kosong)

  const { data: devices } = await devicesQuery
  const deviceIds = (devices ?? []).map(d => d.id)

  // Konsumabel dan antrean sama-sama hanya butuh deviceIds — dulu ditunggu
  // satu per satu. Baris keduanya bisa belum ada untuk perangkat baru (dibuat
  // backend saat laporan pertama / oleh migrasi), jadi yang kosong wajar.
  const [{ data: consumables }, { data: queueStates }, { data: clients }] = await Promise.all([
    deviceIds.length ? supabase.from('device_consumables').select('*').in('device_id', deviceIds) : kosong,
    deviceIds.length ? supabase.from('device_queue_state').select('*').in('device_id', deviceIds) : kosong,
    clientsPromise,
  ])

  return (
    <>
      <QueuePanel
        devices={(devices ?? []).map(d => ({
          id: d.id,
          device_name: d.device_name,
          clients: d.clients,
        }))}
        initial={queueStates ?? []}
      />
      <ConsumablesPanel
        devices={(devices ?? []).map(d => ({
          id: d.id,
          device_name: d.device_name,
          clients: d.clients,
        }))}
        initial={consumables ?? []}
      />
      <DevicesManager
        initialDevices={devices ?? []}
        clients={clients ?? []}
        isSuperAdmin={isSuperAdmin}
        myClientId={adminUser?.client_id ?? null}
      />
    </>
  )
}
