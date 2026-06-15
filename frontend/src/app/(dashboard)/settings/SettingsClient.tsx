'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Timer, Save, CheckCircle, AlertCircle, Clock } from 'lucide-react'

interface Props {
  client: {
    id: string
    name: string
    session_duration_minutes: number
  } | null
}

const DURATION_PRESETS = [
  { label: "1 menit",   value: 1  },
  { label: "5 menit",   value: 5  },
  { label: "10 menit",  value: 10 },
  { label: "15 menit",  value: 15 },
  { label: "20 menit",  value: 20 },
  { label: "30 menit",  value: 30 },
]

export default function SettingsClient({ client }: Props) {
  const [duration, setDuration] = useState<number>(
    client?.session_duration_minutes ?? 30
  )
  const [loading, setLoading]   = useState(false)
  const [status,  setStatus]    = useState<'idle' | 'success' | 'error'>('idle')
  const [message, setMessage]   = useState('')

  const handleSave = async () => {
    const supabase = createClient()
    if (!client) return
    if (duration < 1 || duration > 30) {
      setStatus('error')
      setMessage('Durasi harus antara 1 menit sampai 30 menit.')
      return
    }
    setLoading(true)
    setStatus('idle')

    const { error } = await supabase
      .from('clients')
      .update({ session_duration_minutes: duration })
      .eq('id', client.id)

    setLoading(false)
    if (error) {
      setStatus('error')
      setMessage('Gagal menyimpan: ' + error.message)
    } else {
      setStatus('success')
      setMessage('Durasi sesi berhasil disimpan!')
      setTimeout(() => setStatus('idle'), 3000)
    }
  }

  const hours   = Math.floor(duration / 60)
  const minutes = duration % 60
  const preview = hours > 0
    ? `${hours} jam${minutes > 0 ? ` ${minutes} menit` : ''}`
    : `${minutes} menit`

  return (
    <div style={{ maxWidth: 680, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontSize: 28, fontWeight: 800, color: '#150C09',
          display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8
        }}>
          <div style={{
            width: 44, height: 44, borderRadius: 12,
            background: 'linear-gradient(135deg,#D42B22,#C02018)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Timer size={22} color="#fff" />
          </div>
          Pengaturan
        </h1>
        <p style={{ color: 'rgba(74,46,34,0.9)', fontSize: 14 }}>
          Konfigurasi sesi untuk {client?.name ?? 'bisnis Anda'}
        </p>
      </div>

      {/* Session Duration Card */}
      <div className="glass-card" style={{ padding: 28, marginBottom: 20 }}>
        {/* Card header */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24,
          paddingBottom: 20, borderBottom: '1px solid rgba(212,43,34,0.055)'
        }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(212,43,34,0.15)',
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            <Clock size={18} color="#E83530" />
          </div>
          <div>
            <h2 style={{ color: '#150C09', fontSize: 16, fontWeight: 700 }}>
              Durasi Sesi Photobooth
            </h2>
            <p style={{ color: 'rgba(122,98,89,0.95)', fontSize: 13, marginTop: 2 }}>
              Timer dimulai saat pelanggan berhasil membayar
            </p>
          </div>
        </div>

        {/* Preset buttons */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'rgba(74,46,34,0.9)', fontSize: 13, marginBottom: 12 }}>
            Pilih preset
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {DURATION_PRESETS.map(p => (
              <button
                key={p.value}
                onClick={() => setDuration(p.value)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: duration === p.value
                    ? '1px solid #D42B22'
                    : '1px solid rgba(212,43,34,0.08)',
                  background: duration === p.value
                    ? 'rgba(212,43,34,0.2)'
                    : 'rgba(212,43,34,0.04)',
                  color: duration === p.value ? '#E83530' : 'rgba(21,12,9,0.8)',
                  fontSize: 13,
                  fontWeight: duration === p.value ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Manual input */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ color: 'rgba(74,46,34,0.9)', fontSize: 13, marginBottom: 12 }}>
            Atau atur manual (menit)
          </p>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <input
              type="number"
              min={1}
              max={30}
              value={duration}
              onChange={e => setDuration(Math.max(1, Math.min(30, Number(e.target.value))))}
              style={{
                width: 100,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1px solid rgba(212,43,34,0.15)',
                background: '#FFFFFF',
                color: '#150C09',
                fontSize: 16,
                fontWeight: 600,
                textAlign: 'center',
                outline: 'none',
              }}
            />
            <span style={{ color: 'rgba(122,98,89,0.95)', fontSize: 14 }}>menit</span>

            {/* Live preview */}
            <div style={{
              marginLeft: 'auto',
              padding: '8px 16px',
              borderRadius: 10,
              background: 'rgba(212,43,34,0.1)',
              border: '1px solid rgba(212,43,34,0.2)',
              display: 'flex', alignItems: 'center', gap: 8
            }}>
              <Timer size={14} color="#E83530" />
              <span style={{ color: '#E83530', fontSize: 14, fontWeight: 600 }}>
                {preview}
              </span>
            </div>
          </div>

          {/* Range slider */}
          <input
            type="range"
            min={1}
            max={30}
            step={1}
            value={duration}
            onChange={e => setDuration(Number(e.target.value))}
            style={{ width: '100%', marginTop: 16, accentColor: '#D42B22', cursor: 'pointer' }}
          />
          <div style={{
            display: 'flex', justifyContent: 'space-between',
            color: 'rgba(122,98,89,0.8)', fontSize: 11, marginTop: 4
          }}>
            <span>1 menit</span>
            <span>30 menit</span>
          </div>
        </div>

        {/* Info box */}
        <div style={{
          padding: '12px 16px',
          borderRadius: 10,
          background: 'rgba(232,53,48,0.08)',
          border: '1px solid rgba(232,53,48,0.15)',
          marginBottom: 24,
          fontSize: 13,
          color: 'rgba(74,46,34,0.9)',
          lineHeight: 1.6,
        }}>
          ℹ️ Timer akan tampil sebagai countdown di aplikasi Flutter. Saat timer habis, 
          aplikasi otomatis kembali ke halaman awal dan sesi direset.
        </div>

        {/* Status message */}
        {status !== 'idle' && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '12px 16px', borderRadius: 10, marginBottom: 20,
            background: status === 'success'
              ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
            border: `1px solid ${status === 'success'
              ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)'}`,
            color: status === 'success' ? '#059669' : '#B82018',
            fontSize: 13,
          }}>
            {status === 'success'
              ? <CheckCircle size={16} />
              : <AlertCircle size={16} />}
            {message}
          </div>
        )}

        {/* Save button */}
        <button
          onClick={handleSave}
          disabled={loading}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '12px 24px',
            borderRadius: 10,
            border: 'none',
            background: loading
              ? 'rgba(212,43,34,0.4)'
              : 'linear-gradient(135deg,#D42B22,#C02018)',
            color: '#fff',
            fontSize: 14,
            fontWeight: 600,
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.15s',
          }}
        >
          <Save size={16} />
          {loading ? 'Menyimpan...' : 'Simpan Pengaturan'}
        </button>
      </div>
    </div>
  )
}