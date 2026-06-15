'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Users, Plus, Power, Loader2, X, Building2, Mail, Phone, Eye, EyeOff } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Client = {
  id: string
  name: string
  email: string
  phone: string | null
  is_active: boolean
  created_at: string
  devices: { count: number }[]
  admin_users: { count: number }[]
}

export default function ClientsManager({ initialClients }: { initialClients: Client[] }) {
  const [clients, setClients]     = useState<Client[]>(initialClients)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [error, setError]         = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const [form, setForm] = useState({
    name: '', email: '', phone: '', password: '',
  })

  const supabase = createClient()
  const router   = useRouter()

  const handleCreate = async () => {
    if (!form.name || !form.email || !form.password) {
      setError('Nama, email, dan password wajib diisi.'); return
    }
    setLoading(true); setError('')

    try {
      // 1. Buat user di Supabase Auth
      const res = await fetch('/api/admin/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })

      const result = await res.json()

      if (!res.ok) {
        setError(result.error || 'Gagal membuat client.'); setLoading(false); return
      }

      setShowModal(false)
      setForm({ name: '', email: '', phone: '', password: '' })
      router.refresh()
    } catch (e) {
      setError('Terjadi kesalahan. Coba lagi.')
    }
    setLoading(false)
  }

  const handleToggle = async (clientId: string, currentStatus: boolean) => {
    setToggleLoading(clientId)
    const { error } = await supabase
      .from('clients').update({ is_active: !currentStatus }).eq('id', clientId)

    if (!error) {
      setClients(prev => prev.map(c => c.id === clientId ? { ...c, is_active: !currentStatus } : c))
    }
    setToggleLoading(null)
  }

  return (
    <>
      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        .page-anim { animation: fade-up 0.4s ease both; }
        .table-row:hover { background: rgba(212,43,34,0.03); }
        .modal-overlay { animation: fade-in 0.2s ease both; }
        .modal-card { animation: fade-up 0.3s ease both; }
      `}</style>

      <div style={{ fontFamily:"'Poppins',sans-serif", minHeight:'100vh', padding:'32px 36px' }}>

        {/* Header */}
        <div className="page-anim" style={{ marginBottom:'32px', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
              <div style={{ width:'3px', height:'20px', borderRadius:'2px', background:'linear-gradient(to bottom,#E83530,#D42B22)' }} />
              <p style={{ color:'rgba(122,98,89,0.8)', fontSize:'11px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif' }}>
                Super Admin
              </p>
            </div>
            <h1 style={{ color:'#150C09', fontSize:'28px', fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:'4px' }}>
              Manajemen Client
            </h1>
            <p style={{ color:'rgba(122,98,89,0.88)', fontSize:'14px' }}>
              {clients.length} client terdaftar
            </p>
          </div>
          <button onClick={() => setShowModal(true)} style={{
            display:'flex', alignItems:'center', gap:'8px',
            background:'linear-gradient(135deg,#E83530,#C02018)',
            border:'none', borderRadius:'12px', padding:'11px 20px',
            color:'#150C09', fontSize:'13px', fontWeight:600, cursor:'pointer',
            boxShadow:'0 4px 16px rgba(212,43,34,0.35)',
            fontFamily:"'Poppins',sans-serif",
          }}>
            <Plus size={16} />
            Tambah Client
          </button>
        </div>

        {/* Table */}
        <div className="page-anim" style={{
          background:'rgba(212,43,34,0.05)',
          backdropFilter:'blur(24px)',
          border:'1px solid rgba(212,43,34,0.07)',
          borderRadius:'20px', overflow:'hidden',
          animationDelay:'0.05s',
        }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(212,43,34,0.055)', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'10px', background:'rgba(212,43,34,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Users size={16} color="#E83530" />
            </div>
            <h2 style={{ color:'#150C09', fontSize:'15px', fontWeight:600, fontFamily:'Poppins,sans-serif' }}>Daftar Client</h2>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(212,43,34,0.04)' }}>
                  {['Nama Bisnis','Email','No. HP','Perangkat','Admin','Status','Bergabung','Aksi'].map(h => (
                    <th key={h} style={{ padding:'12px 20px', textAlign:'left', color:'rgba(158,136,128,0.95)', fontSize:'11px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.id} className="table-row" style={{ borderBottom:'1px solid rgba(212,43,34,0.03)', transition:'background 0.15s' }}>
                    <td style={{ padding:'16px 20px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'linear-gradient(135deg,rgba(212,43,34,0.3),rgba(212,43,34,0.2))', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <Building2 size={16} color="#E83530" />
                        </div>
                        <div>
                          <p style={{ color:'#150C09', fontSize:'14px', fontWeight:600 }}>{client.name}</p>
                          <p style={{ color:'rgba(122,98,89,0.8)', fontSize:'11px' }}>{client.id.slice(0,8)}...</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding:'16px 20px', color:'rgba(74,46,34,0.9)', fontSize:'13px' }}>{client.email}</td>
                    <td style={{ padding:'16px 20px', color:'rgba(122,98,89,0.95)', fontSize:'13px' }}>{client.phone || '—'}</td>
                    <td style={{ padding:'16px 20px' }}>
                      <span style={{ background:'rgba(232,53,48,0.1)', color:'#E83530', border:'1px solid rgba(232,53,48,0.2)', borderRadius:'6px', padding:'3px 10px', fontSize:'12px', fontWeight:600 }}>
                        {client.devices?.[0]?.count ?? 0} unit
                      </span>
                    </td>
                    <td style={{ padding:'16px 20px' }}>
                      <span style={{ background:'rgba(212,43,34,0.1)', color:'#c4b5fd', border:'1px solid rgba(212,43,34,0.2)', borderRadius:'6px', padding:'3px 10px', fontSize:'12px', fontWeight:600 }}>
                        {client.admin_users?.[0]?.count ?? 0} akun
                      </span>
                    </td>
                    <td style={{ padding:'16px 20px' }}>
                      <span style={{
                        borderRadius:'6px', padding:'4px 10px', fontSize:'12px', fontWeight:600,
                        background: client.is_active ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                        color: client.is_active ? '#059669' : '#B82018',
                        border: `1px solid ${client.is_active ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
                      }}>
                        {client.is_active ? 'Aktif' : 'Nonaktif'}
                      </span>
                    </td>
                    <td style={{ padding:'16px 20px', color:'rgba(158,136,128,0.95)', fontSize:'12px', whiteSpace:'nowrap' }}>
                      {new Date(client.created_at).toLocaleDateString('id-ID', { dateStyle:'medium' })}
                    </td>
                    <td style={{ padding:'16px 20px' }}>
                      <button
                        onClick={() => handleToggle(client.id, client.is_active)}
                        disabled={toggleLoading === client.id}
                        style={{
                          display:'flex', alignItems:'center', gap:'6px',
                          background: client.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                          border: `1px solid ${client.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                          borderRadius:'8px', padding:'6px 12px',
                          color: client.is_active ? '#B82018' : '#059669',
                          fontSize:'12px', fontWeight:600, cursor:'pointer',
                          fontFamily:"'Poppins',sans-serif",
                          opacity: toggleLoading === client.id ? 0.5 : 1,
                        }}
                      >
                        {toggleLoading === client.id
                          ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} />
                          : <Power size={13} />
                        }
                        {client.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                      </button>
                    </td>
                  </tr>
                ))}
                {!clients.length && (
                  <tr><td colSpan={8} style={{ padding:'48px 20px', textAlign:'center', color:'rgba(158,136,128,0.85)', fontSize:'14px' }}>Belum ada client</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Tambah Client */}
      {showModal && (
        <div className="modal-overlay" style={{
          position:'fixed', inset:0, zIndex:50,
          background:'rgba(0,0,0,0.6)',
          backdropFilter:'blur(8px)',
          display:'flex', alignItems:'center', justifyContent:'center', padding:'20px',
        }}>
          <div className="modal-card" style={{
            width:'100%', maxWidth:'460px',
            background:'#FFFFFF',
            border:'1px solid rgba(212,43,34,0.10)',
            borderRadius:'24px', padding:'36px',
            boxShadow:'0 32px 64px rgba(0,0,0,0.25)',
            position:'relative', overflow:'hidden',
          }}>
            {/* Shine */}
            <div style={{ position:'absolute', top:0, left:'24px', right:'24px', height:'1px', background:'linear-gradient(90deg,transparent,rgba(212,43,34,0.10),transparent)' }} />

            {/* Header */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px' }}>
              <div>
                <h3 style={{ color:'#150C09', fontSize:'20px', fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:'4px' }}>
                  Tambah Client Baru
                </h3>
                <p style={{ color:'rgba(122,98,89,0.8)', fontSize:'13px' }}>
                  Buat akun bisnis + akun login admin
                </p>
              </div>
              <button onClick={() => { setShowModal(false); setError('') }} style={{ background:'rgba(212,43,34,0.055)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:'8px', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(74,46,34,0.9)' }}>
                <X size={16} />
              </button>
            </div>

            {/* Form */}
            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {/* Nama Bisnis */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  Nama Bisnis
                </label>
                <div style={{ position:'relative' }}>
                  <Building2 size={14} color="rgba(158,136,128,0.85)" style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input
                    type="text" value={form.name} onChange={e => setForm(p => ({...p, name: e.target.value}))}
                    placeholder="Photobooth Pak Budi"
                    style={{ width:'100%', boxSizing:'border-box', background:'rgba(212,43,34,0.05)', border:'1.5px solid rgba(212,43,34,0.08)', borderRadius:'12px', padding:'12px 16px 12px 42px', color:'#150C09', fontSize:'14px', outline:'none', fontFamily:"'Poppins',sans-serif" }}
                    onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  Email (untuk login dashboard)
                </label>
                <div style={{ position:'relative' }}>
                  <Mail size={14} color="rgba(158,136,128,0.85)" style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input
                    type="email" value={form.email} onChange={e => setForm(p => ({...p, email: e.target.value}))}
                    placeholder="admin@bisnis.com"
                    style={{ width:'100%', boxSizing:'border-box', background:'rgba(212,43,34,0.05)', border:'1.5px solid rgba(212,43,34,0.08)', borderRadius:'12px', padding:'12px 16px 12px 42px', color:'#150C09', fontSize:'14px', outline:'none', fontFamily:"'Poppins',sans-serif" }}
                    onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  No. HP <span style={{ color:'rgba(158,136,128,0.85)', textTransform:'none', letterSpacing:0 }}>(opsional)</span>
                </label>
                <div style={{ position:'relative' }}>
                  <Phone size={14} color="rgba(158,136,128,0.85)" style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input
                    type="text" value={form.phone} onChange={e => setForm(p => ({...p, phone: e.target.value}))}
                    placeholder="08123456789"
                    style={{ width:'100%', boxSizing:'border-box', background:'rgba(212,43,34,0.05)', border:'1.5px solid rgba(212,43,34,0.08)', borderRadius:'12px', padding:'12px 16px 12px 42px', color:'#150C09', fontSize:'14px', outline:'none', fontFamily:"'Poppins',sans-serif" }}
                    onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  Password Dashboard
                </label>
                <div style={{ position:'relative' }}>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={form.password} onChange={e => setForm(p => ({...p, password: e.target.value}))}
                    placeholder="Min. 8 karakter"
                    style={{ width:'100%', boxSizing:'border-box', background:'rgba(212,43,34,0.05)', border:'1.5px solid rgba(212,43,34,0.08)', borderRadius:'12px', padding:'12px 44px 12px 16px', color:'#150C09', fontSize:'14px', outline:'none', fontFamily:"'Poppins',sans-serif" }}
                    onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                  />
                  <button onClick={() => setShowPassword(p => !p)} style={{ position:'absolute', right:'12px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', cursor:'pointer', color:'rgba(122,98,89,0.8)', padding:0 }}>
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', padding:'10px 14px', color:'#C02018', fontSize:'13px' }}>
                  {error}
                </div>
              )}

              {/* Info */}
              <div style={{ background:'rgba(212,43,34,0.08)', border:'1px solid rgba(212,43,34,0.15)', borderRadius:'10px', padding:'12px 14px' }}>
                <p style={{ color:'rgba(165,180,252,0.8)', fontSize:'12px', lineHeight:1.6 }}>
                  ℹ️ Sistem akan otomatis membuat akun Supabase Auth dan menghubungkannya ke bisnis ini sebagai <strong>Admin</strong>.
                </p>
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
                <button onClick={() => { setShowModal(false); setError('') }} style={{ flex:1, padding:'12px', background:'rgba(212,43,34,0.05)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:'12px', color:'rgba(74,46,34,0.9)', fontSize:'14px', fontWeight:500, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                  Batal
                </button>
                <button onClick={handleCreate} disabled={loading} style={{ flex:2, padding:'12px', background:'linear-gradient(135deg,#E83530,#C02018)', border:'none', borderRadius:'12px', color:'#fff', fontSize:'14px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: loading ? 0.7 : 1, fontFamily:"'Poppins',sans-serif", boxShadow:'0 4px 16px rgba(212,43,34,0.3)' }}>
                  {loading ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />Membuat...</> : 'Buat Client'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  )
}
