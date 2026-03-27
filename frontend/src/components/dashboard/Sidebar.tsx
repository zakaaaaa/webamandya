'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import { LayoutDashboard, Receipt, Images, Frame, Ticket, Monitor, Users, LogOut, Settings } from 'lucide-react'

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
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&display=swap');

        .sidebar-link {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          font-size: 13.5px; font-weight: 500; text-decoration: none;
          transition: all 0.2s; color: rgba(255,255,255,0.4);
          border: 1px solid transparent;
          font-family: 'Plus Jakarta Sans', sans-serif;
          position: relative;
        }
        .sidebar-link:hover { color: rgba(255,255,255,0.8); background: rgba(255,255,255,0.05); }
        .sidebar-link.active {
          color: white;
          background: linear-gradient(135deg,rgba(99,102,241,0.25),rgba(139,92,246,0.15));
          border-color: rgba(99,102,241,0.3);
        }
        .logout-btn {
          display: flex; align-items: center; gap: 10px;
          padding: 10px 12px; border-radius: 12px;
          font-size: 13.5px; font-weight: 500;
          background: none; border: none; cursor: pointer;
          color: rgba(255,255,255,0.35); transition: all 0.2s;
          width: 100%; font-family: 'Plus Jakarta Sans', sans-serif;
        }
        .logout-btn:hover { color: #fca5a5; background: rgba(239,68,68,0.08); }

        /* ── DESKTOP SIDEBAR: fixed, tidak ikut scroll ── */
        .sidebar-desktop {
          position: fixed;
          top: 0; left: 0; bottom: 0;
          width: 240px;
          display: flex;
          flex-direction: column;
          padding: 20px 16px;
          background: rgba(8,6,20,0.97);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-right: 1px solid rgba(255,255,255,0.06);
          font-family: 'Plus Jakarta Sans', sans-serif;
          z-index: 100;
          overflow-y: auto;
        }

        /* ── BOTTOM NAVBAR: mobile only ── */
        .bottom-nav {
          display: none;
          position: fixed;
          bottom: 0; left: 0; right: 0;
          height: 64px;
          background: rgba(8,6,20,0.97);
          backdrop-filter: blur(24px);
          -webkit-backdrop-filter: blur(24px);
          border-top: 1px solid rgba(255,255,255,0.08);
          z-index: 100;
          align-items: center;
          justify-content: space-around;
          padding: 0 4px;
        }
        .bottom-nav-item {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; flex: 1; padding: 6px 2px;
          text-decoration: none; color: rgba(255,255,255,0.35);
          font-size: 10px; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          border-radius: 10px; transition: all 0.15s;
          min-width: 0;
        }
        .bottom-nav-item.active { color: #a5b4fc; }
        .bottom-nav-item:hover { color: rgba(255,255,255,0.7); }
        .bottom-nav-icon {
          width: 24px; height: 24px;
          display: flex; align-items: center; justify-content: center;
          border-radius: 8px; transition: all 0.15s;
        }
        .bottom-nav-item.active .bottom-nav-icon {
          background: rgba(99,102,241,0.2);
        }
        .bottom-nav-label {
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          max-width: 52px; text-align: center; line-height: 1;
        }
        .bottom-nav-logout {
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          gap: 3px; flex: 1; padding: 6px 2px;
          color: rgba(255,255,255,0.25); font-size: 10px; font-weight: 600;
          font-family: 'Plus Jakarta Sans', sans-serif;
          background: none; border: none; cursor: pointer;
          border-radius: 10px; transition: all 0.15s;
        }
        .bottom-nav-logout:hover { color: #fca5a5; }

        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .bottom-nav { display: flex; }
        }
      `}</style>

      {/* ── DESKTOP SIDEBAR ── */}
      <aside className="sidebar-desktop">
        {/* Logo */}
        <div style={{ padding: '8px 12px 20px', marginBottom: '4px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
            <img
              src="https://dmfzqdalantgqgqftalv.supabase.co/storage/v1/object/public/element-web/1.png"
              alt="Logo"
              style={{ width: '100%', maxWidth: '170px', height: 'auto', objectFit: 'contain' }}
            />
            <div style={{
              color: 'rgba(255,255,255,0.25)', fontSize: '9px', letterSpacing: '2.5px',
              textTransform: 'uppercase', fontFamily: 'Poppins,sans-serif', textAlign: 'center',
              background: 'rgba(99,102,241,0.12)', border: '1px solid rgba(99,102,241,0.2)',
              borderRadius: '20px', padding: '2px 10px',
            }}>
              {role === 'super_admin' ? 'Super Admin' : 'Admin'}
            </div>
          </div>
        </div>

        <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin: '0 4px 16px' }} />

        <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: '10px', fontWeight: 600, letterSpacing: '2px', textTransform: 'uppercase', padding: '0 12px', marginBottom: '8px', fontFamily: 'Poppins,sans-serif' }}>
          Menu
        </div>

        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '3px' }}>
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href
            return (
              <Link key={href} href={href} className={`sidebar-link ${isActive ? 'active' : ''}`}>
                {isActive && (
                  <div style={{ position: 'absolute', left: 0, top: '50%', transform: 'translateY(-50%)', width: '3px', height: '20px', borderRadius: '0 3px 3px 0', background: 'linear-gradient(to bottom,#6366f1,#8b5cf6)' }} />
                )}
                <Icon size={16} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.6 }} />
                {label}
              </Link>
            )
          })}
        </nav>

        <div style={{ height: '1px', background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.07),transparent)', margin: '16px 4px' }} />

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