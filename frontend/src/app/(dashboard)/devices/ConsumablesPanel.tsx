'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import {
  Printer, Droplets, Layers, AlertTriangle, Loader2, X, Check, Gauge,
} from 'lucide-react'

// ============================================================
// PANEL BAHAN HABIS PAKAI
//
// Level tinta TIDAK BISA dibaca dari printer. Tangki EcoTank tidak berchip,
// jadi EPSON L3210 sendiri tidak punya sensor level tinta. Yang ditampilkan
// di sini adalah AKUMULASI PEMAKAIAN yang dihitung aplikasi photobooth dari
// liputan CMYK piksel yang benar-benar dicetak.
//
// Karena itu UI di bawah sengaja TIDAK pernah menulis "sisa tinta 40%"
// sebelum kapasitasnya dikalibrasi — mengarang angka sisa dari data yang
// tidak mengukur apa pun justru membuat operator percaya pada angka palsu
// dan kehabisan tinta di tengah acara. Sebelum kalibrasi, yang ditampilkan
// adalah pemakaian mentah apa adanya.
// ============================================================

export type Consumable = {
  device_id: string
  paper_loaded: number
  paper_remaining: number
  paper_low_threshold: number
  paper_last_loaded_at: string | null
  ink_c: number
  ink_m: number
  ink_y: number
  ink_k: number
  ink_page_capacity: number
  ink_low_threshold: number
  ink_last_refill_at: string | null
  printer_status: string | null
  printer_blocked: boolean
  printer_reason: string | null
  queued_jobs: number
  printer_checked_at: string | null
  total_sheets_printed: number
  updated_at: string
}

export type DeviceLite = {
  id: string
  device_name: string | null
  clients: { id: string; name: string } | null
}

const C = {
  text: '#150C09',
  muted: 'rgba(122,98,89,0.88)',
  faint: 'rgba(158,136,128,0.95)',
  line: 'rgba(212,43,34,0.07)',
  panel: 'rgba(212,43,34,0.05)',
  red: '#E83530',
  danger: '#B82018',
  warn: '#D97706',
  ok: '#059669',
}

const INK_META: Record<string, { label: string; color: string }> = {
  c: { label: 'Cyan',    color: '#00A0B0' },
  m: { label: 'Magenta', color: '#D6337F' },
  y: { label: 'Yellow',  color: '#E0A800' },
  k: { label: 'Black',   color: '#3A2C27' },
}

