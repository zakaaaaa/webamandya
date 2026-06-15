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
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        body { font-family:'Poppins',sans-serif; }
        @keyframes float-1 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(30px,-25px)} }
        @keyframes float-2 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-20px,30px)} }
        @keyframes float-3 { 0%,100%{transform:translate(0,0)} 50%{transform:translate(15px,20px)} }
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

        /* ── MAIN CONTENT ── */
        .dashboard-main {
          flex: 1;
          min-height: 100vh;
          position: relative;
          z-index: 10;
          margin-left: 240px;
          padding: 32px 36px;
        }

        @media (max-width: 768px) {
          .dashboard-main {
            margin-left: 0;
            padding: 20px 16px 80px;
          }
        }
      `}</style>

      <div style={{
        minHeight: '100vh', position: 'relative',
        background: '#FAF7F5',
        fontFamily: "'Poppins',sans-serif",
      }}>
        {/* Soft red ambient orbs */}
        {[
          { w:600, h:600, style:{top:'-150px', left:'-150px'},     color:'rgba(232,53,48,0.06)',  anim:'float-1 18s ease-in-out infinite' },
          { w:500, h:500, style:{bottom:'-100px', right:'-100px'}, color:'rgba(212,43,34,0.05)',  anim:'float-2 22s ease-in-out infinite' },
          { w:350, h:350, style:{top:'40%', left:'40%'},            color:'rgba(217,119,6,0.04)',  anim:'float-3 26s ease-in-out infinite 4s' },
        ].map((o, i) => (
          <div key={i} style={{
            position:'fixed', width:`${o.w}px`, height:`${o.h}px`, borderRadius:'50%',
            filter:'blur(70px)', pointerEvents:'none', zIndex:0,
            background:`radial-gradient(circle,${o.color} 0%,transparent 70%)`,
            animation:o.anim, ...o.style,
          }} />
        ))}

        {/* Subtle grid pattern */}
        <div style={{
          position:'fixed', inset:0, pointerEvents:'none', zIndex:0,
          backgroundImage:'linear-gradient(rgba(212,43,34,0.025) 1px,transparent 1px),linear-gradient(90deg,rgba(212,43,34,0.025) 1px,transparent 1px)',
          backgroundSize:'56px 56px',
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
