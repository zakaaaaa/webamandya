'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import { LayoutDashboard, Receipt, Images, Frame, Ticket, Monitor, Users, LogOut, Settings, Menu, X } from 'lucide-react'

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

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <img
      src="/logo-pk.webp"
      alt="Pabrik Kenangan"
      width={compact ? 132 : 168}
      height={compact ? 74 : 95}
      style={{ height: 'auto', display: 'block' }}
    />
  )
}

export default function Sidebar({ role }: { role: string }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = createClient()
  const navItems = role === 'super_admin' ? superAdminNav : adminNav

  const [open, setOpen] = useState(false)

  // Tutup drawer setiap pindah halaman — kalau tidak, drawer tetap menutupi
  // konten yang baru dibuka.
  useEffect(() => { setOpen(false) }, [pathname])

  // Kunci scroll halaman di belakang drawer + tutup dengan Escape.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = prev
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login'); router.refresh()
  }

  const roleBadge = role === 'super_admin' ? 'Super Admin' : 'Admin'

  const navList = (
    <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 3 }}>
      {navItems.map(({ href, label, icon: Icon }) => {
        const isActive = pathname === href
        return (
          <Link
            key={href}
            href={href}
            className={`sidebar-link ${isActive ? 'active' : ''}`}
            aria-current={isActive ? 'page' : undefined}
          >
            {isActive && <span className="sidebar-link-rail" />}
            <Icon size={17} style={{ flexShrink: 0, opacity: isActive ? 1 : 0.7 }} />
            {label}
          </Link>
        )
      })}
    </nav>
  )

  const panelInner = (compact: boolean) => (
    <>
      <div style={{ padding: '2px 6px 18px' }}>
        <Brand compact={compact} />
        <div className="role-badge">{roleBadge}</div>
      </div>

      <div className="hairline" />

      <div className="menu-label">Menu</div>
      {navList}

      <div className="hairline" style={{ margin: '16px 4px' }} />

      <button onClick={handleLogout} className="logout-btn">
        <LogOut size={17} style={{ flexShrink: 0 }} />
        Keluar
      </button>
    </>
  )

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');

        .sidebar-link {
          display: flex; align-items: center; gap: 11px;
          padding: 12px 12px; border-radius: 12px;
          font-size: 14px; font-weight: 500; text-decoration: none;
          transition: background .18s, color .18s;
          color: #7A6259; border: 1px solid transparent;
          font-family: 'Poppins', sans-serif; position: relative;
        }
        .sidebar-link:hover { color: #D42B22; background: rgba(212,43,34,0.05); }
        .sidebar-link.active {
          color: #D42B22; font-weight: 600;
          background: linear-gradient(135deg,rgba(212,43,34,0.10),rgba(212,43,34,0.05));
          border-color: rgba(212,43,34,0.20);
        }
        .sidebar-link:focus-visible,
        .logout-btn:focus-visible,
        .drawer-btn:focus-visible { outline: 2px solid #D42B22; outline-offset: 2px; }
        .sidebar-link-rail {
          position: absolute; left: 0; top: 50%; transform: translateY(-50%);
          width: 3px; height: 20px; border-radius: 0 3px 3px 0;
          background: linear-gradient(to bottom,#E83530,#D42B22);
        }
        .logout-btn {
          display: flex; align-items: center; gap: 11px;
          padding: 12px 12px; border-radius: 12px;
          font-size: 14px; font-weight: 500;
          background: none; border: none; cursor: pointer;
          color: #9E8880; transition: background .18s, color .18s;
          width: 100%; font-family: 'Poppins', sans-serif;
        }
        .logout-btn:hover { color: #C02018; background: rgba(212,43,34,0.06); }
        .hairline {
          height: 1px; margin: 0 4px 16px;
          background: linear-gradient(90deg,transparent,rgba(212,43,34,0.10),transparent);
        }
        .menu-label {
          color: #B0A09A; font-size: 10px; font-weight: 700; letter-spacing: 2px;
          text-transform: uppercase; padding: 0 12px; margin-bottom: 8px;
          font-family: 'Poppins',sans-serif;
        }
        .role-badge {
          margin: 12px 0 0; width: fit-content;
          color: #D42B22; font-size: 9px; letter-spacing: 2px;
          text-transform: uppercase; font-weight: 700;
          font-family: 'Poppins',sans-serif;
          background: rgba(212,43,34,0.07); border: 1px solid rgba(212,43,34,0.16);
          border-radius: 20px; padding: 4px 10px;
        }

        /* ── SIDEBAR (dipakai desktop & drawer mobile) ── */
        .sidebar-panel {
          display: flex; flex-direction: column;
          width: 248px; padding: 22px 16px;
          background: #FFFFFF;
          font-family: 'Poppins', sans-serif;
          overflow-y: auto;
        }
        .sidebar-desktop {
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 100;
          border-right: 1px solid rgba(212,43,34,0.08);
          box-shadow: 1px 0 20px rgba(212,43,34,0.04);
        }

        /* ── TOPBAR MOBILE ── */
        .mobile-topbar {
          display: none;
          position: fixed; top: 0; left: 0; right: 0; height: 58px; z-index: 90;
          align-items: center; gap: 12px; padding: 0 12px;
          background: rgba(255,255,255,0.94);
          backdrop-filter: blur(10px);
          border-bottom: 1px solid rgba(212,43,34,0.09);
          font-family: 'Poppins', sans-serif;
        }
        .drawer-btn {
          display: flex; align-items: center; justify-content: center;
          width: 42px; height: 42px; flex-shrink: 0;
          border-radius: 12px; cursor: pointer;
          background: rgba(212,43,34,0.06);
          border: 1px solid rgba(212,43,34,0.14);
          color: #D42B22;
        }
        .drawer-btn:active { background: rgba(212,43,34,0.12); }

        /* ── DRAWER ── */
        .drawer-scrim {
          position: fixed; inset: 0; z-index: 110;
          background: rgba(21,12,9,0.42);
          backdrop-filter: blur(2px);
          animation: scrim-in .18s ease;
        }
        .drawer-panel {
          position: fixed; top: 0; left: 0; bottom: 0; z-index: 120;
          box-shadow: 6px 0 32px rgba(21,12,9,0.22);
          animation: drawer-in .22s cubic-bezier(.22,.61,.36,1);
          max-width: 86vw;
        }
        @keyframes scrim-in  { from { opacity: 0 } to { opacity: 1 } }
        @keyframes drawer-in { from { transform: translateX(-100%) } to { transform: translateX(0) } }

        @media (prefers-reduced-motion: reduce) {
          .drawer-scrim, .drawer-panel { animation: none; }
        }

        @media (max-width: 768px) {
          .sidebar-desktop { display: none !important; }
          .mobile-topbar   { display: flex; }
        }
      `}</style>

      {/* ── DESKTOP ── */}
      <aside className="sidebar-panel sidebar-desktop">{panelInner(false)}</aside>

      {/* ── MOBILE TOPBAR ── */}
      <header className="mobile-topbar">
        <button
          className="drawer-btn"
          onClick={() => setOpen(true)}
          aria-label="Buka menu"
          aria-expanded={open}
        >
          <Menu size={21} />
        </button>
        <Brand compact />
      </header>

      {/* ── MOBILE DRAWER ── */}
      {open && (
        <>
          <div className="drawer-scrim" onClick={() => setOpen(false)} />
          <aside className="sidebar-panel drawer-panel" role="dialog" aria-modal="true" aria-label="Menu navigasi">
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 4 }}>
              <button className="drawer-btn" onClick={() => setOpen(false)} aria-label="Tutup menu">
                <X size={20} />
              </button>
            </div>
            {panelInner(true)}
          </aside>
        </>
      )}
    </>
  )
}
