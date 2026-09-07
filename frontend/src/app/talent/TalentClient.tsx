'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Download, LogOut, Search, TrendingUp, CalendarDays, Activity, Users } from 'lucide-react'

/*
 * DASBOR TALENT POOL (dash.pabrikenangan.my.id)
 *
 * Design read: alat kerja internal, dibuka sambil mencari orang untuk acara
 * lusa. Yang menentukan gunanya adalah seberapa cepat satu nama ditemukan dan
 * di-chat, bukan komposisi. VARIANCE 3 / MOTION 2 / DENSITY 4.
 *
 * Mengikuti sistem dasbor app: latar #FAF7F5, kartu clay bergradien untuk
 * statistik, glass-card putih radius 20 untuk tabel, aksen merah merek,
 * Poppins. Perbedaannya cuma satu dan disengaja: dasbor ini tidak punya
 * sidebar, karena isinya memang satu halaman saja.
 *
 * Semua penyaringan dikerjakan di klien. Talent pool ini berukuran puluhan
 * sampai ratusan baris; mengirim ulang permintaan ke server tiap ketikan
 * hanya menambah jeda tanpa menambah apa pun.
 */

type Pelamar = {
  id: string
  full_name: string
  phone: string
  social: string | null
  status: string
  created_at: string
}

const C = {
  aksen: '#D42B22',
  teks: '#150C09',
  teks2: '#4A2E22',
  teks3: '#7A6259',
  teks4: '#9E8880',
  ground: '#FAF7F5',
  papan: '#FFFFFF',
  garis: 'rgba(21,12,9,0.10)',
  garisTipis: 'rgba(21,12,9,0.06)',
}

// Empat status, empat warna. Urutannya = urutan hidup seorang pelamar, dan
// itu juga urutan tombol saringan di atas tabel.
const STATUS: { nilai: string; label: string; warna: string; latar: string }[] = [
  { nilai: 'baru',        label: 'Baru',        warna: '#7A6259', latar: 'rgba(122,98,89,0.10)' },
  { nilai: 'dihubungi',   label: 'Dihubungi',   warna: '#D97706', latar: 'rgba(217,119,6,0.10)' },
  { nilai: 'siap',        label: 'Siap',        warna: '#059669', latar: 'rgba(5,150,105,0.10)' },
  { nilai: 'tidak_cocok', label: 'Tidak cocok', warna: '#9E8880', latar: 'rgba(158,136,128,0.12)' },
]

const KARTU = [
  { bg: 'linear-gradient(160deg,#E83530 0%,#D42B22 55%,#C02018 100%)', glow: 'rgba(180,30,20,0.28)' },
  { bg: 'linear-gradient(160deg,#1050A0 0%,#1D6FB5 55%,#1558A0 100%)', glow: 'rgba(20,80,165,0.25)' },
  { bg: 'linear-gradient(160deg,#0A7A5A 0%,#059669 55%,#047857 100%)', glow: 'rgba(5,120,85,0.25)'  },
  { bg: 'linear-gradient(160deg,#B45309 0%,#D97706 55%,#B45309 100%)', glow: 'rgba(180,85,0,0.25)'  },
]

function rupiah(n: number) {
  return `Rp ${n.toLocaleString('id-ID')}`
}

function tanggal(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'Asia/Jakarta',
  })
}

/** 6281234567890 -> 0812-3456-7890, supaya terbaca dan bisa didikte lewat telepon. */
function nomorTampil(phone: string) {
  const lokal = phone.startsWith('62') ? '0' + phone.slice(2) : phone
  return lokal.replace(/(\d{4})(\d{4})(\d+)/, '$1-$2-$3')
}

