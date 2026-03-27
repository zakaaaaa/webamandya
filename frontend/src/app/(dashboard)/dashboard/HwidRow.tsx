'use client'

import { useState } from 'react'
import { Copy, Check, Monitor } from 'lucide-react'

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

  // Define styling based on status
  const isRegistered = status !== 'Belum Terdaftar'
  const isActive = status === 'Aktif'
  
  const bg = isActive ? 'rgba(16,185,129,0.05)' : (!isRegistered ? 'rgba(245,158,11,0.05)' : 'rgba(239,68,68,0.05)')
  const border = isActive ? 'rgba(16,185,129,0.1)' : (!isRegistered ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)')
  const dotColor = isActive ? '#10b981' : (!isRegistered ? '#f59e0b' : '#ef4444')
  const badgeBg = isActive ? 'rgba(16,185,129,0.15)' : (!isRegistered ? 'rgba(245,158,11,0.15)' : 'rgba(239,68,68,0.15)')
  const badgeColor = isActive ? '#34d399' : (!isRegistered ? '#fbbf24' : '#f87171')

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px',
      background: bg,
      border: `1px solid ${border}`,
      borderRadius: 8,
    }}>
      {/* Dot indicator */}
      <div style={{
        width: 7, height: 7, borderRadius: '50%',
        background: dotColor, flexShrink: 0,
      }} />

      {/* HWID & Name info */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ 
            color: 'white', fontSize: 13, fontWeight: 600, fontFamily: "'Plus Jakarta Sans',sans-serif"
          }}>
            {deviceName}
          </span>
          <span style={{
            background: badgeBg, color: badgeColor,
            fontSize: 10, fontWeight: 600, padding: '2px 6px', borderRadius: 4, letterSpacing: 0.5
          }}>
            {status}
          </span>
        </div>
        <span style={{
          fontFamily: 'monospace', fontSize: 11,
          color: 'rgba(255,255,255,0.4)', letterSpacing: 0.5,
          wordBreak: 'break-all',
        }}>
          {hwid}
        </span>
      </div>

      {/* Timestamps */}
      <div style={{ flexShrink: 0, textAlign: 'right', display: 'flex', flexDirection: 'column', gap: 2 }}>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', whiteSpace: 'nowrap' }}>
          Pertama: {formatDate(firstSeen)}
        </span>
        <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap' }}>
          Terakhir: {lastSeen ? formatDate(lastSeen) : '—'}
        </span>
      </div>

      {/* Copy button */}
      <button
        onClick={copy}
        style={{
          flexShrink: 0,
          display: 'flex', alignItems: 'center', gap: 5,
          padding: '6px 10px',
          background: copied ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.06)',
          border: `1px solid ${copied ? 'rgba(16,185,129,0.3)' : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 6, cursor: 'pointer',
          color: copied ? '#34d399' : 'rgba(255,255,255,0.5)',
          fontSize: 11, fontWeight: 600,
          transition: 'all 0.2s',
        }}
        title="Copy HWID"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
      </button>
    </div>
  )
}