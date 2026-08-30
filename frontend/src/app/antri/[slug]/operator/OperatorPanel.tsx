'use client'

import { useCallback, useEffect, useState } from 'react'
import { Bell, BellOff, Loader2, Phone, Plus, SkipForward } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.pabrikenangan.my.id'
const POLL_MS = 5000

type TiketOp = {
  id: string
  nomor: number
  kode: string
  nama: string | null
  status: 'waiting' | 'called' | 'serving'
  sumber: 'qr' | 'operator'
  telepon: string | null
  posisi: number | null
  punya_frame: boolean
  dikabari: boolean
  menunggu_sejak: string
}

type Papan = {
  mode: 'off' | 'on' | 'closing'
  notify_lead: number
  max_queue_length: number
  estimasi_per_sesi: number
  push_aktif: boolean
  tiket: TiketOp[]
}

const C = {
  merah: '#D42B22', teks: '#150C09', teks3: '#7A6259', teks4: '#9E8880',
  bg: '#FAF7F5', kartu: '#FFFFFF', garis: 'rgba(212,43,34,0.14)',
}

function lamaMenunggu(sejak: string) {
  const menit = Math.floor((Date.now() - new Date(sejak).getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} mnt`
  return `${Math.floor(menit / 60)} jam ${menit % 60} mnt`
}

export default function OperatorPanel({ slug }: { slug: string }) {
  const [pin, setPin] = useState('')
  const [masuk, setMasuk] = useState(false)
  const [papan, setPapan] = useState<Papan | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [namaBaru, setNamaBaru] = useState('')
  const [teleponBaru, setTeleponBaru] = useState('')
  const [bukaTambah, setBukaTambah] = useState(false)

  const kunciPin = `antri:${slug}:pin`

  const muat = useCallback(async (pinDipakai: string) => {
    try {
      const r = await fetch(`${API}/api/queue/${slug}/op/board`, {
        headers: { 'x-queue-pin': pinDipakai },
        cache: 'no-store',
      })
      if (r.status === 401) {
        localStorage.removeItem(kunciPin)
        setMasuk(false)
        setGalat('PIN salah.')
        return
      }
      if (r.ok) { setPapan(await r.json()); setMasuk(true); setGalat(null) }
    } catch {
      // Sinyal tenant naik-turun; pertahankan tampilan terakhir dan coba lagi.
    }
  }, [slug, kunciPin])

  useEffect(() => {
    const tersimpan = localStorage.getItem(kunciPin)
    if (tersimpan) { setPin(tersimpan); muat(tersimpan) }
  }, [kunciPin, muat])

  useEffect(() => {
    if (!masuk) return
    const t = setInterval(() => muat(pin), POLL_MS)
    return () => clearInterval(t)
  }, [masuk, pin, muat])

  async function kirim(path: string, body?: unknown) {
    setSibuk(true)
    try {
      const r = await fetch(`${API}/api/queue/${slug}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-queue-pin': pin },
        body: body ? JSON.stringify(body) : undefined,
      })
      await muat(pin)
      return r.ok
    } finally { setSibuk(false) }
  }

  async function masukDenganPin() {
    localStorage.setItem(kunciPin, pin)
    await muat(pin)
  }

  // ── Layar PIN ──────────────────────────────────────────────────────────
  if (!masuk) {
    return (
      <div style={{
        minHeight: '100dvh', background: C.bg, fontFamily: "'Poppins',sans-serif",
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
      }}>
        <div style={{ width: '100%', maxWidth: 320, textAlign: 'center' }}>
          <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6, color: C.teks }}>Panel Antrean</div>
          <div style={{ fontSize: 12.5, color: C.teks4, marginBottom: 22 }}>/{slug}</div>
          <input
            value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            inputMode="numeric" maxLength={10} placeholder="PIN operator"
            onKeyDown={(e) => e.key === 'Enter' && masukDenganPin()}
            style={{
              width: '100%', padding: 16, fontSize: 22, textAlign: 'center', letterSpacing: '.3em',
              borderRadius: 14, border: `1px solid ${C.garis}`, fontFamily: 'inherit', background: '#fff',
            }} />
          {galat && <div style={{ fontSize: 13, color: C.merah, marginTop: 12 }}>{galat}</div>}
          <button onClick={masukDenganPin} disabled={pin.length < 4}
            style={{
              width: '100%', marginTop: 14, padding: 16, borderRadius: 14, border: 'none',
              background: C.merah, color: '#fff', fontSize: 16, fontWeight: 700,
              fontFamily: 'inherit', cursor: 'pointer', opacity: pin.length < 4 ? .5 : 1,
            }}>
            Masuk
          </button>
        </div>
      </div>
    )
  }

  if (!papan) {
    return (
      <div style={{ minHeight: '100dvh', background: C.bg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={26} color={C.teks4} />
      </div>
    )
  }

  const menunggu = papan.tiket.filter((t) => t.status === 'waiting')
  const berjalan = papan.tiket.find((t) => t.status === 'called' || t.status === 'serving')

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.teks, fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        .op-btn { border:none; border-radius:12px; font-family:inherit; font-weight:700;
                  cursor:pointer; padding:13px 14px; font-size:14px; }
        .op-btn:disabled { opacity:.5; cursor:default; }
      `}</style>

      <div style={{ maxWidth: 520, margin: '0 auto', padding: '20px 16px 40px' }}>

        {/* Mode */}
        <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 18, padding: 16, marginBottom: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <div>
              <div style={{ fontSize: 15, fontWeight: 800 }}>
                {papan.mode === 'on' ? 'Antrean aktif' : papan.mode === 'closing' ? 'Pendaftaran ditutup' : 'Antrean mati'}
              </div>
              <div style={{ fontSize: 12, color: C.teks4, marginTop: 2 }}>
                {papan.mode === 'off'
                  ? 'Pengunjung diminta langsung datang ke booth'
                  : papan.mode === 'closing'
                    ? `Menghabiskan ${menunggu.length} sisa antrean, lalu mati sendiri`
                    : `${menunggu.length} menunggu · ±${Math.round(papan.estimasi_per_sesi / 60)} mnt per sesi`}
              </div>
            </div>
            {papan.push_aktif
              ? <Bell size={18} color="#2D7D3C" />
              : <BellOff size={18} color="#B87514" />}
          </div>

          {papan.mode === 'on' ? (
            <button className="op-btn" onClick={() => kirim('/op/mode', { mode: 'off' })} disabled={sibuk}
              style={{ width: '100%', background: C.bg, color: C.teks, border: `1px solid ${C.garis}` }}>
              Tutup pendaftaran antrean
            </button>
          ) : (
            <button className="op-btn" onClick={() => kirim('/op/mode', { mode: 'on' })} disabled={sibuk}
              style={{ width: '100%', background: C.merah, color: '#fff' }}>
              {papan.mode === 'closing' ? 'Buka lagi pendaftaran' : 'Nyalakan antrean'}
            </button>
          )}

          {!papan.push_aktif && (
            <div style={{ fontSize: 11.5, color: '#8A5810', marginTop: 10, lineHeight: 1.5 }}>
              Notifikasi HP sedang mati di server — pengunjung tidak akan dikabari otomatis.
              Panggil lewat suara, atau telepon dari daftar di bawah.
            </div>
          )}
        </div>

        {/* Yang sedang dilayani */}
        {berjalan && (
          <div style={{
            background: berjalan.status === 'called' ? C.merah : C.kartu,
            color: berjalan.status === 'called' ? '#fff' : C.teks,
            border: `1px solid ${C.garis}`, borderRadius: 18, padding: 16, marginBottom: 14,
          }}>
            <div style={{ fontSize: 11.5, opacity: .82, fontWeight: 600, letterSpacing: '.06em' }}>
              {berjalan.status === 'called' ? 'SEDANG DIPANGGIL' : 'SEDANG BERFOTO'}
            </div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, margin: '4px 0 12px' }}>
              <div style={{ fontSize: 36, fontWeight: 900 }}>{berjalan.nomor}</div>
              <div style={{ fontSize: 15, opacity: .9 }}>{berjalan.nama || 'Tanpa nama'}</div>
              <div style={{ marginLeft: 'auto', fontSize: 15, fontWeight: 700, letterSpacing: '.1em' }}>{berjalan.kode}</div>
            </div>
            {berjalan.status === 'called' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {berjalan.telepon && (
                  <a href={`tel:${berjalan.telepon}`} className="op-btn"
                    style={{ flex: 1, background: 'rgba(255,255,255,.18)', color: '#fff', textAlign: 'center', textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                    <Phone size={15} /> Telepon
                  </a>
                )}
                <button className="op-btn" onClick={() => kirim(`/op/t/${berjalan.id}/skip`)} disabled={sibuk}
                  style={{ flex: 1, background: 'rgba(255,255,255,.18)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7 }}>
                  <SkipForward size={15} /> Lewati
                </button>
              </div>
            )}
          </div>
        )}

        {!berjalan && menunggu.length > 0 && (
          <button className="op-btn" onClick={() => kirim('/op/call-next')} disabled={sibuk}
            style={{ width: '100%', background: C.merah, color: '#fff', marginBottom: 14, padding: 16, fontSize: 16 }}>
            Panggil nomor {menunggu[0].nomor}
          </button>
        )}

        {/* Daftar tunggu */}
        <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 18, overflow: 'hidden', marginBottom: 14 }}>
          <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.garis}`, fontSize: 13, fontWeight: 700 }}>
            Menunggu ({menunggu.length})
          </div>
          {menunggu.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', fontSize: 13, color: C.teks4 }}>Tidak ada yang mengantre.</div>
          ) : menunggu.map((t) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
              borderBottom: `1px solid ${C.garis}`,
            }}>
              <div style={{ fontSize: 20, fontWeight: 800, minWidth: 34, color: C.merah }}>{t.nomor}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.nama || 'Tanpa nama'}
                  {t.sumber === 'operator' && <span style={{ fontSize: 10.5, color: C.teks4, marginLeft: 6 }}>manual</span>}
                </div>
                <div style={{ fontSize: 11.5, color: C.teks4, marginTop: 1 }}>
                  {lamaMenunggu(t.menunggu_sejak)}
                  {t.punya_frame && ' · frame ✓'}
                  {!t.dikabari && ' · tanpa notif'}
                </div>
              </div>
              {t.telepon && (
                <a href={`tel:${t.telepon}`} style={{
                  width: 38, height: 38, borderRadius: 10, background: C.bg, display: 'flex',
                  alignItems: 'center', justifyContent: 'center', color: C.teks3, flexShrink: 0,
                }}>
                  <Phone size={16} />
                </a>
              )}
              <button onClick={() => kirim(`/op/t/${t.id}/skip`)} disabled={sibuk} style={{
                width: 38, height: 38, borderRadius: 10, background: C.bg, border: 'none',
                display: 'flex', alignItems: 'center', justifyContent: 'center', color: C.teks3,
                cursor: 'pointer', flexShrink: 0,
              }}>
                <SkipForward size={16} />
              </button>
            </div>
          ))}
        </div>

        {/* Tiket manual — untuk yang sudah terlanjur berdiri antre */}
        {!bukaTambah ? (
          <button className="op-btn" onClick={() => setBukaTambah(true)}
            style={{ width: '100%', background: C.kartu, color: C.teks, border: `1px solid ${C.garis}`, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            <Plus size={16} /> Terbitkan nomor manual
          </button>
        ) : (
          <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 18, padding: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>Nomor manual</div>
            <div style={{ fontSize: 11.5, color: C.teks4, marginBottom: 12, lineHeight: 1.5 }}>
              Untuk pengunjung yang sudah berdiri antre sebelum antrean dinyalakan — supaya
              urutannya tidak hilang dan tidak perlu rebutan memindai QR.
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <input value={namaBaru} onChange={(e) => setNamaBaru(e.target.value)} placeholder="Nama" maxLength={40}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${C.garis}`, fontFamily: 'inherit', fontSize: 15 }} />
              <input value={teleponBaru} onChange={(e) => setTeleponBaru(e.target.value)} placeholder="Nomor HP (opsional)" inputMode="tel" maxLength={20}
                style={{ padding: 12, borderRadius: 10, border: `1px solid ${C.garis}`, fontFamily: 'inherit', fontSize: 15 }} />
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="op-btn" onClick={() => setBukaTambah(false)}
                  style={{ flex: 1, background: C.bg, color: C.teks3 }}>Batal</button>
                <button className="op-btn" disabled={sibuk}
                  onClick={async () => {
                    const ok = await kirim('/op/issue', { display_name: namaBaru || null, phone: teleponBaru || null })
                    if (ok) { setNamaBaru(''); setTeleponBaru(''); setBukaTambah(false) }
                  }}
                  style={{ flex: 2, background: C.merah, color: '#fff' }}>Terbitkan</button>
              </div>
            </div>
          </div>
        )}

        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 11, color: C.teks4 }}>
          Kabari saat sisa {papan.notify_lead} orang · maksimal {papan.max_queue_length} antrean
        </div>
      </div>
    </div>
  )
}
