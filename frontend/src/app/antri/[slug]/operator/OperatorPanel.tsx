'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageCircle, Minus, Plus, SkipForward, Users, X } from 'lucide-react'

/*
 * PANEL OPERATOR
 *
 * Dibuka di HP operator, bukan di kios: operator harus bisa bergerak, dan
 * kalau aplikasi kios crash di tengah acara antrean tetap harus bisa berjalan.
 *
 * TIDAK ADA PIN. Panel ini hanya memanggil dan melewati antrean satu booth,
 * dan satu layar PIN di HP operator saat antrean panjang lebih sering
 * menghambat daripada melindungi. Konsekuensinya diterima: siapa pun yang
 * tahu URL-nya bisa membuka halaman ini. Tautannya dibuka dari dasbor.
 *
 * SAKELAR MODE SENGAJA TIDAK ADA DI SINI. Menyalakan dan mematikan antrean
 * adalah keputusan pemilik, bukan keputusan orang yang sedang berdiri melayani
 * pengunjung, jadi tempatnya di dasbor. Panel ini hanya menjalankan antrean
 * yang sudah dinyalakan: memanggil, melewati yang tidak muncul, dan
 * menerbitkan nomor manual.
 *
 * Bahasa visualnya mengikuti halaman pengunjung: satu aksen merah, dua tingkat
 * radius, tema terang, tanpa emoji.
 */

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
  estimasi_per_sesi: number
  walkin_ahead: number
  sisa_sesi_berjalan: number
  push_aktif: boolean
  tiket: TiketOp[]
}

const C = {
  aksen: '#D42B22',
  teks: '#150C09',
  teks2: '#5C463D',
  teks3: '#8B7269',
  ground: '#FAF7F5',
  papan: '#FFFFFF',
  garis: 'rgba(21,12,9,0.10)',
  garisTipis: 'rgba(21,12,9,0.06)',
}

const R_PERMUKAAN = 20
const R_KENDALI = 14

function lamaMenunggu(sejak: string) {
  const menit = Math.floor((Date.now() - new Date(sejak).getTime()) / 60000)
  if (menit < 1) return 'baru saja'
  if (menit < 60) return `${menit} menit`
  return `${Math.floor(menit / 60)} jam ${menit % 60} menit`
}

// Nomor sudah disimpan server dalam bentuk 62xxxxxxxxx, jadi wa.me bisa
// dipakai apa adanya tanpa menebak format. Pesannya menyertakan kode 4 angka:
// kalau notifikasi HP tidak sampai, chat inilah satu-satunya cara pengunjung
// tahu kodenya tanpa bolak-balik ke booth.
function tautanWa(t: TiketOp) {
  const sapaan = t.nama ? `Halo ${t.nama}` : 'Halo'
  const pesan =
    `${sapaan}, giliranmu sudah tiba di Pabrik Kenangan. ` +
    `Nomor antrean ${t.nomor}, kode ${t.kode}. ` +
    `Silakan menuju booth dan masukkan kodenya di layar ya.`
  return `https://wa.me/${t.telepon}?text=${encodeURIComponent(pesan)}`
}

const LABEL_MODE: Record<Papan['mode'], string> = {
  on: 'Antrean aktif',
  closing: 'Pendaftaran ditutup',
  off: 'Antrean mati',
}

