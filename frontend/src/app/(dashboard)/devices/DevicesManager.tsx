'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Monitor, Plus, Power, Loader2, X, Cpu, Calendar } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Device = {
  id: string
  hwid: string
  device_name: string | null
  is_active: boolean
  license_start: string | null
  license_end: string | null
  client_id: string
  created_at: string
  clients: { id: string; name: string } | null
}

type ClientOption = { id: string; name: string }

export default function DevicesManager({
  initialDevices, clients, isSuperAdmin, myClientId
}: {
  initialDevices: Device[]
  clients: ClientOption[]
  isSuperAdmin: boolean
  myClientId: string | null
}) {
  const [devices, setDevices]     = useState<Device[]>(initialDevices)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading]     = useState(false)
  const [toggleLoading, setToggleLoading] = useState<string | null>(null)
  const [error, setError]         = useState('')

  const [form, setForm] = useState({
    hwid: '',
    device_name: '',
    client_id: isSuperAdmin ? '' : (myClientId ?? ''),
    license_end: '',
  })

  const supabase = createClient()
  const router   = useRouter()

  const handleCreate = async () => {
    if (!form.hwid || !form.client_id) {
      setError('HWID dan Client wajib diisi.'); return
    }
    setLoading(true); setError('')

    const insertData: any = {
      hwid: form.hwid.trim().toUpperCase(),
      device_name: form.device_name || null,
      client_id: form.client_id,
      is_active: true,
    }
    if (form.license_end) insertData.license_end = form.license_end
    if (form.license_end) insertData.license_start = new Date().toISOString().split('T')[0]

    const { data, error: insertError } = await supabase
      .from('devices').insert(insertData).select('*, clients(id,name)').single()

    if (insertError) {
      setError(insertError.message.includes('unique') ? 'HWID sudah terdaftar.' : insertError.message)
      setLoading(false); return
    }

    setDevices(prev => [data, ...prev])
    setShowModal(false)
    setForm({ hwid: '', device_name: '', client_id: isSuperAdmin ? '' : (myClientId ?? ''), license_end: '' })
    setLoading(false)
  }

  const handleToggle = async (deviceId: string, currentStatus: boolean) => {
    setToggleLoading(deviceId)
    const { error } = await supabase
      .from('devices').update({ is_active: !currentStatus }).eq('id', deviceId)
    if (!error) {
      setDevices(prev => prev.map(d => d.id === deviceId ? { ...d, is_active: !currentStatus } : d))
    }
    setToggleLoading(null)
  }

  const isExpired = (license_end: string | null) => {
    if (!license_end) return false
    return new Date() > new Date(license_end)
  }

  const inputStyle = {
    width:'100%', boxSizing:'border-box' as const,
    background:'rgba(212,43,34,0.05)',
    border:'1.5px solid rgba(212,43,34,0.08)',
    borderRadius:'12px', padding:'12px 16px',
    color:'#150C09', fontSize:'14px', outline:'none',
    fontFamily:"'Poppins',sans-serif",
  }

  return (
    <>
      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fade-in  { from{opacity:0} to{opacity:1} }
        @keyframes spin     { to{transform:rotate(360deg)} }
        .page-anim { animation: fade-up 0.4s ease both; }
        .table-row:hover { background: rgba(212,43,34,0.03); }
        .modal-overlay { animation: fade-in 0.2s ease both; }
        .modal-card    { animation: fade-up 0.3s ease both; }
        select option  { background: #FFFFFF; color: #150C09; }
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
      `}</style>

      <div style={{ fontFamily:"'Poppins',sans-serif", minHeight:'100vh', padding:'32px 36px' }}>

        {/* Header */}
        <div className="page-anim" style={{ marginBottom:'32px', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'6px' }}>
              <div style={{ width:'3px', height:'20px', borderRadius:'2px', background:'linear-gradient(to bottom,#E83530,#D42B22)' }} />
              <p style={{ color:'rgba(122,98,89,0.8)', fontSize:'11px', fontWeight:600, letterSpacing:'2.5px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif' }}>
                {isSuperAdmin ? 'Super Admin' : 'Admin'}
              </p>
            </div>
            <h1 style={{ color:'#150C09', fontSize:'28px', fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:'4px' }}>
              Manajemen Lisensi
            </h1>
            <p style={{ color:'rgba(122,98,89,0.88)', fontSize:'14px' }}>
              {devices.length} perangkat terdaftar
            </p>
          </div>
          <button onClick={() => setShowModal(true)} style={{ display:'flex', alignItems:'center', gap:'8px', background:'linear-gradient(135deg,#E83530,#C02018)', border:'none', borderRadius:'12px', padding:'11px 20px', color:'#fff', fontSize:'13px', fontWeight:600, cursor:'pointer', boxShadow:'0 4px 16px rgba(212,43,34,0.35)', fontFamily:"'Poppins',sans-serif" }}>
            <Plus size={16} />
            Daftarkan HWID
          </button>
        </div>

        {/* Table */}
        <div className="page-anim" style={{ background:'rgba(212,43,34,0.05)', backdropFilter:'blur(24px)', border:'1px solid rgba(212,43,34,0.07)', borderRadius:'20px', overflow:'hidden', animationDelay:'0.05s' }}>
          <div style={{ padding:'20px 24px', borderBottom:'1px solid rgba(212,43,34,0.055)', display:'flex', alignItems:'center', gap:'12px' }}>
            <div style={{ width:'32px', height:'32px', borderRadius:'10px', background:'rgba(212,43,34,0.15)', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <Monitor size={16} color="#E83530" />
            </div>
            <h2 style={{ color:'#150C09', fontSize:'15px', fontWeight:600, fontFamily:'Poppins,sans-serif' }}>Daftar Perangkat</h2>
          </div>

          <div style={{ overflowX:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse' }}>
              <thead>
                <tr style={{ borderBottom:'1px solid rgba(212,43,34,0.04)' }}>
                  {['Nama Perangkat', ...(isSuperAdmin ? ['Client'] : []), 'HWID', 'Lisensi Berakhir', 'Status', 'Aksi'].map(h => (
                    <th key={h} style={{ padding:'12px 20px', textAlign:'left', color:'rgba(158,136,128,0.95)', fontSize:'11px', fontWeight:600, letterSpacing:'1.5px', textTransform:'uppercase', fontFamily:'Poppins,sans-serif', whiteSpace:'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {devices.map((device) => {
                  const expired = isExpired(device.license_end)
                  const statusLabel = !device.is_active ? 'Nonaktif' : expired ? 'Expired' : 'Aktif'
                  const statusStyle = !device.is_active
                    ? { bg:'rgba(239,68,68,0.1)', color:'#B82018', border:'rgba(239,68,68,0.2)' }
                    : expired
                      ? { bg:'rgba(245,158,11,0.1)', color:'#D97706', border:'rgba(245,158,11,0.2)' }
                      : { bg:'rgba(16,185,129,0.1)', color:'#059669', border:'rgba(16,185,129,0.2)' }

                  return (
                    <tr key={device.id} className="table-row" style={{ borderBottom:'1px solid rgba(212,43,34,0.03)', transition:'background 0.15s' }}>
                      <td style={{ padding:'16px 20px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                          <div style={{ width:'34px', height:'34px', borderRadius:'10px', background:'rgba(232,53,48,0.15)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <Monitor size={15} color="#E83530" />
                          </div>
                          <div>
                            <p style={{ color:'#150C09', fontSize:'14px', fontWeight:600 }}>{device.device_name || 'Unnamed Device'}</p>
                            <p style={{ color:'rgba(158,136,128,0.95)', fontSize:'11px' }}>{device.id.slice(0,8)}...</p>
                          </div>
                        </div>
                      </td>
                      {isSuperAdmin && (
                        <td style={{ padding:'16px 20px', color:'rgba(74,46,34,0.9)', fontSize:'13px' }}>
                          {device.clients?.name ?? '—'}
                        </td>
                      )}
                      <td style={{ padding:'16px 20px' }}>
                        <code style={{ color:'#E83530', fontSize:'12px', background:'rgba(212,43,34,0.1)', padding:'4px 8px', borderRadius:'6px', letterSpacing:'0.5px' }}>
                          {device.hwid}
                        </code>
                      </td>
                      <td style={{ padding:'16px 20px' }}>
                        {device.license_end ? (
                          <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                            <Calendar size={13} color={expired ? '#B82018' : 'rgba(122,98,89,0.8)'} />
                            <span style={{ color: expired ? '#B82018' : 'rgba(74,46,34,0.82)', fontSize:'13px' }}>
                              {new Date(device.license_end).toLocaleDateString('id-ID', { dateStyle:'medium' })}
                            </span>
                          </div>
                        ) : (
                          <span style={{ color:'rgba(158,136,128,0.85)', fontSize:'13px' }}>Selamanya</span>
                        )}
                      </td>
                      <td style={{ padding:'16px 20px' }}>
                        <span style={{ background:statusStyle.bg, color:statusStyle.color, border:`1px solid ${statusStyle.border}`, borderRadius:'6px', padding:'4px 10px', fontSize:'12px', fontWeight:600 }}>
                          {statusLabel}
                        </span>
                      </td>
                      <td style={{ padding:'16px 20px' }}>
                        <button
                          onClick={() => handleToggle(device.id, device.is_active)}
                          disabled={toggleLoading === device.id}
                          style={{ display:'flex', alignItems:'center', gap:'6px', background: device.is_active ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)', border:`1px solid ${device.is_active ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`, borderRadius:'8px', padding:'6px 12px', color: device.is_active ? '#B82018' : '#059669', fontSize:'12px', fontWeight:600, cursor:'pointer', fontFamily:"'Poppins',sans-serif", opacity: toggleLoading === device.id ? 0.5 : 1 }}
                        >
                          {toggleLoading === device.id ? <Loader2 size={13} style={{ animation:'spin 1s linear infinite' }} /> : <Power size={13} />}
                          {device.is_active ? 'Nonaktifkan' : 'Aktifkan'}
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {!devices.length && (
                  <tr><td colSpan={isSuperAdmin ? 6 : 5} style={{ padding:'48px 20px', textAlign:'center', color:'rgba(158,136,128,0.85)', fontSize:'14px' }}>Belum ada perangkat terdaftar</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Modal Daftarkan HWID */}
      {showModal && (
        <div className="modal-overlay" style={{ position:'fixed', inset:0, zIndex:50, background:'rgba(0,0,0,0.6)', backdropFilter:'blur(8px)', display:'flex', alignItems:'center', justifyContent:'center', padding:'20px' }}>
          <div className="modal-card" style={{ width:'100%', maxWidth:'440px', background:'#FFFFFF', border:'1px solid rgba(212,43,34,0.10)', borderRadius:'24px', padding:'36px', boxShadow:'0 32px 64px rgba(0,0,0,0.25)', position:'relative', overflow:'hidden' }}>
            <div style={{ position:'absolute', top:0, left:'24px', right:'24px', height:'1px', background:'linear-gradient(90deg,transparent,rgba(212,43,34,0.10),transparent)' }} />

            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'28px' }}>
              <div>
                <h3 style={{ color:'#150C09', fontSize:'20px', fontWeight:700, fontFamily:'Poppins,sans-serif', marginBottom:'4px' }}>Daftarkan Perangkat</h3>
                <p style={{ color:'rgba(122,98,89,0.8)', fontSize:'13px' }}>Tambahkan HWID laptop photobooth</p>
              </div>
              <button onClick={() => { setShowModal(false); setError('') }} style={{ background:'rgba(212,43,34,0.055)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:'8px', width:'32px', height:'32px', display:'flex', alignItems:'center', justifyContent:'center', cursor:'pointer', color:'rgba(74,46,34,0.9)' }}>
                <X size={16} />
              </button>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:'16px' }}>
              {/* Client selector — super admin only */}
              {isSuperAdmin && (
                <div>
                  <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>Client</label>
                  <select
                    value={form.client_id} onChange={e => setForm(p => ({...p, client_id: e.target.value}))}
                    style={{ ...inputStyle, appearance:'none' }}
                    onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                  >
                    <option value="">-- Pilih Client --</option>
                    {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
              )}

              {/* HWID */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  Hardware ID (HWID)
                </label>
                <div style={{ position:'relative' }}>
                  <Cpu size={14} color="rgba(158,136,128,0.85)" style={{ position:'absolute', left:'14px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  <input
                    type="text" value={form.hwid}
                    onChange={e => setForm(p => ({...p, hwid: e.target.value.toUpperCase()}))}
                    placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
                    style={{ ...inputStyle, paddingLeft:'42px', fontFamily:'monospace', fontSize:'12px', letterSpacing:'0.5px' }}
                    onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                    onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                  />
                </div>
                <p style={{ color:'rgba(158,136,128,0.85)', fontSize:'11px', marginTop:'6px' }}>
                  💡 HWID bisa dilihat di debug panel splash screen Flutter app
                </p>
              </div>

              {/* Device Name */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  Nama Perangkat
                </label>
                <input
                  type="text" value={form.device_name}
                  onChange={e => setForm(p => ({...p, device_name: e.target.value}))}
                  placeholder="Unit 1 - Mall Amandya"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                  onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                />
              </div>

              {/* License End */}
              <div>
                <label style={{ color:'rgba(122,98,89,0.88)', fontSize:'11px', fontWeight:600, letterSpacing:'1px', textTransform:'uppercase', display:'block', marginBottom:'8px', fontFamily:'Poppins,sans-serif' }}>
                  Tanggal Expired <span style={{ color:'rgba(158,136,128,0.85)', textTransform:'none', letterSpacing:0 }}>(kosongkan = selamanya)</span>
                </label>
                <input
                  type="date" value={form.license_end}
                  onChange={e => setForm(p => ({...p, license_end: e.target.value}))}
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor='rgba(212,43,34,0.6)'}
                  onBlur={e => e.target.style.borderColor='rgba(212,43,34,0.08)'}
                />
              </div>

              {error && (
                <div style={{ background:'rgba(239,68,68,0.1)', border:'1px solid rgba(239,68,68,0.2)', borderRadius:'10px', padding:'10px 14px', color:'#C02018', fontSize:'13px' }}>
                  {error}
                </div>
              )}

              <div style={{ display:'flex', gap:'10px', marginTop:'4px' }}>
                <button onClick={() => { setShowModal(false); setError('') }} style={{ flex:1, padding:'12px', background:'rgba(212,43,34,0.05)', border:'1px solid rgba(212,43,34,0.08)', borderRadius:'12px', color:'rgba(74,46,34,0.9)', fontSize:'14px', fontWeight:500, cursor:'pointer', fontFamily:"'Poppins',sans-serif" }}>
                  Batal
                </button>
                <button onClick={handleCreate} disabled={loading} style={{ flex:2, padding:'12px', background:'linear-gradient(135deg,#E83530,#C02018)', border:'none', borderRadius:'12px', color:'#fff', fontSize:'14px', fontWeight:600, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', gap:'8px', opacity: loading ? 0.7 : 1, fontFamily:"'Poppins',sans-serif", boxShadow:'0 4px 16px rgba(212,43,34,0.3)' }}>
                  {loading ? <><Loader2 size={15} style={{ animation:'spin 1s linear infinite' }} />Menyimpan...</> : 'Daftarkan'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
