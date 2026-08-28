'use client'

import { useCallback, useMemo, useState, useTransition } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import {
  Receipt, Search, X, ChevronLeft, ChevronRight, Download, RefreshCw,
  TrendingUp, CheckCircle2, Clock, XCircle, ExternalLink, FilterX,
} from 'lucide-react'

type Session = {
  id: string
  transaction_code: string
  payment_method: string
  payment_status: string
  amount: number
  original_amount: number | null
  created_at: string
  paid_at: string | null
  result_url: string | null
  voucher_id: string | null
  devices: { id: string; device_name: string } | null
  clients: { id: string; name: string } | null
}

type Props = {
  sessions: Session[]
  devices: { id: string; device_name: string }[]
  clients: { id: string; name: string }[]
  isSuperAdmin: boolean
  filters: { status: string; method: string; device: string; client: string; from: string; to: string; search: string }
  currentPage: number
  perPage: number
  filteredCount: number
  stats: { total: number; paid: number; pending: number; expired: number; free: number; revenue: number }
}

const STATUS_STYLE: Record<string, { bg: string; color: string; border: string }> = {
  paid:    { bg: 'rgba(5,150,105,0.10)',  color: '#059669', border: 'rgba(5,150,105,0.22)' },
  pending: { bg: 'rgba(217,119,6,0.10)',  color: '#D97706', border: 'rgba(217,119,6,0.22)' },
  free:    { bg: 'rgba(212,43,34,0.08)',  color: '#D42B22', border: 'rgba(212,43,34,0.18)' },
  bypass:  { bg: 'rgba(212,43,34,0.08)',  color: '#D42B22', border: 'rgba(212,43,34,0.18)' },
  expired: { bg: 'rgba(122,98,89,0.10)',  color: '#7A6259', border: 'rgba(122,98,89,0.20)' },
  failed:  { bg: 'rgba(180,30,20,0.10)',  color: '#B82018', border: 'rgba(180,30,20,0.20)' },
}

const STATUS_OPTIONS = [
  { value: '',        label: 'Semua status' },
  { value: 'paid',    label: 'Lunas' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'expired', label: 'Kedaluwarsa' },
  { value: 'free',    label: 'Gratis' },
  { value: 'failed',  label: 'Gagal' },
]

const METHOD_OPTIONS = [
  { value: '',        label: 'Semua metode' },
  { value: 'qris',    label: 'QRIS' },
  { value: 'voucher', label: 'Voucher' },
  { value: 'bypass',  label: 'Bypass' },
]

