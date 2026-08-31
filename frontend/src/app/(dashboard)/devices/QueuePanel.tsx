'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase'
import { Check, Copy, Loader2, Users } from 'lucide-react'

// ============================================================
// PANEL ANTREAN PELANGGAN
//
// Menyalakan dan mematikan antrean adalah keputusan pemilik, bukan keputusan
// orang yang sedang berdiri melayani pengunjung. Karena itu sakelarnya di sini
// dan TIDAK ada di panel operator. Panel operator hanya menjalankan antrean
// yang sudah dinyalakan: memanggil, melewati, menerbitkan nomor manual.
//
// ATURAN YANG DITEGAKKAN DI SINI: menekan "matikan" saat masih ada orang
// memegang nomor tidak akan mematikannya, melainkan menurunkannya ke
// 'closing': pendaftaran baru ditutup, sisa antrean tetap dilayani, lalu
// mati sendiri saat bersih. Aturan yang sama ada di backend; dasbor menulis
// langsung ke Supabase (mengikuti pola DevicesManager) sehingga aturannya
// harus ikut ditegakkan di sini, bukan diasumsikan.
// ============================================================

export type QueueStateRow = {
  device_id: string
  queue_slug: string
  mode: 'off' | 'on' | 'closing'
  operator_pin: string | null
  notify_lead: number
  max_queue_length: number
}

export type DeviceLite = {
  id: string
  device_name: string | null
  clients: { id: string; name: string } | null
}

const C = {
  text: '#150C09',
  muted: 'rgba(92,70,61,0.92)',
  faint: 'rgba(139,114,105,0.95)',
  line: 'rgba(21,12,9,0.07)',
  red: '#D42B22',
}

const LABEL: Record<QueueStateRow['mode'], string> = {
  on: 'Aktif',
  closing: 'Pendaftaran ditutup',
  off: 'Mati',
}

function tanggalJakarta() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' })
}