function fmtDate(v: string | null) {
  if (!v) return '—'
  return new Date(v).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

function Bar({ pct, color, muted }: { pct: number; color: string; muted?: boolean }) {
  return (
    <div style={{ height: 8, borderRadius: 999, background: 'rgba(21,12,9,0.07)', overflow: 'hidden' }}>
      <div style={{
        width: `${Math.max(0, Math.min(100, pct))}%`,
        height: '100%',
        borderRadius: 999,
        background: muted ? 'rgba(21,12,9,0.18)' : color,
        transition: 'width 0.35s ease',
      }} />
    </div>
  )
}

export default function ConsumablesPanel({
  devices, initial,
}: {
  devices: DeviceLite[]
  initial: Consumable[]
}) {
  const [rows, setRows] = useState<Consumable[]>(initial)
  const [modal, setModal] = useState<null | {
    kind: 'paper' | 'ink' | 'calibrate'
    device: DeviceLite
    row: Consumable
  }>(null)
  const [value, setValue] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const supabase = createClient()

  const byDevice = (id: string) => rows.find(r => r.device_id === id)

  const openModal = (kind: 'paper' | 'ink' | 'calibrate', device: DeviceLite, row: Consumable) => {
    setModal({ kind, device, row })
    setErr('')
    setValue(
      kind === 'paper' ? String(row.paper_loaded || 100)
        : kind === 'calibrate' ? String(row.ink_page_capacity || '')
        : ''
    )
  }

  const submit = async () => {
    if (!modal) return
    setBusy(true); setErr('')
    const { kind, row } = modal
    const now = new Date().toISOString()

    // Sengaja Record, bukan Partial<Consumable>: patch ini juga menulis kolom
    // penanda notifikasi (paper_alerted_at / ink_alerted_at) yang tidak
    // dipakai UI sehingga tidak ada di tipe Consumable.
    let patch: Record<string, unknown> = {}
    let event: { kind: string; amount: number | null; note?: string } | null = null

    if (kind === 'paper') {
      const n = parseInt(value, 10)
      if (!Number.isFinite(n) || n <= 0) { setErr('Jumlah lembar harus angka lebih dari 0.'); setBusy(false); return }
      patch = {
        paper_loaded: n,
        paper_remaining: n,
        paper_last_loaded_at: now,
        // Reset penanda notifikasi, kalau tidak peringatan berikutnya
        // tertahan cooldown 6 jam padahal stoknya sudah kejadian baru.
        paper_alerted_at: null,
      }
      event = { kind: 'paper_load', amount: n }

    } else if (kind === 'ink') {
      // Akumulasi sebelum di-reset dicatat ke riwayat: itulah bahan mentah
      // untuk mengkalibrasi kapasitas nanti ("ternyata tinta habis setelah
      // sekian halaman-penuh").
      const terpakai = Math.max(row.ink_c, row.ink_m, row.ink_y, row.ink_k)
      patch = {
        ink_c: 0, ink_m: 0, ink_y: 0, ink_k: 0,
        ink_last_refill_at: now,
        ink_alerted_at: null,
      }
      event = { kind: 'ink_refill', amount: terpakai, note: 'Reset akumulasi setelah isi ulang' }

    } else {
      const n = parseFloat(value)
      if (!Number.isFinite(n) || n <= 0) { setErr('Kapasitas harus angka lebih dari 0.'); setBusy(false); return }
      patch = { ink_page_capacity: n }
      event = { kind: 'ink_calibrate', amount: n }
    }

    const { error } = await supabase
      .from('device_consumables')
      .update({ ...patch, updated_at: now })
      .eq('device_id', row.device_id)

    if (error) { setErr(error.message); setBusy(false); return }

    if (event) {
      await supabase.from('consumable_events').insert({
        device_id: row.device_id,
        kind: event.kind,
        amount: event.amount,
        note: event.note ?? null,
      })
    }

    setRows(prev => prev.map(r =>
      r.device_id === row.device_id ? { ...r, ...patch, updated_at: now } as Consumable : r
    ))
    setBusy(false)
    setModal(null)
  }

  const inputStyle = {
    width: '100%', boxSizing: 'border-box' as const,
    background: 'rgba(212,43,34,0.05)',
    border: '1.5px solid rgba(212,43,34,0.08)',
    borderRadius: 12, padding: '12px 16px',
    color: C.text, fontSize: 14, outline: 'none',
    fontFamily: "'Poppins',sans-serif",
  }

  const btn = (bg: string) => ({
    display: 'flex', alignItems: 'center', gap: 7,
    background: bg, border: 'none', borderRadius: 10,
    padding: '9px 14px', color: '#fff', fontSize: 12.5, fontWeight: 600,
    cursor: 'pointer', fontFamily: "'Poppins',sans-serif",
  })

  return (
    <>
      <div className="page-anim" style={{
        background: C.panel, backdropFilter: 'blur(24px)',
        border: `1px solid ${C.line}`, borderRadius: 20,
        overflow: 'hidden', marginBottom: 28, animationDelay: '0.03s',
        fontFamily: "'Poppins',sans-serif",
      }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid rgba(212,43,34,0.055)', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 32, height: 32, borderRadius: 10, background: 'rgba(212,43,34,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Layers size={16} color={C.red} />
          </div>
          <div>
            <h2 style={{ color: C.text, fontSize: 15, fontWeight: 600 }}>Kertas &amp; Tinta</h2>
            <p style={{ color: C.faint, fontSize: 11.5 }}>
              Tinta dihitung dari liputan cetak — printer EcoTank tidak punya sensor level tinta
            </p>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(320px,1fr))', gap: 16, padding: 20 }}>
          {devices.map(device => {
            const row = byDevice(device.id)
            if (!row) return null

            const paperPct = row.paper_loaded > 0
              ? (row.paper_remaining / row.paper_loaded) * 100 : 0
            const paperLow = row.paper_loaded > 0 && row.paper_remaining <= row.paper_low_threshold
            const paperColor = row.paper_remaining === 0 ? C.danger : paperLow ? C.warn : C.ok

            const calibrated = row.ink_page_capacity > 0
            const inkMax = Math.max(row.ink_c, row.ink_m, row.ink_y, row.ink_k)

            return (
              <div key={device.id} style={{
                background: '#fff', border: `1px solid ${C.line}`,
                borderRadius: 16, padding: 18,
              }}>
                {/* Judul + status printer */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 16 }}>
                  <div style={{ minWidth: 0 }}>
                    <p style={{ color: C.text, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {device.device_name || 'Unnamed Device'}
                    </p>
                    <p style={{ color: C.faint, fontSize: 11 }}>{device.clients?.name ?? '—'}</p>
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    padding: '4px 9px', borderRadius: 999, fontSize: 11, fontWeight: 600,
                    background: row.printer_blocked ? 'rgba(239,68,68,0.1)' : 'rgba(16,185,129,0.1)',
                    color: row.printer_blocked ? C.danger : C.ok,
                    border: `1px solid ${row.printer_blocked ? 'rgba(239,68,68,0.2)' : 'rgba(16,185,129,0.2)'}`,
                    whiteSpace: 'nowrap',
                  }}>
                    <Printer size={12} />
                    {row.printer_status || 'Belum ada data'}
                  </span>
                </div>

                {row.printer_blocked && row.printer_reason && (
                  <div style={{
                    display: 'flex', gap: 8, alignItems: 'flex-start',
                    background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.15)',
                    borderRadius: 10, padding: '9px 11px', marginBottom: 14,
                  }}>
                    <AlertTriangle size={14} color={C.danger} style={{ flexShrink: 0, marginTop: 1 }} />
                    <p style={{ color: C.danger, fontSize: 11.5, lineHeight: 1.45 }}>
                      {row.printer_reason}
                      {row.queued_jobs > 0 && ` — ${row.queued_jobs} job mengantre`}
                    </p>
                  </div>
                )}

                {/* KERTAS */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 7 }}>
                    <span style={{ color: C.muted, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>Kertas</span>
                    <span style={{ color: paperColor, fontSize: 15, fontWeight: 700 }}>
                      {row.paper_remaining}
                      <span style={{ color: C.faint, fontSize: 11.5, fontWeight: 500 }}> / {row.paper_loaded || '—'} lembar</span>
                    </span>
                  </div>
                  <Bar pct={paperPct} color={paperColor} muted={row.paper_loaded === 0} />
                  <p style={{ color: C.faint, fontSize: 10.5, marginTop: 6 }}>
                    {row.paper_loaded === 0
                      ? 'Belum pernah diisi — tekan "Isi Kertas" setelah memuat kertas'
                      : `Diisi ${fmtDate(row.paper_last_loaded_at)} · ambang ${row.paper_low_threshold}`}
                  </p>
                </div>

                {/* TINTA */}
                <div style={{ marginBottom: 16 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
                    <span style={{ color: C.muted, fontSize: 11.5, fontWeight: 600, letterSpacing: 0.6, textTransform: 'uppercase' }}>Tinta (estimasi)</span>
                    <span style={{ color: C.faint, fontSize: 11 }}>
                      {calibrated
                        ? `${Math.round((inkMax / row.ink_page_capacity) * 100)}% terpakai`
                        : `${inkMax.toFixed(1)} halaman-penuh`}
                    </span>
                  </div>

                  {(['c', 'm', 'y', 'k'] as const).map(ch => {
                    const val = row[`ink_${ch}` as keyof Consumable] as number
                    const pct = calibrated ? (val / row.ink_page_capacity) * 100 : 0
                    return (
                      <div key={ch} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                        <span style={{ width: 12, color: INK_META[ch].color, fontSize: 11, fontWeight: 700 }}>
                          {ch.toUpperCase()}
                        </span>
                        <div style={{ flex: 1 }}>
                          <Bar pct={pct} color={INK_META[ch].color} muted={!calibrated} />
                        </div>
                        <span style={{ width: 46, textAlign: 'right', color: C.faint, fontSize: 10.5 }}>
                          {calibrated ? `${Math.round(pct)}%` : val.toFixed(1)}
                        </span>
                      </div>
                    )
                  })}

                  {!calibrated && (
                    <p style={{ color: C.warn, fontSize: 10.5, marginTop: 7, lineHeight: 1.45 }}>
                      Belum dikalibrasi — yang tampil adalah pemakaian mentah, bukan sisa.
                      Setelah tinta habis sekali, catat angka di atas sebagai kapasitas.
                    </p>
                  )}
                </div>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, paddingTop: 13, borderTop: `1px solid ${C.line}` }}>
                  <button onClick={() => openModal('paper', device, row)} style={btn('linear-gradient(135deg,#E83530,#C02018)')}>
                    <Layers size={13} /> Isi Kertas
                  </button>
                  <button onClick={() => openModal('ink', device, row)} style={{ ...btn('rgba(21,12,9,0.06)'), color: C.text }}>
                    <Droplets size={13} /> Isi Tinta
                  </button>
                  <button onClick={() => openModal('calibrate', device, row)} style={{ ...btn('rgba(21,12,9,0.06)'), color: C.text }}>
                    <Gauge size={13} /> Kalibrasi
                  </button>
                </div>

                <p style={{ color: C.faint, fontSize: 10, marginTop: 11 }}>
                  Total {row.total_sheets_printed.toLocaleString('id-ID')} lembar · diperbarui {fmtDate(row.updated_at)}
                </p>
              </div>
            )
          })}
        </div>
      </div>

      {/* MODAL */}
      {modal && (
        <div className="modal-overlay" onClick={() => !busy && setModal(null)} style={{
          position: 'fixed', inset: 0, background: 'rgba(21,12,9,0.45)',
          backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
          justifyContent: 'center', zIndex: 90, padding: 20,
        }}>
          <div className="modal-card" onClick={e => e.stopPropagation()} style={{
            background: '#fff', borderRadius: 24, padding: '30px 28px',
            width: '100%', maxWidth: 420, fontFamily: "'Poppins',sans-serif",
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <h3 style={{ color: C.text, fontSize: 18, fontWeight: 700 }}>
                {modal.kind === 'paper' ? 'Isi Kertas'
                  : modal.kind === 'ink' ? 'Isi Ulang Tinta'
                  : 'Kalibrasi Kapasitas Tinta'}
              </h3>
              <button onClick={() => !busy && setModal(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 2 }}>
                <X size={18} color={C.faint} />
              </button>
            </div>
            <p style={{ color: C.muted, fontSize: 12.5, marginBottom: 18 }}>
              {modal.device.device_name || 'Unnamed Device'}
            </p>

            {modal.kind === 'ink' ? (
              <div style={{ background: 'rgba(212,43,34,0.05)', borderRadius: 12, padding: 14, marginBottom: 18 }}>
                <p style={{ color: C.text, fontSize: 12.5, lineHeight: 1.6 }}>
                  Akumulasi pemakaian akan di-<b>reset ke nol</b>, dan angka sekarang
                  (<b>{Math.max(modal.row.ink_c, modal.row.ink_m, modal.row.ink_y, modal.row.ink_k).toFixed(1)} halaman-penuh</b>)
                  dicatat ke riwayat.
                  {modal.row.ink_page_capacity === 0 &&
                    ' Kalau tinta memang baru saja benar-benar habis, pakai angka itu sebagai kapasitas di menu Kalibrasi.'}
                </p>
              </div>
            ) : (
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: 'block', color: C.muted, fontSize: 12, fontWeight: 600, marginBottom: 7 }}>
                  {modal.kind === 'paper' ? 'Jumlah lembar yang dimuat' : 'Kapasitas (halaman-penuh)'}
                </label>
                <input
                  type="number" value={value} onChange={e => setValue(e.target.value)}
                  placeholder={modal.kind === 'paper' ? '100' : 'mis. 45.5'}
                  style={inputStyle} autoFocus
                />
                <p style={{ color: C.faint, fontSize: 10.5, marginTop: 7, lineHeight: 1.5 }}>
                  {modal.kind === 'paper'
                    ? 'Sisa akan diset ke angka ini dan berkurang otomatis tiap cetakan berhasil.'
                    : 'Berapa "halaman-penuh" yang terpakai sampai tinta habis. Diketahui dari satu siklus isi ulang penuh — sebelum itu, biarkan kosong.'}
                </p>
              </div>
            )}

            {err && (
              <p style={{ color: C.danger, fontSize: 12, marginBottom: 14 }}>{err}</p>
            )}

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal(null)} disabled={busy} style={{
                flex: 1, background: 'rgba(21,12,9,0.06)', border: 'none', borderRadius: 12,
                padding: '12px', color: C.text, fontSize: 13, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer', fontFamily: "'Poppins',sans-serif",
              }}>Batal</button>
              <button onClick={submit} disabled={busy} style={{
                flex: 1, background: 'linear-gradient(135deg,#E83530,#C02018)', border: 'none',
                borderRadius: 12, padding: '12px', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: busy ? 'default' : 'pointer', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 7, fontFamily: "'Poppins',sans-serif",
              }}>
                {busy ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`.spin{animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </>
  )
}