const rupiah = (n: number) => `Rp ${Number(n || 0).toLocaleString('id-ID')}`
const ymd = (d: Date) => {
  const p = (x: number) => String(x).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export default function TransactionsClient({
  sessions, devices, clients, isSuperAdmin, filters, currentPage, perPage, filteredCount, stats,
}: Props) {
  const router   = useRouter()
  const pathname = usePathname()
  const supabase = createClient()
  const [isPending, startTransition] = useTransition()

  const [localSearch, setLocalSearch] = useState(filters.search)
  const [exporting, setExporting]     = useState(false)
  const [rechecking, setRechecking]   = useState<string | null>(null)
  const [toast, setToast]             = useState<{ kind: 'ok' | 'err'; text: string } | null>(null)

  const totalPages = Math.max(1, Math.ceil(filteredCount / perPage))

  const pushFilter = useCallback((updates: Record<string, string>) => {
    const sp = new URLSearchParams()
    Object.entries({ ...filters, page: '1', ...updates }).forEach(([k, v]) => { if (v) sp.set(k, v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }, [filters, pathname, router])

  const goPage = (p: number) => {
    const sp = new URLSearchParams()
    Object.entries({ ...filters, page: String(p) }).forEach(([k, v]) => { if (v) sp.set(k, v) })
    startTransition(() => router.push(`${pathname}?${sp.toString()}`))
  }

  const resetFilters = () => {
    setLocalSearch('')
    startTransition(() => router.push(pathname))
  }

  // Rentang cepat. `to` selalu hari ini supaya rentangnya tidak pernah terbalik.
  const quickRange = (days: number | null) => {
    if (days === null) { pushFilter({ from: '', to: '' }); return }
    const to   = new Date()
    const from = new Date()
    from.setDate(from.getDate() - (days - 1))
    pushFilter({ from: ymd(from), to: ymd(to) })
  }

  const activeQuick = useMemo(() => {
    if (!filters.from && !filters.to) return 'all'
    if (filters.to !== ymd(new Date())) return ''
    for (const d of [1, 7, 30]) {
      const f = new Date(); f.setDate(f.getDate() - (d - 1))
      if (filters.from === ymd(f)) return String(d)
    }
    return ''
  }, [filters.from, filters.to])

  const activeFilterCount =
    [filters.status, filters.method, filters.device, filters.client, filters.from, filters.to, filters.search]
      .filter(Boolean).length

  const fmt = (d: string | null) =>
    d ? new Date(d).toLocaleString('id-ID', { dateStyle: 'short', timeStyle: 'short' }) : '—'

  // ── Tanya ulang status ke DOKU lewat backend ──
  // Backend membaca order.status, bukan hanya transaction.status, sehingga sesi
  // yang sudah kedaluwarsa di DOKU ikut tertutup di sini.
  const recheck = async (s: Session) => {
    setRechecking(s.id)
    setToast(null)
    try {
      const base = process.env.NEXT_PUBLIC_API_URL ?? ''
      const res  = await fetch(`${base}/api/payment/check-status`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_uuid: s.transaction_code }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data?.message ?? `HTTP ${res.status}`)

      if (data.status === s.payment_status) {
        setToast({ kind: 'ok', text: `${s.transaction_code}: masih ${data.status} di DOKU.` })
      } else {
        setToast({ kind: 'ok', text: `${s.transaction_code}: ${s.payment_status} → ${data.status}.` })
        startTransition(() => router.refresh())
      }
    } catch (e: any) {
      setToast({ kind: 'err', text: `Gagal cek ke DOKU: ${e.message}` })
    } finally {
      setRechecking(null)
    }
  }

  // ── Export CSV seluruh hasil filter, bukan hanya halaman ini ──
  const exportCsv = async () => {
    setExporting(true)
    setToast(null)
    try {
      let q = supabase
        .from('sessions')
        .select(`transaction_code, payment_method, payment_status, amount, original_amount,
                 created_at, paid_at, devices(device_name), clients(name)`)
        .order('created_at', { ascending: false })
        .limit(5000)

      if (filters.client) q = q.eq('client_id', filters.client)
      if (filters.status) q = q.eq('payment_status', filters.status)
      if (filters.method) q = q.eq('payment_method', filters.method)
      if (filters.device) q = q.eq('device_id', filters.device)
      if (filters.from)   q = q.gte('created_at', new Date(`${filters.from}T00:00:00`).toISOString())
      if (filters.to)     q = q.lte('created_at', new Date(`${filters.to}T23:59:59.999`).toISOString())
      if (filters.search) q = q.ilike('transaction_code', `%${filters.search}%`)

      const { data, error } = await q
      if (error) throw error

      const head = ['Kode Transaksi', 'Client', 'Perangkat', 'Metode', 'Status', 'Jumlah', 'Harga Asli', 'Dibuat', 'Dibayar']
      const esc  = (v: any) => {
        const s = v === null || v === undefined ? '' : String(v)
        return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
      }
      const rows = (data ?? []).map((r: any) => {
        const dev = Array.isArray(r.devices) ? r.devices[0] : r.devices
        const cli = Array.isArray(r.clients) ? r.clients[0] : r.clients
        return [
          r.transaction_code, cli?.name ?? '', dev?.device_name ?? '',
          r.payment_method, r.payment_status, r.amount, r.original_amount ?? '',
          r.created_at, r.paid_at ?? '',
        ].map(esc).join(';')
      })

      // BOM + pemisah titik koma supaya Excel lokal membaca kolomnya dengan benar.
      const csv  = '﻿' + [head.map(esc).join(';'), ...rows].join('\r\n')
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const a    = document.createElement('a')
      a.href     = URL.createObjectURL(blob)
      a.download = `transaksi_${ymd(new Date())}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      setToast({ kind: 'ok', text: `${rows.length} baris diekspor.` })
    } catch (e: any) {
      setToast({ kind: 'err', text: `Export gagal: ${e.message}` })
    } finally {
      setExporting(false)
    }
  }

  const statCards = [
    { label: 'Pendapatan', value: rupiah(stats.revenue), icon: TrendingUp,
      bg: 'linear-gradient(160deg,#0A7A5A 0%,#059669 55%,#047857 100%)', glow: 'rgba(5,120,85,0.25)' },
    { label: 'Lunas', value: String(stats.paid), icon: CheckCircle2,
      bg: 'linear-gradient(160deg,#1050A0 0%,#1D6FB5 55%,#1558A0 100%)', glow: 'rgba(20,80,165,0.25)' },
    { label: 'Menunggu', value: String(stats.pending), icon: Clock,
      bg: 'linear-gradient(160deg,#B45309 0%,#D97706 55%,#B45309 100%)', glow: 'rgba(180,85,0,0.25)' },
    { label: 'Kedaluwarsa', value: String(stats.expired), icon: XCircle,
      bg: 'linear-gradient(160deg,#6B5750 0%,#7A6259 55%,#5C4A44 100%)', glow: 'rgba(90,70,64,0.22)' },
    { label: 'Total Transaksi', value: String(stats.total), icon: Receipt,
      bg: 'linear-gradient(160deg,#E83530 0%,#D42B22 55%,#C02018 100%)', glow: 'rgba(180,30,20,0.28)' },
  ]

  return (
    <>
      <style>{`
        @keyframes fade-up { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        .page-header { animation:fade-up .45s ease both }
        .stats-row   { animation:fade-up .45s ease .06s both }
        .toolbar-row { animation:fade-up .45s ease .12s both }
        .table-section { animation:fade-up .45s ease .18s both }
        .pager-row   { animation:fade-up .45s ease .24s both }
        .stat-card { transition:transform .25s cubic-bezier(.34,1.56,.64,1) }
        .stat-card:hover { transform:translateY(-4px) }

        .tx-stats { display:grid; gap:14px; margin-bottom:24px; grid-template-columns:repeat(5,minmax(0,1fr)); }
        @media (max-width:1250px){ .tx-stats { grid-template-columns:repeat(3,minmax(0,1fr)) } }
        @media (max-width:760px) { .tx-stats { grid-template-columns:repeat(2,minmax(0,1fr)); gap:10px } }
        @media (max-width:430px) { .tx-stats { grid-template-columns:minmax(0,1fr) } }
        .tx-stat-value { font-size:clamp(18px,1.7vw + 7px,24px); overflow-wrap:anywhere }

        .btn-icon { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; cursor:pointer; transition:all .2s; border:1px solid transparent; font-family:'Poppins',sans-serif; }
        .btn-icon:hover:not(:disabled) { filter:brightness(1.06); transform:translateY(-1px) }
        .btn-icon:disabled { opacity:.55; cursor:default }
        .page-btn { width:34px; height:34px; border-radius:8px; display:flex; align-items:center; justify-content:center; border:1px solid rgba(212,43,34,0.07); background:rgba(212,43,34,0.04); color:#7A6259; cursor:pointer; transition:all .15s; font-size:13px; font-weight:600; font-family:'Poppins',sans-serif; }
        .page-btn:hover:not(:disabled) { background:rgba(212,43,34,.15); border-color:rgba(212,43,34,.3); color:#E83530 }
        .page-btn.active { background:linear-gradient(135deg,#E83530,#C02018); border-color:transparent; color:#fff }
        .page-btn:disabled { opacity:.3; cursor:default }
        .input-field { background:rgba(212,43,34,0.055); border:1px solid rgba(212,43,34,0.07); border-radius:10px; color:#150C09; font-size:13px; padding:8px 12px 8px 36px; outline:none; transition:all .2s; font-family:'Poppins',sans-serif; width:100%; }
        .input-field::placeholder { color:#9E8880 }
        .input-field:focus { border-color:rgba(212,43,34,.4); background:rgba(212,43,34,0.07); box-shadow:0 0 0 3px rgba(212,43,34,.1) }
        .select-field, .date-field { background:rgba(212,43,34,0.055); border:1px solid rgba(212,43,34,0.07); border-radius:10px; color:#4A2E22; font-size:13px; padding:8px 12px; outline:none; cursor:pointer; font-family:'Poppins',sans-serif; }
        .select-field:focus, .date-field:focus { border-color:rgba(212,43,34,.4) }
        option { background:#fff; color:#150C09 }
        .chip { padding:7px 14px; border-radius:100px; font-size:12px; font-weight:700; cursor:pointer; border:1px solid rgba(212,43,34,0.10); background:rgba(212,43,34,0.04); color:#7A6259; transition:all .18s; font-family:'Poppins',sans-serif; }
        .chip:hover { border-color:rgba(212,43,34,.28); color:#D42B22 }
        .chip.active { background:linear-gradient(135deg,#E83530,#C02018); border-color:transparent; color:#fff }
        .link-btn { display:inline-flex; align-items:center; gap:5px; padding:5px 10px; border-radius:8px; font-size:11px; font-weight:700; cursor:pointer; border:1px solid rgba(212,43,34,0.14); background:rgba(212,43,34,0.05); color:#D42B22; text-decoration:none; font-family:'Poppins',sans-serif; transition:all .18s; }
        .link-btn:hover:not(:disabled) { background:rgba(212,43,34,0.11); border-color:rgba(212,43,34,.3) }
        .link-btn:disabled { opacity:.5; cursor:default }
        @keyframes spin { to { transform:rotate(360deg) } }
        .spin { animation:spin .9s linear infinite }

        @media (max-width:700px) {
          .toolbar-row > * { flex:1 1 100% !important; min-width:0 !important }
          .toolbar-row .select-field, .toolbar-row .date-field { width:100% }
        }
      `}</style>

      <div style={{ fontFamily: "'Poppins',sans-serif" }}>

        {/* HEADER */}
        <div className="page-header" style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
            <p style={{ color: '#D42B22', fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase' }}>
              {isSuperAdmin ? 'Super Admin' : 'Admin'} · Transaksi
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ color: '#150C09', fontSize: 30, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 4 }}>Transaksi</h1>
              <p style={{ color: '#9E8880', fontSize: 14 }}>
                {filteredCount.toLocaleString('id-ID')} transaksi
                {activeFilterCount > 0 ? ' sesuai filter' : ' tercatat'}
              </p>
            </div>
            <button className="btn-icon" onClick={exportCsv} disabled={exporting || filteredCount === 0}
              style={{ background: 'linear-gradient(135deg,#E83530,#C02018)', color: '#fff', boxShadow: '0 4px 16px rgba(212,43,34,.28)' }}>
              {exporting
                ? <><RefreshCw size={14} className="spin" />Menyiapkan…</>
                : <><Download size={14} />Export CSV</>}
            </button>
          </div>
        </div>

        {/* STATS */}
        <div className="stats-row tx-stats">
          {statCards.map(({ label, value, icon: Icon, bg, glow }) => (
            <div key={label} className="stat-card" style={{
              padding: 20, borderRadius: 20, position: 'relative', overflow: 'hidden', background: bg,
              boxShadow: `inset 0 2px 3px rgba(255,255,255,0.18), 0 8px 24px ${glow}, 0 16px 40px rgba(0,0,0,0.04)`,
            }}>
              <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)' }} />
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>{label}</p>
                <div style={{ width: 32, height: 32, borderRadius: 10, flexShrink: 0, background: 'rgba(255,255,255,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Icon size={15} color="#fff" />
                </div>
              </div>
              <p className="tx-stat-value" style={{ color: '#fff', fontWeight: 900, lineHeight: 1, letterSpacing: '-0.03em' }}>{value}</p>
            </div>
          ))}
        </div>

        {/* TOOLBAR */}
        <div className="toolbar-row glass-card" style={{ padding: '14px 16px', marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '2 1 220px', minWidth: 180 }}>
            <Search size={14} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: '#9E8880', pointerEvents: 'none' }} />
            <input
              className="input-field"
              placeholder="Cari kode transaksi…"
              value={localSearch}
              onChange={e => setLocalSearch(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') pushFilter({ search: localSearch }) }}
            />
            {localSearch && (
              <button onClick={() => { setLocalSearch(''); pushFilter({ search: '' }) }}
                style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#9E8880', cursor: 'pointer', display: 'flex' }}>
                <X size={14} />
              </button>
            )}
          </div>

          <select className="select-field" value={filters.status} onChange={e => pushFilter({ status: e.target.value })}>
            {STATUS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select className="select-field" value={filters.method} onChange={e => pushFilter({ method: e.target.value })}>
            {METHOD_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>

          <select className="select-field" value={filters.device} onChange={e => pushFilter({ device: e.target.value })}>
            <option value="">Semua perangkat</option>
            {devices.map(d => <option key={d.id} value={d.id}>{d.device_name}</option>)}
          </select>

          {isSuperAdmin && (
            <select className="select-field" value={filters.client} onChange={e => pushFilter({ client: e.target.value })}>
              <option value="">Semua client</option>
              {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          )}

          {activeFilterCount > 0 && (
            <button className="btn-icon" onClick={resetFilters}
              style={{ background: 'rgba(180,30,20,0.08)', color: '#B82018', border: '1px solid rgba(180,30,20,0.18)' }}>
              <FilterX size={14} />Reset
            </button>
          )}
        </div>

        {/* RENTANG WAKTU */}
        <div className="toolbar-row glass-card" style={{ padding: '12px 16px', marginBottom: 20, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ color: '#9E8880', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px', textTransform: 'uppercase' }}>Periode</span>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { key: '1',   label: 'Hari ini', days: 1 },
              { key: '7',   label: '7 hari',   days: 7 },
              { key: '30',  label: '30 hari',  days: 30 },
              { key: 'all', label: 'Semua',    days: null },
            ].map(r => (
              <button key={r.key} className={`chip ${activeQuick === r.key ? 'active' : ''}`}
                onClick={() => quickRange(r.days)}>{r.label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginLeft: 'auto', flexWrap: 'wrap' }}>
            <input type="date" className="date-field" value={filters.from} max={filters.to || undefined}
              onChange={e => pushFilter({ from: e.target.value })} />
            <span style={{ color: '#9E8880', fontSize: 12 }}>s/d</span>
            <input type="date" className="date-field" value={filters.to} min={filters.from || undefined}
              onChange={e => pushFilter({ to: e.target.value })} />
          </div>
        </div>

        {toast && (
          <div style={{
            marginBottom: 16, padding: '11px 14px', borderRadius: 12, fontSize: 13, fontWeight: 600,
            background: toast.kind === 'ok' ? 'rgba(5,150,105,0.08)' : 'rgba(180,30,20,0.08)',
            border: `1px solid ${toast.kind === 'ok' ? 'rgba(5,150,105,0.2)' : 'rgba(180,30,20,0.2)'}`,
            color: toast.kind === 'ok' ? '#059669' : '#B82018',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
          }}>
            <span>{toast.text}</span>
            <button onClick={() => setToast(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', display: 'flex' }}><X size={14} /></button>
          </div>
        )}

        {/* TABEL */}
        <div className="table-section glass-card" style={{ overflow: 'hidden', opacity: isPending ? 0.6 : 1, transition: 'opacity .18s' }}>
          <div className="pk-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: isSuperAdmin ? 980 : 880 }}>
              <thead>
                <tr style={{ borderBottom: '1px solid rgba(212,43,34,0.07)' }}>
                  {['Kode Transaksi', ...(isSuperAdmin ? ['Client'] : []), 'Perangkat', 'Metode', 'Status', 'Jumlah', 'Dibuat', 'Dibayar', ''].map((h, i) => (
                    <th key={`${h}-${i}`} style={{
                      padding: '12px 20px', textAlign: 'left', color: '#C0AFA9', fontSize: 10,
                      fontWeight: 800, letterSpacing: '1.5px', textTransform: 'uppercase',
                      whiteSpace: 'nowrap', background: 'rgba(212,43,34,0.02)',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sessions.map(s => {
                  const cfg = STATUS_STYLE[s.payment_status] ?? STATUS_STYLE.failed
                  const diskon = s.original_amount != null && Number(s.original_amount) > Number(s.amount)
                  return (
                    <tr key={s.id} className="table-row" style={{ borderBottom: '1px solid rgba(212,43,34,0.05)', transition: 'background .15s' }}>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span title={s.transaction_code} style={{
                          color: '#7A6259', fontSize: 12, fontWeight: 600, fontFamily: 'monospace',
                          background: 'rgba(212,43,34,0.05)', border: '1px solid rgba(212,43,34,0.10)',
                          borderRadius: 8, padding: '3px 10px',
                        }}>{s.transaction_code}</span>
                      </td>
                      {isSuperAdmin && (
                        <td style={{ padding: '14px 20px', color: '#4A2E22', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {s.clients?.name ?? '—'}
                        </td>
                      )}
                      <td style={{ padding: '14px 20px', color: '#4A2E22', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}>
                        {s.devices?.device_name ?? '—'}
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          background: 'rgba(212,43,34,0.07)', color: '#7A6259', border: '1px solid rgba(212,43,34,0.14)',
                          borderRadius: 8, padding: '4px 12px', fontSize: 12, fontWeight: 700, textTransform: 'uppercase',
                        }}>{s.payment_method}</span>
                      </td>
                      <td style={{ padding: '14px 20px' }}>
                        <span style={{
                          background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}`,
                          borderRadius: 100, padding: '4px 12px', fontSize: 11, fontWeight: 800,
                          whiteSpace: 'nowrap', textTransform: 'capitalize',
                        }}>{s.payment_status}</span>
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <span style={{ color: '#150C09', fontSize: 14, fontWeight: 800 }}>{rupiah(s.amount)}</span>
                        {diskon && (
                          <span style={{ color: '#C0AFA9', fontSize: 11, textDecoration: 'line-through', marginLeft: 6 }}>
                            {rupiah(Number(s.original_amount))}
                          </span>
                        )}
                      </td>
                      <td style={{ padding: '14px 20px', color: '#9E8880', fontSize: 12, whiteSpace: 'nowrap' }}>{fmt(s.created_at)}</td>
                      <td style={{ padding: '14px 20px', fontSize: 12, whiteSpace: 'nowrap', color: s.paid_at ? '#4A2E22' : '#C0AFA9' }}>
                        {fmt(s.paid_at)}
                      </td>
                      <td style={{ padding: '14px 20px', whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
                          {s.payment_status === 'pending' && (
                            <button className="link-btn" disabled={rechecking === s.id} onClick={() => recheck(s)} title="Tanyakan ulang status ke DOKU">
                              <RefreshCw size={11} className={rechecking === s.id ? 'spin' : ''} />
                              {rechecking === s.id ? 'Cek…' : 'Cek DOKU'}
                            </button>
                          )}
                          {s.result_url && (
                            <a className="link-btn" href={`/download/${s.transaction_code}`} target="_blank" rel="noopener noreferrer" title="Buka halaman hasil">
                              <ExternalLink size={11} />Hasil
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {!sessions.length && (
                  <tr>
                    <td colSpan={isSuperAdmin ? 9 : 8} style={{ padding: '56px 20px', textAlign: 'center' }}>
                      <div style={{
                        width: 52, height: 52, borderRadius: 15, margin: '0 auto 14px',
                        background: 'rgba(212,43,34,0.07)', border: '1px solid rgba(212,43,34,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#D42B22',
                      }}>
                        <Receipt size={22} />
                      </div>
                      <p style={{ color: '#4A2E22', fontSize: 14, fontWeight: 700, marginBottom: 4 }}>
                        {activeFilterCount > 0 ? 'Tidak ada transaksi yang cocok' : 'Belum ada transaksi'}
                      </p>
                      <p style={{ color: '#9E8880', fontSize: 13 }}>
                        {activeFilterCount > 0 ? 'Coba longgarkan filter atau perluas periodenya.' : 'Transaksi akan muncul di sini setelah sesi pertama berjalan.'}
                      </p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="table-scroll-hint">← geser untuk melihat kolom lainnya</p>
        </div>

        {/* PAGINATION */}
        {totalPages > 1 && (
          <div className="pager-row" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 24 }}>
            <button className="page-btn" disabled={currentPage <= 1} onClick={() => goPage(currentPage - 1)}><ChevronLeft size={14} /></button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 2)
              .reduce<(number | '...')[]>((acc, p, i, arr) => {
                if (i > 0 && p - (arr[i - 1] as number) > 1) acc.push('...')
                acc.push(p); return acc
              }, [])
              .map((p, i) => p === '...'
                ? <span key={`d${i}`} style={{ color: '#C0AFA9', fontSize: 12, padding: '0 4px' }}>…</span>
                : <button key={p} className={`page-btn ${p === currentPage ? 'active' : ''}`} onClick={() => goPage(p as number)}>{p}</button>
              )}
            <button className="page-btn" disabled={currentPage >= totalPages} onClick={() => goPage(currentPage + 1)}><ChevronRight size={14} /></button>
            <span style={{ color: '#C0AFA9', fontSize: 12, marginLeft: 8 }}>Hal. {currentPage} / {totalPages}</span>
          </div>
        )}
      </div>
    </>
  )
}
