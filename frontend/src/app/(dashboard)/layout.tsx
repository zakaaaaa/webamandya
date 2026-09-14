import { redirect } from 'next/navigation'
import { createServerSupabaseClient } from '@/lib/supabase-server'
import Sidebar from '@/components/dashboard/Sidebar'

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: adminUser } = await supabase
    .from('admin_users').select('role, full_name, client_id').eq('id', user.id).single()
  if (!adminUser) redirect('/login')

  return (
    <>
      <style>{`
        /* Poppins sudah dimuat globals.css — @import kedua di sini hanya
           menambah permintaan CSS yang memblokir render di tiap halaman. */
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Poppins',sans-serif; }
        @keyframes fade-up  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        ::-webkit-scrollbar { width:6px; height:6px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:rgba(212,43,34,0.18); border-radius:3px; }
        .glass-card {
          background:#FFFFFF;
          border:1px solid rgba(212,43,34,0.10);
          border-radius:20px;
          box-shadow:0 2px 12px rgba(212,43,34,0.06), 0 1px 3px rgba(0,0,0,0.04);
          position:relative;
          overflow:hidden;
        }
        .glass-card::before {
          content:'';
          position:absolute;
          top:0; left:24px; right:24px; height:1px;
          background:linear-gradient(90deg,transparent,rgba(212,43,34,0.16),transparent);
        }
        .table-row:hover { background:rgba(212,43,34,0.03); }

        /* ── MAIN CONTENT ──
           margin-left mengikuti --pk-sidebar-w (globals.css) supaya tidak
           pernah lagi selisih dengan lebar sidebar dan menimpa konten. */
        .dashboard-main {
          flex: 1;
          min-width: 0;
          min-height: 100vh;
          min-height: 100dvh;
          position: relative;
          z-index: 10;
          margin-left: var(--pk-sidebar-w);
          padding: 32px 36px;
        }

        /* Laptop kecil / tablet lanskap: sidebar tetap ada, padding dirampingkan
           supaya kolom konten tidak tersisa sempit. */
        @media (max-width: 1200px) {
          .dashboard-main { padding: 28px 24px; }
        }

        /* Di bawah 900px sidebar berubah jadi drawer (Sidebar.tsx): konten
           memakai lebar penuh, dengan ruang untuk topbar setinggi 58px. */
        @media (max-width: 900px) {
          .dashboard-main {
            margin-left: 0;
            padding-top: 74px;
            padding-bottom: 32px;
            padding-left: max(16px, env(safe-area-inset-left));
            padding-right: max(16px, env(safe-area-inset-right));
          }
        }

        @media (max-width: 480px) {
          .dashboard-main {
            padding-left: max(12px, env(safe-area-inset-left));
            padding-right: max(12px, env(safe-area-inset-right));
          }
        }
      `}</style>

      <div style={{
        minHeight: '100vh', position: 'relative',
        background: '#FAF7F5',
        fontFamily: "'Poppins',sans-serif",
      }}>
        {/* Cahaya merah lembut + grid, dalam SATU lapisan statis.
            Dulu tiga orb 350–600px ber-filter blur(70px) dengan animasi
            infinite: blur sebesar itu dihitung ulang setiap frame di semua
            halaman dasbor, dan itulah yang membuat dasbor terasa berat di
            laptop/HP biasa. Radial-gradient tanpa filter tampak hampir sama
            dan hanya dilukis sekali. */}
        <div style={{
          position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
          backgroundImage: [
            'radial-gradient(600px circle at 150px 150px, rgba(232,53,48,0.06), transparent 70%)',
            'radial-gradient(500px circle at calc(100% - 150px) calc(100% - 150px), rgba(212,43,34,0.05), transparent 70%)',
            'radial-gradient(350px circle at 55% 55%, rgba(217,119,6,0.04), transparent 70%)',
            'linear-gradient(rgba(212,43,34,0.025) 1px,transparent 1px)',
            'linear-gradient(90deg,rgba(212,43,34,0.025) 1px,transparent 1px)',
          ].join(','),
          backgroundSize:'100% 100%,100% 100%,100% 100%,56px 56px,56px 56px',
        }} />

        {/* Sidebar */}
        <Sidebar role={adminUser.role} />

        {/* Main content */}
        <main className="dashboard-main">
          {children}
        </main>
      </div>
    </>
  )
}
