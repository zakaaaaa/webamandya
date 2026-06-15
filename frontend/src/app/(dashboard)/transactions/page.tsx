import { createServerSupabaseClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import { Receipt } from 'lucide-react'

export default async function Page() {
  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  return (
    <div style={{ minHeight: '100vh', fontFamily: "'Poppins',sans-serif" }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
        <p style={{ color: '#D42B22', fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase' }}>Menu</p>
      </div>
      <h1 style={{ color: '#150C09', fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 20 }}>
        Transaksi
      </h1>
      <div className="glass-card" style={{ padding: '56px 24px', textAlign: 'center' }}>
        <div style={{
          width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
          background: 'rgba(212,43,34,0.07)', border: '1px solid rgba(212,43,34,0.12)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D42B22',
        }}>
          <Receipt size={24} />
        </div>
        <p style={{ color: '#4A2E22', fontSize: 15, fontWeight: 700, marginBottom: 4 }}>
          Sedang dalam pengembangan
        </p>
        <p style={{ color: '#9E8880', fontSize: 13 }}>
          Halaman ini akan segera tersedia
        </p>
      </div>
    </div>
  )
}
