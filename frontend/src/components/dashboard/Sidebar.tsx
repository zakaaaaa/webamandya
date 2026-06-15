'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LayoutDashboard, Receipt, Images, Frame, Ticket, Monitor, Users, LogOut, Settings, Camera } from 'lucide-react'

const adminNav = [
  { href: '/dashboard',    label: 'Overview',  icon: LayoutDashboard },
  { href: '/transactions', label: 'Transaksi', icon: Receipt },
  { href: '/gallery',      label: 'Gallery',   icon: Images },
  { href: '/frames',       label: 'Frame',     icon: Frame },
  { href: '/vouchers',     label: 'Voucher',   icon: Ticket    },
  { href: '/devices',      label: 'Perangkat', icon: Monitor   },
  { href: '/settings',     label: 'Pengaturan', icon: Settings },
]

const superAdminNav = [
  { href: '/dashboard',    label: 'Overview',  icon: LayoutDashboard },
  { href: '/clients',      label: 'Clients',   icon: Users },
  { href: '/devices',      label: 'Lisensi',   icon: Monitor },
  { href: '/transactions', label: 'Transaksi', icon: Receipt },
]

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const navItems = role === 'super_admin' ? superAdminNav : adminNav

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');

        .sidebar-link {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 12px; border-radius: 12px;
          font-size: 13.5px; font-weight: 500; text-decoration: none;
          transition: all 0.2s; color: #7A6259;
          border: 1px solid transparent;
          font-family: 'Poppins', sans-serif;
          position: relative;
        }
        .sidebar-link:hover { color: #D42B22; background: rgba(212,43,34,0.05); }
        .sidebar-link.active {
          color: #D42B22; font-weight: 600;
          background: linear-gradient(135deg,rgba(212,43,34,0.10),rgba(212,43,34,0.05));
          border-color: rgba(212,43,34,0.20);
        }
        .logout-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 11px 12px; border-radius: 12px;
          font-size: 13.5px; font-weight: 500;
          background: none; border: none; cursor: pointer;
          color: #9E8880; transition: all 0.2s;
          width: 100%; font-family: 'Poppins', sans-serif;
        }
        .logout-btn:hover { color: #C02018; background: rgba(212,43,34,0.06); }

        /* ── DESKTOP SIDEBAR ── */
        .sidebar-desktop {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 240px;
          display: flex;
          flex-direction: column;
          padding: 24px 16px;
          background: #FFFFFF;
          border-right: 1px solid rgba(212,43,34,0.08);
          box-shadow: 1px 0 20px rgba(212,43,34,0.04);
          font-family: 'Poppins', sans-serif;
          z-index: 100;
          overflow-y: auto;
        }

        /* ── BOTTOM NAVBAR: mobile ── */
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 64px;
          background: #FFFFFF;
          border-top: 1px solid rgba(212,43,34,0.10);
          box-shadow: 0 -2px 16px rgba(212,43,34,0.06);
          z-index: 100;
          align-items: center;
          justify-content: space-around;
          padding: 0 4px;
        }
        .bottom-nav-item {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; flex: 1; padding: 6px 2px;
          text-decoration: none; color: #9E8880;
          font-size: 10px; font-weight: 600;
          font-family: 'Poppins', sans-serif;
          border-radius: 10px; transition: all 0.15s;
          min-width: 0;
        }
        .bottom-nav-item.active { color: #D42B22; }
        .bottom-nav-item:hover { color: #D42B22; }
        .bottom-nav-icon {
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.15s;
        }
        .bottom-nav-item.active .bottom-nav-icon {
          background: rgba(212,43,34,0.12);
        }
        .bottom-nav-label {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 52px; text-align: center; line-height: 1;
        }
        .bottom-nav-logout {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; flex: 1; padding: 6px 2px;
          color: #B0A09A; font-size: 10px; font-weight: 600;
          font-family: 'Poppins', sans-serif;
          background: none; border: none; cursor: pointer;
          border-radius: 10px; transition: all 0.15s;
        }
        .bottom-nav-logout:hover { color: #C02018; }

        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .bottom-nav { display: flex; }
        }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="sidebar-desktop">
        {/* Logo / Brand */}
        <div style={{ padding: '4px 8px 22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '38px', height: '38px', borderRadius: '11px', flexShrink: 0,
              background: 'linear-gradient(135deg,#E83530,#D42B22,#C02018)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(212,43,34,0.30)',
            }}>
              <Camera size={20} color="white" />
            </div>
            <div style={{ lineHeight: 1.05 }}>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#150C09', letterSpacing: '-0.02em' }}>
                Pabrik
              </div>
              <div style={{ fontSize: '15px', fontWeight: 900, color: '#D42B22', letterSpacing: '-0.02em', marginTop: '-2px' }}>
                Kenangan
              </div>
            </div>
          </div>
          <div style={{
            marginTop: '14px',
            color: '#D42B22', fontSize: '9px', letterSpacing: '2px',
            textTransform: 'uppercase', fontWeight: 700, fontFamily: 'Poppins,sans-serif',
            textAlign: 'center',
            background: 'rgba(212,43,34,0.07)', border: '1px solid rgba(212,43,34,0.16)',
            borderRadius: '20px', padding: '4px 10px', width: 'fit-content',
            margin: '14px auto 0',
          }}>
            {role === 'super_admin' ? 'Super Admin' : 'Admin'}
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(212,43,34,0.10),transparent)', margin: '0 4px 16px' }} />

        <div style={{ color: '#B0A09A', fontSize: '10px', fontWeight: 700, letterSpacing: '2px', textTransform: 'uppercase', padding: '0 12px', marginBottom: '8px', fontFamily: 'Poppins,sans-serif' }}>
          Menu
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link key={href} href={href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                {isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '20px', borderRadius: '0 3px 3px 0', background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
                )}
                <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(212,43,34,0.10),transparent)', margin: '16px 4px' }} />

        <button onClick={handleLogout} className="logout-btn">
          <LogOut size={16} style={{ flexShrink: 0 }} />
          Keluar
        </button>
      </aside>

      {/* ── MOBILE BOTTOM NAVBAR ── */}
      <nav className="bottom-nav">
        {navItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href
          return (
            <Link key={href} href={href} className={`bottom-nav-item ${isActive ? 'active' : ''}`}>
              <div className="bottom-nav-icon">
                <Icon size={18} />
              </div>
              <span className="bottom-nav-label">{label}</span>
            </Link>
          )
        })}
        <button onClick={handleLogout} className="bottom-nav-logout">
          <div style={{ width: 24, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <LogOut size={18} />
          </div>
          <span>Keluar</span>
        </button>
      </nav>
    </>
  )
}