export default function OperatorPanel({ slug }: { slug: string }) {
  const [papan, setPapan] = useState<Papan | null>(null)
  const [galat, setGalat] = useState<string | null>(null)
  const [sibuk, setSibuk] = useState(false)
  const [namaBaru, setNamaBaru] = useState('')
  const [teleponBaru, setTeleponBaru] = useState('')
  const [bukaTambah, setBukaTambah] = useState(false)

  const muat = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/queue/${slug}/op/board`, { cache: 'no-store' })
      if (r.status === 404) { setGalat('Booth tidak ditemukan.'); return }
      if (r.ok) { setPapan(await r.json()); setGalat(null) }
    } catch {
      // Sinyal tenant naik-turun; pertahankan tampilan terakhir.
    }
  }, [slug])

  useEffect(() => { muat() }, [muat])

  useEffect(() => {
    const t = setInterval(muat, POLL_MS)
    return () => clearInterval(t)
  }, [muat])

  async function kirim(path: string, body?: unknown) {
    setSibuk(true)
    try {
      const r = await fetch(`${API}/api/queue/${slug}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
      })
      await muat()
      return r.ok
    } finally { setSibuk(false) }
  }

  const gaya = (
    <style>{`
      .o-btn { border:none; font-family:inherit; font-weight:700; cursor:pointer;
               padding:14px 16px; font-size:15px; border-radius:${R_KENDALI}px;
               transition:transform .12s ease; }
      .o-btn:active { transform:scale(.985); }
      .o-btn:disabled { opacity:.5; cursor:default; transform:none; }
      .o-field { width:100%; padding:14px 16px; border-radius:${R_KENDALI}px; font-family:inherit;
                 font-size:16px; border:1px solid ${C.garis}; background:${C.papan}; color:${C.teks}; }
      .o-field::placeholder { color:${C.teks3}; }
      .o-field:focus { outline:none; border-color:${C.aksen}; box-shadow:0 0 0 3px rgba(212,43,34,.14); }
      .o-icon { width:40px; height:40px; border-radius:${R_KENDALI - 2}px; border:1px solid ${C.garis};
                background:${C.papan}; display:flex; align-items:center; justify-content:center;
                color:${C.teks2}; cursor:pointer; flex-shrink:0; }
      .o-skel { background:linear-gradient(90deg, rgba(21,12,9,.05), rgba(21,12,9,.10), rgba(21,12,9,.05));
                background-size:200% 100%; animation:o-shine 1.3s ease-in-out infinite; border-radius:${R_PERMUKAAN}px; }
      @keyframes o-shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @media (prefers-reduced-motion: reduce) { .o-skel{animation:none} .o-btn{transition:none} }
    `}</style>
  )

  if (!papan) {
    return (
      <div style={{ minHeight: '100dvh', background: C.ground, fontFamily: "'Poppins',sans-serif" }}>
        {gaya}
        <div style={{ maxWidth: 520, margin: '0 auto', padding: '24px 16px', display: 'grid', gap: 12 }}>
          {galat
            ? <p style={{ fontSize: 14, color: C.aksen, fontWeight: 600 }}>{galat}</p>
            : <>
                <div className="o-skel" style={{ height: 92 }} />
                <div className="o-skel" style={{ height: 220 }} />
              </>}
        </div>
      </div>
    )
  }

  const menunggu = papan.tiket.filter((t) => t.status === 'waiting')
  const berjalan = papan.tiket.find((t) => t.status === 'called' || t.status === 'serving')
  const walkin = papan.walkin_ahead || 0

  return (
    <div style={{ minHeight: '100dvh', background: C.ground, color: C.teks, fontFamily: "'Poppins',sans-serif" }}>
      {gaya}
      <div style={{
        maxWidth: 520, margin: '0 auto',
        padding: '24px max(16px, env(safe-area-inset-right)) calc(48px + env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left))',
      }}>

        {/* Status mode: hanya dibaca. Diubah dari dasbor. */}
        <header style={{ paddingBottom: 18, borderBottom: `1px solid ${C.garisTipis}`, marginBottom: 18 }}>
          <p style={{ fontSize: 17, fontWeight: 700 }}>{LABEL_MODE[papan.mode]}</p>
          <p style={{ fontSize: 12.5, color: C.teks3, marginTop: 4, lineHeight: 1.5 }}>
            {papan.mode === 'off'
              ? 'Pengunjung diminta langsung datang ke booth. Nyalakan dari dasbor.'
              : papan.mode === 'closing'
                ? `Menghabiskan ${menunggu.length} sisa antrean, lalu mati sendiri.`
                : `${menunggu.length} menunggu. Sekitar ${Math.round(papan.estimasi_per_sesi / 60)} menit per sesi.`}
          </p>
          {!papan.push_aktif && (
            <p style={{ fontSize: 12.5, color: C.aksen, marginTop: 8, lineHeight: 1.5, fontWeight: 600 }}>
              Notifikasi HP sedang mati di server. Panggil dengan suara, atau hubungi lewat WhatsApp dari daftar di bawah.
            </p>
          )}
        </header>

        {/*
          Barisan fisik yang belum bertiket.

          Angkanya dimasukkan pemilik saat menyalakan antrean dan berkurang
          sendiri tiap sesi tanpa-tiket selesai. Tapi salah hitung saat booth
          ramai itu wajar, dan selama angkanya belum nol TIDAK ADA pemegang
          nomor yang akan dipanggil — jadi koreksinya harus ada di sini, di
          tangan orang yang sedang berdiri melihat barisannya sendiri.
        */}
        {(papan.mode !== 'off' || walkin > 0) && (
          <section style={{
            background: walkin > 0 ? C.papan : 'transparent',
            border: `1px solid ${walkin > 0 ? C.garis : C.garisTipis}`,
            borderRadius: R_PERMUKAAN, padding: '14px 16px', marginBottom: 14,
            display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          }}>
            <Users size={18} strokeWidth={1.8} color={walkin > 0 ? C.aksen : C.teks3} style={{ flexShrink: 0 }} />
            {/* minWidth 140: di bawah itu teksnya pecah per kata dan kartunya
                jadi tinggi sekali, jadi lebih baik tombolnya turun ke baris
                berikutnya daripada teksnya yang diperas. */}
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <p style={{ fontSize: 14, fontWeight: 700 }}>
                {walkin > 0 ? `${walkin} orang antre tanpa nomor` : 'Tidak ada antrean tanpa nomor'}
              </p>
              <p style={{ fontSize: 11.5, color: C.teks3, marginTop: 2, lineHeight: 1.45 }}>
                {walkin > 0
                  ? 'Termasuk yang sedang berfoto. Pemegang nomor dipanggil setelah habis.'
                  : 'Semua yang antre sudah punya nomor.'}
              </p>
            </div>
            <button className="o-icon" disabled={sibuk || walkin <= 0} aria-label="Kurangi satu"
              onClick={() => kirim('/op/settings', { walkin_ahead: walkin - 1 })}>
              <Minus size={16} strokeWidth={2} />
            </button>
            <button className="o-icon" disabled={sibuk || walkin >= 30} aria-label="Tambah satu"
              onClick={() => kirim('/op/settings', { walkin_ahead: walkin + 1 })}>
              <Plus size={16} strokeWidth={2} />
            </button>
          </section>
        )}

        {/* Yang sedang dilayani */}
        {berjalan && (
          <section style={{
            background: berjalan.status === 'called' ? C.aksen : C.papan,
            color: berjalan.status === 'called' ? '#fff' : C.teks,
            border: berjalan.status === 'called' ? 'none' : `1px solid ${C.garisTipis}`,
            borderRadius: R_PERMUKAAN, padding: 20, marginBottom: 14,
          }}>
            <p style={{ fontSize: 11.5, fontWeight: 600, letterSpacing: '.08em', opacity: .85 }}>
              {berjalan.status === 'called' ? 'SEDANG DIPANGGIL' : 'SEDANG BERFOTO'}
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 6, marginBottom: berjalan.status === 'called' ? 16 : 0 }}>
              <span style={{ fontSize: 'clamp(30px, 9vw, 38px)', fontWeight: 800, lineHeight: 1, flexShrink: 0 }}>
                {berjalan.nomor}
              </span>
              {/* Nama yang menyusut dan terpotong. Kode TIDAK boleh ikut
                  menyusut: itu yang dibacakan operator ke pengunjung. */}
              <span style={{
                fontSize: 15, opacity: .92, flex: 1, minWidth: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {berjalan.nama || 'Tanpa nama'}
              </span>
              <span style={{ fontSize: 16, fontWeight: 700, letterSpacing: '.12em', flexShrink: 0 }}>
                {berjalan.kode}
              </span>
            </div>
            {berjalan.status === 'called' && (
              <div style={{ display: 'flex', gap: 8 }}>
                {berjalan.telepon && (
                  <a href={tautanWa(berjalan)} target="_blank" rel="noopener noreferrer" className="o-btn"
                    style={{
                      flex: 1, background: 'rgba(255,255,255,.18)', color: '#fff', textDecoration: 'none',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    }}>
                    <MessageCircle size={15} strokeWidth={2} /> WhatsApp
                  </a>
                )}
                <button className="o-btn" onClick={() => kirim(`/op/t/${berjalan.id}/skip`)} disabled={sibuk}
                  style={{
                    flex: 1, background: 'rgba(255,255,255,.18)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  }}>
                  <SkipForward size={15} strokeWidth={2} /> Lewati
                </button>
              </div>
            )}
          </section>
        )}

        {!berjalan && menunggu.length > 0 && (
          <button className="o-btn" onClick={() => kirim('/op/call-next')} disabled={sibuk || walkin > 0}
            style={{ width: '100%', background: C.aksen, color: '#fff', marginBottom: 14, padding: 17, fontSize: 16 }}>
            {walkin > 0 ? `Habiskan dulu ${walkin} antrean tanpa nomor` : `Panggil nomor ${menunggu[0].nomor}`}
          </button>
        )}

        {/* Daftar tunggu */}
        <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Menunggu ({menunggu.length})</p>

        {menunggu.length === 0 ? (
          <p style={{ fontSize: 13.5, color: C.teks3, padding: '20px 0 24px', lineHeight: 1.6 }}>
            Belum ada yang mengantre. Nomor baru muncul di sini begitu ada yang memindai QR di standee.
          </p>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 20px' }}>
            {menunggu.map((t) => (
              <li key={t.id} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '13px 0',
                borderBottom: `1px solid ${C.garisTipis}`,
              }}>
                <span style={{ fontSize: 21, fontWeight: 800, minWidth: 34, color: C.aksen }}>{t.nomor}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ fontSize: 14.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {t.nama || 'Tanpa nama'}
                  </p>
                  <p style={{ fontSize: 12, color: C.teks3, marginTop: 2 }}>
                    {lamaMenunggu(t.menunggu_sejak)}
                    {t.sumber === 'operator' ? ', manual' : ''}
                    {t.punya_frame ? ', frame siap' : ''}
                    {!t.dikabari ? ', tanpa notifikasi' : ''}
                  </p>
                </div>
                {t.telepon && (
                  <a href={tautanWa(t)} target="_blank" rel="noopener noreferrer"
                    className="o-icon" aria-label={`WhatsApp ${t.nama || 'pengunjung'}`}>
                    <MessageCircle size={16} strokeWidth={1.8} />
                  </a>
                )}
                <button onClick={() => kirim(`/op/t/${t.id}/skip`)} disabled={sibuk}
                  className="o-icon" aria-label={`Lewati nomor ${t.nomor}`}>
                  <SkipForward size={16} strokeWidth={1.8} />
                </button>
              </li>
            ))}
          </ul>
        )}

        {/* Nomor manual */}
        {!bukaTambah ? (
          <button className="o-btn" onClick={() => setBukaTambah(true)}
            style={{
              width: '100%', background: C.papan, color: C.teks, border: `1px solid ${C.garis}`,
              fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            }}>
            <Plus size={16} strokeWidth={2} /> Terbitkan nomor manual
          </button>
        ) : (
          <section style={{ background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN, padding: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 14.5, fontWeight: 700 }}>Nomor manual</p>
              <button onClick={() => setBukaTambah(false)} aria-label="Tutup"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.teks3, padding: 4 }}>
                <X size={18} strokeWidth={2} />
              </button>
            </div>
            <p style={{ fontSize: 12.5, color: C.teks2, marginBottom: 14, lineHeight: 1.5 }}>
              Untuk pengunjung yang tidak bisa memindai QR. Nomor HP-nya yang
              dipakai tombol WhatsApp saat gilirannya tiba.
            </p>
            <div style={{ display: 'grid', gap: 10 }}>
              <div style={{ display: 'grid', gap: 6 }}>
                <label htmlFor="o-nama" style={{ fontSize: 12.5, fontWeight: 600, color: C.teks2 }}>Nama</label>
                <input id="o-nama" className="o-field" value={namaBaru} maxLength={40}
                  onChange={(e) => setNamaBaru(e.target.value)} placeholder="Nama pengunjung" />
              </div>
              <div style={{ display: 'grid', gap: 6 }}>
                <label htmlFor="o-hp" style={{ fontSize: 12.5, fontWeight: 600, color: C.teks2 }}>Nomor HP</label>
                <input id="o-hp" className="o-field" value={teleponBaru} inputMode="tel" maxLength={20}
                  onChange={(e) => setTeleponBaru(e.target.value)} placeholder="08xxxxxxxxxx" />
              </div>
              <button className="o-btn" disabled={sibuk}
                onClick={async () => {
                  const ok = await kirim('/op/issue', { display_name: namaBaru || null, phone: teleponBaru || null })
                  if (ok) { setNamaBaru(''); setTeleponBaru(''); setBukaTambah(false) }
                }}
                style={{ background: C.aksen, color: '#fff', marginTop: 4 }}>
                Terbitkan
              </button>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
