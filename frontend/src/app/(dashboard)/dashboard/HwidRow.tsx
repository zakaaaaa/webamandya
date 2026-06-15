'use client'

import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

export function HwidRow({ hwid, lastSeen, firstSeen, status, deviceName }: {
  hwid: string
  lastSeen: string
  firstSeen: string
  status: 'Aktif' | 'Tidak Aktif' | 'Belum Terdaftar'
  deviceName: string
}) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    await navigator.clipboard.writeText(hwid)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' })

  const isRegistered = status !== 'Belum Terdaftar'
  const isActive = status === 'Aktif'

  // green = Aktif, amber = Belum Terdaftar, red = Tidak Aktif
  const bg        = isActive ? 'rgba(5,150,105,0.05)'  : (!isRegistered ? 'rgba(217,119,6,0.05)'  : 'rgba(180,30,20,0.05)')
  const border    = isActive ? 'rgba(5,150,105,0.16)'  : (!isRegistered ? 'rgba(217,119,6,0.16)'  : 'rgba(180,30,20,0.16)')
  const dotColor  = isActive ? '#059669'               : (!isRegistered ? '#D97706'               : '#B82018')
  const badgeBg   = isActive ? 'rgba(5,150,105,0.12)'  : (!isRegistered ? 'rgba(217,119,6,0.12)'  : 'rgba(180,30,20,0.12)')
  const badgeColor= isActive ? '#059669'               : (!isRegistered ? '#D97706'               : '#B82018')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 12,
    }}>
      {/* Dot indicator */}
      <div style={{ width: 7, height: 7, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />

      {/* HWID & Name info */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ color: '#150C09', fontSize: 13, fontWeight: 700, fontFamily: "'Poppins',sans-serif" }}>
            {deviceName}
          </span>
          <span style={{
            background: badgeBg, color: badgeColor,
            fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 100, letterSpacing: 0.3,
          }}>
            {status}
          </span>
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: 11,
          color: '#9E8880', letterSpacing: 0.5,
          wordBreak: 'break-all',
        }}>
          {hwid}
        </span>
      </div>

      {/* Timestamps */}
      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, color: '#C0AFA9', whiteSpace: 'nowrap' }}>
          Pertama: {formatDate(firstSeen)}
        </span>
        <span style={{ fontSize: 10, color: '#9E8880', whiteSpace: 'nowrap' }}>
          Terakhir: {lastSeen ? formatDate(lastSeen) : '—'}
        </span>
      </div>

      {/* Copy button */}
      <button
        onClick={copy}
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '7px 10px',
          background: copied ? 'rgba(5,150,105,0.12)' : 'rgba(212,43,34,0.06)',
          border: `1px solid ${copied ? 'rgba(5,150,105,0.3)' : 'rgba(212,43,34,0.14)'}`,
          borderRadius: 9, cursor: 'pointer',
          color: copied ? '#059669' : '#D42B22',
          fontSize: 11, fontWeight: 700,
          transition: 'all 0.2s',
        }}
        title="Copy HWID"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}
