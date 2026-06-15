import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Users, Monitor, Receipt, TrendingUp, Shield, Activity } from 'lucide-react'
import { HwidRow } from './HwidRow'

const superAdminNav = [
  { href: '/clients',      label: 'Clients',   icon: Users    },
  { href: '/devices',      label: 'Lisensi',   icon: Monitor  },
  { href: '/transactions', label: 'Transaksi', icon: Receipt  },
]

// ── Gradient solid per stat (pabrikenangan palette) ──
const statColors = [
  { bg: 'linear-gradient(160deg,#E83530 0%,#D42B22 55%,#C02018 100%)', glow: 'rgba(180,30,20,0.28)' },
  { bg: 'linear-gradient(160deg,#1050A0 0%,#1D6FB5 55%,#1558A0 100%)', glow: 'rgba(20,80,165,0.25)' },
  { bg: 'linear-gradient(160deg,#0A7A5A 0%,#059669 55%,#047857 100%)', glow: 'rgba(5,120,85,0.25)'  },
  { bg: 'linear-gradient(160deg,#1050A0 0%,#1D6FB5 55%,#1558A0 100%)', glow: 'rgba(20,80,165,0.25)' },
  { bg: 'linear-gradient(160deg,#B45309 0%,#D97706 55%,#B45309 100%)', glow: 'rgba(180,85,0,0.25)'  },
  { bg: 'linear-gradient(160deg,#5B21B6 0%,#7C3AED 55%,#6D28D9 100%)', glow: 'rgba(100,40,210,0.25)'},
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
      { label: 'Total Client',     value: String(totalClients ?? 0),                     icon: Users      },
      { label: 'Total Lisensi',    value: String(totalDevices ?? 0),                     icon: Monitor    },
      { label: 'Lisensi Aktif',    value: String(activeDevices ?? 0),                    icon: Shield     },
      { label: 'Sesi Hari Ini',    value: String(todaySessions ?? 0),                    icon: Activity   },
      { label: 'Revenue Hari Ini', value: `Rp ${todayRevenue.toLocaleString('id-ID')}`,  icon: TrendingUp },
      { label: 'Total Admin',      value: String(totalAdmins ?? 0),                      icon: Receipt    },
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
      { label: 'Sesi Hari Ini',       value: String(todaySessions ?? 0),                   icon: Activity   },
      { label: 'Pendapatan Hari Ini', value: `Rp ${todayRevenue.toLocaleString('id-ID')}`, icon: TrendingUp },
      { label: 'Voucher Aktif',       value: String(activeVouchers ?? 0),                  icon: Receipt    },
      { label: 'Perangkat Aktif',     value: String(activeDevices ?? 0),                   icon: Monitor    },
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
          lastSeen: d.created_at,
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
          const existing = regMap.get(d.hwid)
          existing.lastSeen = d.last_seen_at
        }
      })
    }

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

  const statusCfg: Record<string, { bg: string; color: string; border: string }> = {
    paid:    { bg: 'rgba(5,150,105,0.10)', color: '#059669', border: 'rgba(5,150,105,0.22)' },
    pending: { bg: 'rgba(217,119,6,0.10)', color: '#D97706', border: 'rgba(217,119,6,0.22)' },
    free:    { bg: 'rgba(212,43,34,0.08)', color: '#D42B22', border: 'rgba(212,43,34,0.18)' },
    expired: { bg: 'rgba(122,98,89,0.10)', color: '#7A6259', border: 'rgba(122,98,89,0.20)' },
    failed:  { bg: 'rgba(180,30,20,0.10)', color: '#B82018', border: 'rgba(180,30,20,0.20)' },
  }

  return (
    <>
      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .stat-card { animation: fade-up 0.5s ease both; transition: transform 0.25s cubic-bezier(0.34,1.56,0.64,1); }
        .stat-card:hover { transform: translateY(-5px); }
        .stat-card:nth-child(1){animation-delay:0.05s}
        .stat-card:nth-child(2){animation-delay:0.10s}
        .stat-card:nth-child(3){animation-delay:0.15s}
        .stat-card:nth-child(4){animation-delay:0.20s}
        .stat-card:nth-child(5){animation-delay:0.25s}
        .stat-card:nth-child(6){animation-delay:0.30s}
        .table-section { animation: fade-up 0.5s ease 0.35s both; }
        .page-header   { animation: fade-up 0.5s ease 0.0s  both; }

        .stats-grid { display: grid; gap: 16px; margin-bottom: 28px; }
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
          .stat-value { font-size: 22px !important; }
        }

        .quick-link {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 14px; border-radius: 12px;
          background: linear-gradient(160deg, rgba(212,43,34,0.05), rgba(212,43,34,0.02));
          border: 1px solid rgba(212,43,34,0.12);
          color: #7A6259; font-size: 13px; font-weight: 600;
          text-decoration: none; transition: all 0.2s;
          font-family: 'Poppins', sans-serif;
        }
        .quick-link:hover {
          background: linear-gradient(160deg, rgba(212,43,34,0.10), rgba(212,43,34,0.05));
          border-color: rgba(212,43,34,0.22);
          color: #D42B22; transform: translateX(3px);
        }

        .super-admin-info { display: grid; grid-template-columns: repeat(2, 1fr); gap: 16px; margin-top: 28px; }
        @media (max-width: 768px) { .super-admin-info { grid-template-columns: 1fr; } }
        .hwid-full-width { grid-column: 1 / -1; }
      `}</style>

      <div style={{ fontFamily: "'Poppins',sans-serif", minHeight: '100vh' }}>

        {/* ── HEADER ── */}
        <div className="page-header" style={{ marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '6px' }}>
            <div style={{ width: '3px', height: '20px', borderRadius: '2px', background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
            <p style={{ color: '#D42B22', fontSize: '11px', fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase', fontFamily: 'Poppins,sans-serif' }}>
              {isSuperAdmin ? 'Super Admin' : 'Admin'} Dashboard
            </p>
          </div>
          <h1 style={{ color: '#150C09', fontSize: '30px', fontWeight: 900, fontFamily: 'Poppins,sans-serif', marginBottom: '6px', letterSpacing: '-0.02em' }}>
            Overview
          </h1>
          <p style={{ color: '#9E8880', fontSize: '14px' }}>
            Selamat datang, <span style={{ color: '#4A2E22', fontWeight: 700 }}>{adminUser?.full_name}</span>
          </p>
        </div>

        {/* ── STATS GRID ── */}
        <div className={`stats-grid ${isSuperAdmin ? 'super' : 'admin'}`}>
          {stats.map(({ label, value, icon: Icon }, i) => {
            const c = statColors[i % statColors.length]
            return (
              <div key={label} className="stat-card stat-card-shine" style={{
                padding: '22px', borderRadius: '22px', position: 'relative', overflow: 'hidden',
                background: c.bg,
                boxShadow: `inset 0 2px 3px rgba(255,255,255,0.18), 0 8px 24px ${c.glow}, 0 16px 40px rgba(0,0,0,0.04)`,
              }}>
                <div style={{ position: 'absolute', top: 0, left: 22, right: 22, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '16px' }}>
                  <p style={{ color: 'rgba(255,255,255,0.7)', fontSize: '11px', fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase', fontFamily: 'Poppins,sans-serif' }}>
                    {label}
                  </p>
                  <div style={{
                    width: '36px', height: '36px', borderRadius: '11px', flexShrink: 0,
                    background: 'rgba(255,255,255,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25)',
                  }}>
                    <Icon size={16} color="white" />
                  </div>
                </div>
                <p className="stat-value" style={{ color: 'white', fontSize: '28px', fontWeight: 900, fontFamily: 'Poppins,sans-serif', lineHeight: 1, letterSpacing: '-0.03em' }}>
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
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
                <h3 style={{ color: '#150C09', fontSize: 15, fontWeight: 800, fontFamily: 'Poppins,sans-serif' }}>Quick Access</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {superAdminNav.map(item => (
                  <a key={item.href} href={item.href} className="quick-link">
                    <div style={{ width: 30, height: 30, borderRadius: 9, flexShrink: 0, background: 'rgba(212,43,34,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D42B22' }}>
                      <item.icon size={14} />
                    </div>
                    {item.label}
                    <span style={{ marginLeft: 'auto', color: '#C0AFA9', fontSize: 16 }}>→</span>
                  </a>
                ))}
              </div>
            </div>

            {/* System status */}
            <div className="glass-card" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 18 }}>
                <div style={{ width: 3, height: 18, borderRadius: 2, background: 'linear-gradient(to bottom,#059669,#047857)' }} />
                <h3 style={{ color: '#150C09', fontSize: 15, fontWeight: 800, fontFamily: 'Poppins,sans-serif' }}>Status Sistem</h3>
              </div>
              {[
                { label: 'API Backend',  ok: true },
                { label: 'Database',     ok: true },
                { label: 'Storage',      ok: true },
                { label: 'Auth Service', ok: true },
              ].map((s, idx) => (
                <div key={s.label} style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  padding: '11px 0',
                  borderBottom: idx < 3 ? '1px solid rgba(212,43,34,0.07)' : 'none',
                }}>
                  <span style={{ color: '#7A6259', fontSize: 13, fontFamily: "'Poppins',sans-serif" }}>{s.label}</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: s.ok ? '#059669' : '#D42B22', boxShadow: `0 0 0 2px ${s.ok ? 'rgba(5,150,105,0.15)' : 'rgba(212,43,34,0.15)'}` }} />
                    <span style={{ color: s.ok ? '#059669' : '#D42B22', fontSize: 10, fontWeight: 800, letterSpacing: 1 }}>
                      {s.ok ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            {/* ── HWID DEBUG PANEL ── */}
            <div className="glass-card hwid-full-width" style={{ padding: '24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 3, height: 18, borderRadius: 2, background: 'linear-gradient(to bottom,#7C3AED,#6D28D9)' }} />
                  <h3 style={{ color: '#150C09', fontSize: 15, fontWeight: 800, fontFamily: 'Poppins,sans-serif' }}>
                    HWID Debug — Terdaftar & Belum Terdaftar
                  </h3>
                </div>
                <span style={{
                  background: 'rgba(124,58,237,0.09)',
                  border: '1px solid rgba(124,58,237,0.18)',
                  borderRadius: 100, padding: '3px 12px',
                  color: '#7C3AED', fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                }}>
                  {allDevicesList.length} HWID
                </span>
              </div>

              {allDevicesList.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#C0AFA9', fontSize: 13 }}>
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
              borderBottom: '1px solid rgba(212,43,34,0.08)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div>
                <h2 style={{ color: '#150C09', fontSize: '16px', fontWeight: 800, fontFamily: 'Poppins,sans-serif', marginBottom: '2px' }}>
                  Transaksi Terbaru
                </h2>
                <p style={{ color: '#9E8880', fontSize: '12px' }}>
                  {sessions.length} transaksi terakhir
                </p>
              </div>
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                background: 'rgba(5,150,105,0.08)', border: '1px solid rgba(5,150,105,0.18)',
                borderRadius: '100px', padding: '5px 14px',
                color: '#059669', fontSize: '12px', fontWeight: 700,
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#059669' }} />
                Live
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(212,43,34,0.07)' }}>
                    {['Kode Transaksi', 'Perangkat', 'Metode', 'Status', 'Jumlah', 'Waktu'].map(h => (
                      <th key={h} style={{
                        padding: '12px 20px', textAlign: 'left',
                        color: '#C0AFA9', fontSize: '10px',
                        fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
                        fontFamily: 'Poppins,sans-serif', whiteSpace: 'nowrap',
                        background: 'rgba(212,43,34,0.02)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((s: any) => {
                    const cfg = statusCfg[s.payment_status] || statusCfg.failed
                    return (
                      <tr key={s.transaction_code} className="table-row"
                        style={{ borderBottom: '1px solid rgba(212,43,34,0.05)', transition: 'background 0.15s' }}>
                        <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                          <span style={{ color: '#7A6259', fontSize: '12px', fontWeight: 600, fontFamily: 'monospace', background: 'rgba(212,43,34,0.05)', border: '1px solid rgba(212,43,34,0.10)', borderRadius: 8, padding: '3px 10px' }}>
                            {s.transaction_code.slice(0, 20)}…
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#4A2E22', fontSize: '13px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {s.devices?.device_name ?? '—'}
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            background: 'rgba(212,43,34,0.07)', color: '#7A6259',
                            border: '1px solid rgba(212,43,34,0.14)', borderRadius: '8px',
                            padding: '4px 12px', fontSize: '12px', fontWeight: 700, textTransform: 'capitalize',
                          }}>
                            {s.payment_method}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px' }}>
                          <span style={{
                            background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                            borderRadius: '100px', padding: '4px 12px',
                            fontSize: '11px', fontWeight: 800, whiteSpace: 'nowrap', textTransform: 'capitalize',
                          }}>
                            {s.payment_status}
                          </span>
                        </td>
                        <td style={{ padding: '14px 20px', color: '#150C09', fontSize: '14px', fontWeight: 800, whiteSpace: 'nowrap' }}>
                          Rp {Number(s.amount).toLocaleString('id-ID')}
                        </td>
                        <td style={{ padding: '14px 20px', color: '#9E8880', fontSize: '12px', whiteSpace: 'nowrap' }}>
                          {new Date(s.created_at).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })}
                        </td>
                      </tr>
                    )
                  })}
                  {!sessions.length && (
                    <tr>
                      <td colSpan={6} style={{ padding: '48px 20px', textAlign: 'center', color: '#C0AFA9', fontSize: '14px' }}>
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
