import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Users, Monitor, Receipt, TrendingUp, Shield, Activity } from 'lucide-react'
import { HwidRow } from './HwidRow'

const superAdminNav = [
  { href: '/clients',      label: 'Clients',   icon: Users    },
  { href: '/devices',      label: 'Lisensi',   icon: Monitor  },
  { href: '/transactions', label: 'Transaksi', icon: Receipt  },
]

export default async function DashboardPage() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role,client_id,full_name').eq('id', user.id).single()

  const isSuperAdmin = adminUser?.role === 'super_admin'
  const today = new Date(); today.setHours(0, 0, 0, 0)

  // ── SUPER ADMIN STATS ──
  let stats: any[] = []

  if (isSuperAdmin) {
    const [
      { count: totalClients },
      { count: totalDevices },
      { count: activeDevices },
      { count: todaySessions },
      { data: revenueData },
      { count: totalAdmins },
    ] = await Promise.all([
      supabase.from('clients').select('*', { count: 'exact', head: true }),
      supabase.from('devices').select('*', { count: 'exact', head: true }),
      supabase.from('devices').select('*', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('sessions').select('*', { count: 'exact', head: true }).gte('created_at', today.toISOString()),
      supabase.from('sessions').select('amount').eq('payment_status', 'paid').gte('created_at', today.toISOString()),
      supabase.from('admin_users').select('*', { count: 'exact', head: true }).eq('role', 'admin'),
    ])

    const todayRevenue = revenueData?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0

    stats = [
      { label: 'Total Client',     value: String(totalClients ?? 0),                     icon: Users,      gradient: 'from-violet-500 to-purple-600',  glow: 'rgba(139,92,246,0.25)' },
      { label: 'Total Lisensi',    value: String(totalDevices ?? 0),                     icon: Monitor,    gradient: 'from-indigo-500 to-blue-600',    glow: 'rgba(99,102,241,0.25)' },
      { label: 'Lisensi Aktif',    value: String(activeDevices ?? 0),                    icon: Shield,     gradient: 'from-emerald-500 to-teal-600',   glow: 'rgba(16,185,129,0.25)' },
      { label: 'Sesi Hari Ini',    value: String(todaySessions ?? 0),                    icon: Activity,   gradient: 'from-sky-500 to-cyan-600',       glow: 'rgba(14,165,233,0.25)' },
      { label: 'Revenue Hari Ini', value: `Rp ${todayRevenue.toLocaleString('id-ID')}`,  icon: TrendingUp, gradient: 'from-amber-500 to-orange-600',   glow: 'rgba(245,158,11,0.25)' },
      { label: 'Total Admin',      value: String(totalAdmins ?? 0),                      icon: Receipt,    gradient: 'from-pink-500 to-rose-600',      glow: 'rgba(236,72,153,0.25)' },
    ]
  } else {
    // ── ADMIN STATS ──
    const cid = adminUser?.client_id
    const [
      { count: todaySessions },
      { data: revenueData },
      { count: activeVouchers },
      { count: activeDevices },
    ] = await Promise.all([
      supabase.from('sessions').select('*', { count: 'exact', head: true }).eq('client_id', cid).gte('created_at', today.toISOString()),
      supabase.from('sessions').select('amount').eq('client_id', cid).eq('payment_status', 'paid').gte('created_at', today.toISOString()),
      supabase.from('vouchers').select('*', { count: 'exact', head: true }).eq('client_id', cid).eq('is_active', true),
      supabase.from('devices').select('*', { count: 'exact', head: true }).eq('client_id', cid).eq('is_active', true),
    ])
    const todayRevenue = revenueData?.reduce((s, r) => s + (Number(r.amount) || 0), 0) ?? 0
    stats = [
      { label: 'Sesi Hari Ini',       value: String(todaySessions ?? 0),                   icon: Activity,   gradient: 'from-indigo-500 to-violet-600',  glow: 'rgba(99,102,241,0.25)'  },
      { label: 'Pendapatan Hari Ini',  value: `Rp ${todayRevenue.toLocaleString('id-ID')}`, icon: TrendingUp, gradient: 'from-emerald-500 to-teal-600',   glow: 'rgba(16,185,129,0.25)'  },
      { label: 'Voucher Aktif',        value: String(activeVouchers ?? 0),                  icon: Receipt,    gradient: 'from-amber-500 to-orange-600',   glow: 'rgba(245,158,11,0.25)'  },
      { label: 'Perangkat Aktif',      value: String(activeDevices ?? 0),                   icon: Monitor,    gradient: 'from-sky-500 to-blue-600',       glow: 'rgba(14,165,233,0.25)'  },
    ]
  }

  // ── HWID DEBUG: Semua Perangkat (super admin only) ──
  let allDevicesList: any[] = []
  if (isSuperAdmin) {
    const [
      { data: unreg },
      { data: reg }
    ] = await Promise.all([
      supabase.from('unregistered_devices').select('hwid, last_seen_at, created_at').order('last_seen_at', { ascending: false }).limit(20),
      supabase.from('devices').select('hwid, device_name, is_active, created_at, license_end').order('created_at', { ascending: false })
    ])

    const regMap = new Map()
    if (reg) {
      reg.forEach(d => {
        regMap.set(d.hwid, {
          hwid: d.hwid,
          firstSeen: d.created_at,
          lastSeen: d.created_at, // Basic lastseen approximation for registered devices without activity yet
          deviceName: d.device_name || 'Tanpa Nama',
          status: d.is_active ? 'Aktif' : 'Tidak Aktif'
        })
      })
    }

    if (unreg) {
      unreg.forEach(d => {
        if (!regMap.has(d.hwid)) {
          regMap.set(d.hwid, {
            hwid: d.hwid,
            firstSeen: d.created_at,
            lastSeen: d.last_seen_at,
            deviceName: 'Unknown',
            status: 'Belum Terdaftar'
          })
        } else {
          // If already registered, update lastSeen with the latest ping activity
          const existing = regMap.get(d.hwid)
          existing.lastSeen = d.last_seen_at
        }
      })
    }
    
    // Sort all devices by lastSeen timestamp descending
    allDevicesList = Array.from(regMap.values()).sort((a,b) => new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime())
  }

  // Recent sessions — hanya untuk ADMIN biasa
  let sessions: any[] = []
  if (!isSuperAdmin) {
    const { data } = await supabase
      .from('sessions')
      .select('transaction_code,payment_method,payment_status,amount,created_at,devices(device_name)')
      .eq('client_id', adminUser?.client_id)
      .order('created_at', { ascending: false })
      .limit(8)
    sessions = data ?? []
  }

  const statusStyle: Record<string, string> = {
    paid:    'background:rgba(16,185,129,0.12);color:#34d399;border:1px solid rgba(16,185,129,0.2)',
    pending: 'background:rgba(245,158,11,0.12);color:#fbbf24;border:1px solid rgba(245,158,11,0.2)',
    free:    'background:rgba(99,102,241,0.12);color:#a5b4fc;border:1px solid rgba(99,102,241,0.2)',
    expired: 'background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.2)',
    failed:  'background:rgba(239,68,68,0.12);color:#f87171;border:1px solid rgba(239,68,68,0.2)',
  }

  const colorMap: Record<string, string> = {
    'violet-500': '#8b5cf6', 'purple-600':  '#9333ea',
    'indigo-500': '#6366f1', 'blue-600':    '#2563eb',
    'emerald-500':'#10b981', 'teal-600':    '#0d9488',
    'sky-500':    '#0ea5e9', 'cyan-600':    '#0891b2',
    'amber-500':  '#f59e0b', 'orange-600':  '#ea580c',
    'pink-500':   '#ec4899', 'rose-600':    '#e11d48',
  }

  return (
    <>
      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .stat-card { animation: fade-up 0.5s ease both; }
        .stat-card:nth-child(1){animation-delay:0.05s}
        .stat-card:nth-child(2){animation-delay:0.10s}
        .stat-card:nth-child(3){animation-delay:0.15s}
        .stat-card:nth-child(4){animation-delay:0.20s}
        .stat-card:nth-child(5){animation-delay:0.25s}
        .stat-card:nth-child(6){animation-delay:0.30s}
        .table-section { animation: fade-up 0.5s ease 0.35s both; }
        .page-header   { animation: fade-up 0.5s ease 0.0s  both; }

        .stats-grid {
          display: grid;
          gap: 16px;
          margin-bottom: 28px;
        }
        .stats-grid.super { grid-template-columns: repeat(3, 1fr); }
        .stats-grid.admin { grid-template-columns: repeat(4, 1fr); }

        @media (max-width: 1024px) {
          .stats-grid.super { grid-template-columns: repeat(3, 1fr); }
          .stats-grid.admin { grid-template-columns: repeat(2, 1fr); }
        }
        @media (max-width: 768px) {
          .stats-grid.super { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .stats-grid.admin { grid-template-columns: repeat(2, 1fr); gap: 12px; }
          .page-header h1   { font-size: 22px !important; }
          .page-header       { padding-top: 52px; }
        }
        @media (max-width: 480px) {
          .stats-grid.super { grid-template-columns: 1fr; }
          .stats-grid.admin { grid-template-columns: 1fr; }
        }

        @media (max-width: 480px) {
          .stat-value { font-size: 22px !important; }
        }

        .quick-link {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 14px; border-radius: 10px;
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,255,255,0.06);
          color: rgba(255,255,255,0.5); font-size: 13px;
          text-decoration: none; transition: all 0.2s;
          font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .quick-link:hover {
          background: rgba(99,102,241,0.12);
          border-color: rgba(99,102,241,0.25);
          color: white;
        }

        .super-admin-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 16px;
          margin-top: 28px;
        }
        @media (max-width: 768px) {
          .super-admin-info { grid-template-columns: 1fr; }
        }

        .hwid-full-width {
          grid-column: 1 / -1;
        }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", minHeight: '100vh' }}>

        {/* ── HEADER ── */}
        <div className="page-header" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '3px', height: '20px', borderRadius: '2px', background: 'linear-gradient(to bottom,#6366f1,#8b5cf6)' }} />
            <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '11px', fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase', fontFamily: 'Poppins,sans-serif' }}>
              {isSuperAdmin ? 'Super Admin' : 'Admin'} Dashboard
            </p>
          </div>
          <h1 style={{ color: 'white', fontSize: '28px', fontWeight: 700, fontFamily: 'Poppins,sans-serif', marginBottom: '6px' }}>
            Overview
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>
            Selamat datang, <span style={{ color: 'rgba(255,255,255,0.6)', fontWeight: 500 }}>{adminUser?.full_name}</span>
          </p>
        </div>

        {/* ── STATS GRID ── */}
        <div className={`stats-grid ${isSuperAdmin ? 'super' : 'admin'}`}>
          {stats.map(({ label, value, icon: Icon, gradient, glow }) => {
            const [from, to] = gradient.replace('from-', '').replace(' to-', ',').split(',')
            const c1 = colorMap[from.trim()] || '#6366f1'
            const c2 = colorMap[to.trim()]   || '#8b5cf6'
            return (
              <div key={label} className="stat-card glass-card" style={{
                padding: '22px',
                boxShadow: `0 0 30px ${glow}, 0 8px 32px rgba(0,0,0,0.3)`,
              }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'Poppins,sans-serif' }}>
                    {label}
                  </p>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '10px', flexShrink: 0,
                    background: `linear-gradient(135deg,${c1},${c2})`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: `0 4px 12px ${glow}`,
                  }}>
                    <Icon size={16} color="white" />
                  </div>
                </div>
                <p className="stat-value" style={{ color: 'white', fontSize: '26px', fontWeight: 700, fontFamily: 'Poppins,sans-serif', lineHeight: 1 }}>
                  {value}
                </p>
              </div>
            )
          })}
        </div>

        {/* ── SUPER ADMIN: cards + HWID debug ── */}
        {isSuperAdmin && (
          <div className="super-admin-info">

            {/* Quick access card */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(to bottom,#6366f1,#8b5cf6)' }} />
                <h3 style={{ color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'Poppins,sans-serif' }}>Quick Access</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {superAdminNav.map(item => (
                  <a key={item.href} href={item.href} className="quick-link">
                    <item.icon size={15} />
                    {item.label}
                    <span style={{ marginLeft: 'auto', opacity: 0.3, fontSize: 16 }}>→</span>
                  </a>
                ))}
              </div>
            </div>

            {/* System status */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(to bottom,#10b981,#0d9488)' }} />
                <h3 style={{ color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'Poppins,sans-serif' }}>Status Sistem</h3>
              </div>
              {[
                { label: 'API Backend',  ok: true },
                { label: 'Database',     ok: true },
                { label: 'Storage',      ok: true },
                { label: 'Auth Service', ok: true },
              ].map(s => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '10px 0',
                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                }}>
                  <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 13, fontFamily: "'Plus Jakarta Sans',sans-serif" }}>{s.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.ok ? '#10b981' : '#ef4444', boxShadow: `0 0 6px ${s.ok ? '#10b981' : '#ef4444'}` }} />
                    <span style={{ color: s.ok ? '#34d399' : '#f87171', fontSize: 11, fontWeight: 600, letterSpacing: 1 }}>
                      {s.ok ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── HWID DEBUG PANEL ── */}
            <div className="glass-card hwid-full-width" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 16, borderRadius: 2, background: 'linear-gradient(to bottom,#10b981,#3b82f6)' }} />
                  <h3 style={{ color: 'white', fontSize: 14, fontWeight: 600, fontFamily: 'Poppins,sans-serif' }}>
                    Daftar Perangkat — HWID Terdaftar & Belum Terdaftar
                  </h3>
                </div>
                <span style={{
                  background: 'rgba(59,130,246,0.12)',
                  border: '1px solid rgba(59,130,246,0.2)',
                  borderRadius: 6, padding: '3px 10px',
                  color: '#60a5fa', fontSize: 11, fontWeight: 600, letterSpacing: 1,
                }}>
                  {allDevicesList.length} HWID
                </span>
              </div>

              {allDevicesList.length === 0 ? (
                <div style={{
                  textAlign: 'center', padding: '32px 0',
                  color: 'rgba(255,255,255,0.2)', fontSize: 13,
                }}>
                  Belum ada perangkat yang mencoba koneksi
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allDevicesList.map((d) => (
                    <HwidRow
                      key={d.hwid}
                      hwid={d.hwid}
                      lastSeen={d.lastSeen}
                      firstSeen={d.firstSeen}
                      status={d.status}
                      deviceName={d.deviceName}
                    />
                  ))}
                </div>
              )}
            </div>

          </div>
        )}

        {/* ── ADMIN: tabel transaksi terbaru ── */}
        {!isSuperAdmin && (
          <div className="glass-card table-section" style={{ overflow: 'hidden' }}>
            <div style={{
              padding: '20px 24px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h2 style={{ color: 'white', fontSize: '16px', fontWeight: 600, fontFamily: 'Poppins,sans-serif', marginBottom: '2px' }}>
                  Transaksi Terbaru
                </h2>
                <p style={{ color: 'rgba(255,255,255,0.25)', fontSize: '12px' }}>
                  {sessions.length} transaksi terakhir
                </p>
              </div>
              <div style={{
                background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
                borderRadius: '8px', padding: '6px 12px',
                color: '#a5b4fc', fontSize: '12px', fontWeight: 500,
              }}>
                Live
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    {['Kode Transaksi', 'Perangkat', 'Metode', 'Status', 'Jumlah', 'Waktu'].map(h => (
                      <th key={h} style={{
                        padding: '12px 20px', textAlign: 'left',
                        color: 'rgba(255,255,255,0.25)', fontSize: '11px',
                        fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase',
                        fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any) => (
                    <tr key={s.transaction_code} className="table-row"
                      style={{ borderBottom: '1px solid rgba(255,255,255,0.03)', transition: 'background 0.15s' }}>
                      <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.5)', fontSize: '13px', fontFamily: 'monospace', whiteSpace: 'nowrap' }}>
                        {s.transaction_code.slice(0, 24)}…
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.45)', fontSize: '13px', whiteSpace: 'nowrap' }}>
                        {s.devices?.device_name ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.5)',
                          border: '1px solid rgba(255,255,255,0.08)', borderRadius: '6px',
                          padding: '3px 10px', fontSize: '12px', fontWeight: 500, textTransform: 'capitalize',
                        }}>
                          {s.payment_method}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          borderRadius: '6px', padding: '3px 10px',
                          fontSize: '12px', fontWeight: 600, whiteSpace: 'nowrap',
                          ...(Object.fromEntries(
                            (statusStyle[s.payment_status] || statusStyle.failed)
                              .split(';').filter(Boolean)
                              .map((s: string) => {
                                const [k, ...v] = s.trim().split(':')
                                const key = k.trim().replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase())
                                return [key, v.join(':').trim()]
                              })
                          )),
                        }}>
                          {s.payment_status}
                        </span>
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.6)', fontSize: '13px', fontWeight: 500, whiteSpace: 'nowrap' }}>
                        Rp {Number(s.amount).toLocaleString('id-ID')}
                      </td>
                      <td style={{ padding: '14px 20px', color: 'rgba(255,255,255,0.25)', fontSize: '12px', whiteSpace: 'nowrap' }}>
                        {new Date(s.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                      </td>
                    </tr>
                  ))}
                  {!sessions.length && (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: 'rgba(255,255,255,0.2)', fontSize: '14px' }}>
                        Belum ada transaksi
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </>
  )
}