export default function QueuePanel({
  devices,
  initial,
}: {
  devices: DeviceLite[]
  initial: QueueStateRow[]
}) {
  const supabase = createClient()
  const [rows, setRows] = useState<QueueStateRow[]>(initial)
  const [loading, setLoading] = useState<string | null>(null)
  const [note, setNote] = useState<Record<string, string>>({})
  const [copied, setCopied] = useState<string | null>(null)

  const byDevice = new Map(rows.map((r) => [r.device_id, r]))
  const daftar = devices.filter((d) => byDevice.has(d.id))

  async function ubahMode(row: QueueStateRow, diminta: 'on' | 'off') {
    setLoading(row.device_id)
    setNote((n) => ({ ...n, [row.device_id]: '' }))
    try {
      let mode: QueueStateRow['mode'] = diminta

      if (diminta === 'off') {
        const { count } = await supabase
          .from('queue_tickets')
          .select('id', { count: 'exact', head: true })
          .eq('device_id', row.device_id)
          .eq('queue_date', tanggalJakarta())
          .in('status', ['waiting', 'called', 'serving'])

        if ((count ?? 0) > 0) {
          mode = 'closing'
          setNote((n) => ({
            ...n,
            [row.device_id]: `Masih ada ${count} orang mengantre. Pendaftaran ditutup, sisanya tetap dilayani lalu mati sendiri.`,
          }))
        }
      }

      const { error } = await supabase
        .from('device_queue_state')
        .update({ mode, updated_at: new Date().toISOString() })
        .eq('device_id', row.device_id)

      if (error) {
        setNote((n) => ({ ...n, [row.device_id]: 'Gagal menyimpan. Coba lagi.' }))
        return
      }
      setRows((prev) => prev.map((r) => (r.device_id === row.device_id ? { ...r, mode } : r)))
    } finally {
      setLoading(null)
    }
  }

  async function salin(teks: string, kunci: string) {
    try {
      await navigator.clipboard.writeText(teks)
      setCopied(kunci)
      setTimeout(() => setCopied((c) => (c === kunci ? null : c)), 1600)
    } catch {
      /* clipboard bisa ditolak; tautannya tetap terlihat untuk disalin manual */
    }
  }

  if (daftar.length === 0) return null

  return (
    <section className="pk-card" style={{ padding: '24px', marginBottom: '24px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
        <Users size={18} strokeWidth={1.8} color={C.red} />
        <h2 style={{ fontSize: 16, fontWeight: 700, color: C.text }}>Antrean pelanggan</h2>
      </div>
      <p style={{ fontSize: 12.5, color: C.faint, lineHeight: 1.55, marginBottom: 20, maxWidth: '62ch' }}>
        Nyalakan hanya saat booth ramai. Selama mati, pengunjung yang memindai QR diminta
        langsung datang, dan kios menampilkan tombol mulai seperti biasa.
      </p>

      <div style={{ display: 'grid', gap: 14 }}>
        {daftar.map((d) => {
          const row = byDevice.get(d.id)!
          const hidup = row.mode !== 'off'
          const urlAntri = `https://www.pabrikenangan.my.id/antri/${row.queue_slug}`
          const urlOperator = `${urlAntri}/operator`

          return (
            <div key={d.id} style={{ border: `1px solid ${C.line}`, borderRadius: 16, padding: 18 }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 220px', minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, color: C.text }}>
                    {d.device_name || 'Unnamed Device'}
                  </p>
                  <p style={{ fontSize: 12, color: C.faint, marginTop: 2 }}>
                    {d.clients?.name ?? 'Tanpa klien'}
                  </p>

                  <p style={{
                    display: 'inline-block', marginTop: 10, fontSize: 11.5, fontWeight: 700,
                    padding: '5px 11px', borderRadius: 999,
                    color: hidup ? C.red : C.faint,
                    background: hidup ? 'rgba(212,43,34,0.08)' : 'rgba(21,12,9,0.05)',
                  }}>
                    {LABEL[row.mode]}
                  </p>
                </div>

                <button
                  onClick={() => ubahMode(row, hidup ? 'off' : 'on')}
                  disabled={loading === d.id}
                  style={{
                    border: hidup ? `1px solid ${C.line}` : 'none',
                    background: hidup ? '#fff' : C.red,
                    color: hidup ? C.text : '#fff',
                    fontFamily: 'inherit', fontSize: 14, fontWeight: 700,
                    padding: '13px 20px', borderRadius: 14, cursor: 'pointer',
                    opacity: loading === d.id ? 0.6 : 1, minWidth: 152,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  {loading === d.id && <Loader2 size={15} strokeWidth={2} />}
                  {hidup ? 'Matikan antrean' : 'Nyalakan antrean'}
                </button>
              </div>

              {note[d.id] && (
                <p style={{ fontSize: 12.5, color: C.muted, marginTop: 12, lineHeight: 1.55 }}>
                  {note[d.id]}
                </p>
              )}

              <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${C.line}`, display: 'grid', gap: 10 }}>
                {[
                  { label: 'QR standee', nilai: urlAntri, kunci: `${d.id}-a` },
                  { label: 'Panel operator', nilai: urlOperator, kunci: `${d.id}-o` },
                  { label: 'PIN operator', nilai: row.operator_pin ?? 'belum diatur', kunci: `${d.id}-p` },
                ].map((baris) => (
                  <div key={baris.kunci} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 12, color: C.faint, minWidth: 104 }}>{baris.label}</span>
                    <span style={{
                      flex: 1, fontSize: 12.5, color: C.muted, fontFamily: 'monospace',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {baris.nilai}
                    </span>
                    <button onClick={() => salin(baris.nilai, baris.kunci)} aria-label={`Salin ${baris.label}`}
                      style={{
                        border: `1px solid ${C.line}`, background: '#fff', borderRadius: 10,
                        width: 32, height: 32, display: 'flex', alignItems: 'center',
                        justifyContent: 'center', cursor: 'pointer', color: C.faint, flexShrink: 0,
                      }}>
                      {copied === baris.kunci
                        ? <Check size={14} strokeWidth={2.2} color={C.red} />
                        : <Copy size={14} strokeWidth={1.8} />}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