export default function TalentClient({
  pelamar, pendapatanHari, pendapatanBulan, sesiHari,
}: {
  pelamar: Pelamar[]
  pendapatanHari: number
  pendapatanBulan: number
  sesiHari: number
}) {
  const router = useRouter()
  const [cari, setCari] = useState('')
  const [saring, setSaring] = useState<string | null>(null)
  const [data, setData] = useState(pelamar)
  const [sibuk, setSibuk] = useState<string | null>(null)

  const hitung = useMemo(() => {
    const h: Record<string, number> = { baru: 0, dihubungi: 0, siap: 0, tidak_cocok: 0 }
    for (const p of data) h[p.status] = (h[p.status] ?? 0) + 1
    return h
  }, [data])

  const tampil = useMemo(() => {
    const q = cari.trim().toLowerCase()
    return data.filter((p) => {
      if (saring && p.status !== saring) return false
      if (!q) return true
      return (
        p.full_name.toLowerCase().includes(q) ||
        p.phone.includes(q.replace(/\D/g, '')) ||
        (p.social ?? '').toLowerCase().includes(q)
      )
    })
  }, [data, cari, saring])

  async function ubahStatus(id: string, status: string) {
    const sebelum = data
    // Optimistis: daftar ini dipakai sambil menelepon orang, dan menunggu
    // bolak-balik server tiap kali menandai satu nama membuat ritmenya patah.
    setData((d) => d.map((p) => (p.id === id ? { ...p, status } : p)))
    setSibuk(id)
    try {
      const r = await fetch('/api/talent/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (!r.ok) setData(sebelum)
    } catch {
      setData(sebelum)
    } finally {
      setSibuk(null)
    }
  }

  function unduhCsv() {
    const kolom = ['nama', 'nomor_wa', 'sosmed', 'status', 'tanggal_daftar']
    const baris = tampil.map((p) => [
      p.full_name,
      p.phone,
      p.social ?? '',
      p.status,
      new Date(p.created_at).toISOString(),
    ])
    // Setiap sel dikutip dan tanda kutip di dalamnya digandakan. Nama orang
    // memang jarang memuat koma, tapi kolom sosmed berisi tempelan bebas —
    // satu koma di sana cukup untuk menggeser seluruh kolom di spreadsheet.
    const csv = [kolom, ...baris]
      .map((r) => r.map((sel) => `"${String(sel).replace(/"/g, '""')}"`).join(','))
      .join('\r\n')

    // BOM supaya Excel membaca UTF-8; tanpa ini nama beraksen jadi kacau.
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `talent-pool-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function keluar() {
    await fetch('/api/talent/masuk', { method: 'DELETE' })
    router.replace('/masuk')
    router.refresh()
  }

  const statistik = [
    { label: 'Pendapatan Hari Ini', nilai: rupiah(pendapatanHari),  icon: TrendingUp   },
    { label: 'Pendapatan Bulan Ini', nilai: rupiah(pendapatanBulan), icon: CalendarDays },
    { label: 'Sesi Hari Ini',        nilai: String(sesiHari),        icon: Activity     },
    { label: 'Total Talent',         nilai: String(data.length),     icon: Users        },
  ]

  return (
    <div style={{ minHeight: '100dvh', background: C.ground, color: C.teks, fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800;900&display=swap');
        *, *::before, *::after { box-sizing:border-box; margin:0; padding:0; }
        .t-kartu { padding:20px; border-radius:22px; position:relative; overflow:hidden;
                   transition:transform .25s cubic-bezier(0.34,1.56,0.64,1); }
        .t-kartu:hover { transform:translateY(-4px); }
        .t-kartu::before { content:''; position:absolute; inset:0; border-radius:inherit;
                           pointer-events:none;
                           background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%); }
        .t-papan { background:#fff; border:1px solid rgba(212,43,34,0.10); border-radius:20px;
                   box-shadow:0 2px 12px rgba(212,43,34,0.06), 0 1px 3px rgba(0,0,0,0.04); }
        .t-field { width:100%; padding:12px 14px 12px 40px; border-radius:14px; font-family:inherit;
                   font-size:15px; border:1px solid ${C.garis}; background:#fff; color:${C.teks};
                   transition:border-color .18s, box-shadow .18s; }
        .t-field:focus { outline:none; border-color:${C.aksen}; box-shadow:0 0 0 3px rgba(212,43,34,.14); }
        .t-chip { border:1px solid ${C.garis}; background:#fff; color:${C.teks3};
                  padding:8px 14px; border-radius:999px; font-family:inherit; font-size:13px;
                  font-weight:600; cursor:pointer; transition:all .18s; white-space:nowrap; }
        .t-chip:hover { border-color:rgba(212,43,34,0.30); color:${C.aksen}; }
        .t-chip.aktif { background:${C.aksen}; border-color:${C.aksen}; color:#fff; }
        .t-aksi { display:inline-flex; align-items:center; gap:7px; border:1px solid ${C.garis};
                  background:#fff; color:${C.teks2}; padding:9px 14px; border-radius:12px;
                  font-family:inherit; font-size:13px; font-weight:600; cursor:pointer;
                  text-decoration:none; transition:all .18s; }
        .t-aksi:hover { border-color:rgba(5,150,105,0.35); color:#059669; }
        .t-keluar:hover { border-color:rgba(212,43,34,0.35); color:${C.aksen}; }
        .t-pilih { border:1px solid ${C.garis}; border-radius:10px; padding:7px 10px;
                   font-family:inherit; font-size:12.5px; font-weight:600; cursor:pointer;
                   background:#fff; }
        .t-pilih:focus { outline:none; border-color:${C.aksen}; }
        table { width:100%; border-collapse:collapse; }
        th { text-align:left; font-size:11px; font-weight:700; letter-spacing:.1em;
             text-transform:uppercase; color:${C.teks4}; padding:14px 16px;
             border-bottom:1px solid ${C.garisTipis}; white-space:nowrap; }
        td { padding:14px 16px; border-bottom:1px solid ${C.garisTipis}; font-size:14px;
             vertical-align:middle; }
        tbody tr:last-child td { border-bottom:none; }
        tbody tr:hover { background:rgba(212,43,34,0.03); }
        .t-gulir { overflow-x:auto; }
        .t-statistik { display:grid; gap:14px; grid-template-columns:repeat(4,minmax(0,1fr)); }
        @media (max-width:1000px) { .t-statistik { grid-template-columns:repeat(2,minmax(0,1fr)); } }
        @media (max-width:560px)  { .t-statistik { grid-template-columns:minmax(0,1fr); } }
        @media (prefers-reduced-motion: reduce) { .t-kartu { transition:none; } }
      `}</style>

      <div style={{ maxWidth: 1180, margin: '0 auto', padding: '28px 20px 56px' }}>

        {/* ── KEPALA ── */}
        <header style={{
          display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between',
          gap: 16, flexWrap: 'wrap', marginBottom: 26,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
              <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
              <p style={{ color: C.aksen, fontSize: 11, fontWeight: 700, letterSpacing: '2.5px', textTransform: 'uppercase' }}>
                Pabrik Kenangan
              </p>
            </div>
            <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: '-0.02em' }}>Talent Pool</h1>
            <p style={{ color: C.teks4, fontSize: 13.5, marginTop: 4 }}>
              Crew freelance yang mendaftar lewat pabrikenangan.my.id/karir
            </p>
          </div>
          <button className="t-aksi t-keluar" onClick={keluar}>
            <LogOut size={15} /> Keluar
          </button>
        </header>

        {/* ── STATISTIK ── */}
        <div className="t-statistik" style={{ marginBottom: 26 }}>
          {statistik.map(({ label, nilai, icon: Icon }, i) => {
            const k = KARTU[i % KARTU.length]
            return (
              <div key={label} className="t-kartu" style={{
                background: k.bg,
                boxShadow: `inset 0 2px 3px rgba(255,255,255,0.18), 0 8px 24px ${k.glow}, 0 16px 40px rgba(0,0,0,0.04)`,
              }}>
                <div style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, background: 'linear-gradient(90deg,transparent,rgba(255,255,255,0.35),transparent)' }} />
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
                  <p style={{ color: 'rgba(255,255,255,0.72)', fontSize: 10.5, fontWeight: 700, letterSpacing: '1px', textTransform: 'uppercase' }}>
                    {label}
                  </p>
                  <div style={{
                    width: 34, height: 34, borderRadius: 11, flexShrink: 0,
                    background: 'rgba(255,255,255,0.18)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25)',
                  }}>
                    <Icon size={15} color="white" />
                  </div>
                </div>
                <p style={{ color: '#fff', fontSize: 24, fontWeight: 900, lineHeight: 1.1, letterSpacing: '-0.03em' }}>
                  {nilai}
                </p>
              </div>
            )
          })}
        </div>

        {/* ── SARINGAN ── */}
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'center', marginBottom: 16 }}>
          <div style={{ position: 'relative', flex: '1 1 260px', minWidth: 220 }}>
            <Search size={16} color={C.teks4} style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)' }} />
            <input
              className="t-field"
              value={cari}
              onChange={(e) => setCari(e.target.value)}
              placeholder="Cari nama, nomor, atau sosmed"
              aria-label="Cari talent"
            />
          </div>
          <button className="t-aksi" onClick={unduhCsv}>
            <Download size={15} /> Unduh CSV
          </button>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 18 }}>
          <button className={`t-chip ${saring === null ? 'aktif' : ''}`} onClick={() => setSaring(null)}>
            Semua {data.length}
          </button>
          {STATUS.map((s) => (
            <button
              key={s.nilai}
              className={`t-chip ${saring === s.nilai ? 'aktif' : ''}`}
              onClick={() => setSaring(saring === s.nilai ? null : s.nilai)}
            >
              {s.label} {hitung[s.nilai] ?? 0}
            </button>
          ))}
        </div>

        {/* ── TABEL ── */}
        <div className="t-papan">
          {tampil.length === 0 ? (
            <p style={{ padding: '44px 24px', textAlign: 'center', color: C.teks3, fontSize: 14, lineHeight: 1.6 }}>
              {data.length === 0
                ? 'Belum ada yang mendaftar. Bagikan pabrikenangan.my.id/karir, dan pendaftar akan muncul di sini.'
                : 'Tidak ada yang cocok dengan pencarian ini.'}
            </p>
          ) : (
            <div className="t-gulir">
              <table>
                <thead>
                  <tr>
                    <th>Nama</th>
                    <th>Nomor WhatsApp</th>
                    <th>Sosmed</th>
                    <th>Daftar</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {tampil.map((p) => {
                    const s = STATUS.find((x) => x.nilai === p.status) ?? STATUS[0]
                    return (
                      <tr key={p.id} style={{ opacity: sibuk === p.id ? 0.55 : 1 }}>
                        <td style={{ fontWeight: 600, color: C.teks }}>{p.full_name}</td>
                        <td style={{ color: C.teks2, fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
                          {nomorTampil(p.phone)}
                        </td>
                        <td style={{ color: C.teks3, maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {p.social || <span style={{ color: C.teks4 }}>&mdash;</span>}
                        </td>
                        <td style={{ color: C.teks3, whiteSpace: 'nowrap' }}>{tanggal(p.created_at)}</td>
                        <td>
                          <select
                            className="t-pilih"
                            value={p.status}
                            onChange={(e) => ubahStatus(p.id, e.target.value)}
                            style={{ color: s.warna, background: s.latar, borderColor: 'transparent' }}
                            aria-label={`Status ${p.full_name}`}
                          >
                            {STATUS.map((x) => (
                              <option key={x.nilai} value={x.nilai} style={{ color: C.teks, background: '#fff' }}>
                                {x.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <a
                            className="t-aksi"
                            href={`https://wa.me/${p.phone}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            <MessageCircle size={15} /> Chat
                          </a>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <p style={{ fontSize: 12, color: C.teks4, marginTop: 14 }}>
          Menampilkan {tampil.length} dari {data.length} talent.
        </p>
      </div>
    </div>
  )
}
