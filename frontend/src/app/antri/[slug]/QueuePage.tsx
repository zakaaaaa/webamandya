'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Phone, X } from 'lucide-react'

/*
 * HALAMAN ANTREAN PELANGGAN
 *
 * Design read: halaman utilitas sekali-pakai, dibuka sambil berdiri di
 * keramaian tenant, sering hanya dilirik beberapa detik. Keterbacaan sekilas
 * mengalahkan komposisi. VARIANCE 4 / MOTION 3 / DENSITY 3.
 *
 * Aturan yang dikunci di berkas ini:
 *   - Satu aksen saja: merah merek. Tidak ada warna kedua di mana pun.
 *   - Dua tingkat radius saja: permukaan 20px, kendali 14px.
 *   - Tema terang dikunci, mengikuti sistem desain situs yang memang belum
 *     punya mode gelap. Layar HP di mall juga dibaca dalam kondisi silau.
 *   - Tanpa emoji. Simbol memakai glif ikon.
 *   - Gerak hanya transisi. Satu-satunya animasi berulang ada pada keadaan
 *     "giliranmu", karena tugasnya memang menarik perhatian dari jauh, dan
 *     itu pun mati di bawah prefers-reduced-motion.
 */

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.pabrikenangan.my.id'

// Polling, bukan websocket: wifi mall dan tethering HP sering memutus koneksi
// panjang, dan permintaan pendek yang gagal cukup diulang beberapa detik lagi.
const POLL_TIKET_MS = 4000
const POLL_BOOTH_MS = 8000

type Booth = {
  booth: string
  mode: 'off' | 'on' | 'closing'
  menerima_tiket: boolean
  menunggu: number
  estimasi_tunggu: number
  push_aktif: boolean
  vapid_public_key: string | null
}

type Tiket = {
  ticket_id: string
  nomor: number
  kode: string
  nama: string | null
  // 'expired' = tiket hari sebelumnya, ditutup server saat hari berganti.
  status: 'waiting' | 'called' | 'serving' | 'done' | 'skipped' | 'left' | 'expired'
  posisi: number | null
  estimasi_tunggu: number | null
  frame_id: string | null
  dikabari: boolean
}

type Frame = { id: string; name: string; thumbnail_url: string | null; image_url: string | null }

// Keadaan notifikasi yang DITAMPILKAN APA ADANYA. Kegagalan terburuk fitur ini
// bukan push yang tidak terkirim, melainkan orang yang menjauh dari tenant
// karena mengira akan dikabari padahal izinnya mati.
type Kabar = 'memuat' | 'belum' | 'aktif' | 'ditolak' | 'tak-didukung'

const C = {
  aksen: '#D42B22',
  aksenTua: '#B0201A',
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

function menitDari(detik: number | null | undefined) {
  if (detik == null) return null
  return Math.max(1, Math.round(detik / 60))
}

// VAPID dikirim sebagai base64url; PushManager menuntut Uint8Array.
function kunciKeBytes(base64url: string) {
  const pad = '='.repeat((4 - (base64url.length % 4)) % 4)
  const b64 = (base64url + pad).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

// iOS hanya mengizinkan Web Push kalau halamannya sudah ditambahkan ke Layar
// Utama. Menyuruh pengunjung photobooth melakukan itu tidak realistis, jadi
// kasus ini dideteksi dan dijawab jujur, bukan dibiarkan gagal diam-diam.
function iosTanpaPush() {
  if (typeof window === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true
  return ios && !standalone
}

function fingerprint() {
  const kunci = 'antri:fp'
  let fp = localStorage.getItem(kunci)
  if (!fp) {
    fp = crypto.randomUUID()
    localStorage.setItem(kunci, fp)
  }
  return fp
}

export default function QueuePage({ slug, boothName }: { slug: string; boothName: string }) {
  const [booth, setBooth] = useState<Booth | null>(null)
  const [tiket, setTiket] = useState<Tiket | null>(null)
  const [kabar, setKabar] = useState<Kabar>('memuat')
  const [nama, setNama] = useState('')
  const [telepon, setTelepon] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [frames, setFrames] = useState<Frame[] | null>(null)
  const [bukaFrame, setBukaFrame] = useState(false)

  const kunciTiket = `antri:${slug}:tiket`
  const statusSebelum = useRef<string | null>(null)

  const muatBooth = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/queue/${slug}`, { cache: 'no-store' })
      if (r.ok) setBooth(await r.json())
    } catch {
      // Jaringan tenant sering putus-nyambung; pertahankan tampilan terakhir.
    }
  }, [slug])

  const muatTiket = useCallback(async (id: string) => {
    try {
      const r = await fetch(`${API}/api/queue/${slug}/t/${id}`, { cache: 'no-store' })
      if (r.status === 404) {
        localStorage.removeItem(kunciTiket)
        setTiket(null)
        return
      }
      if (!r.ok) return
      const data: Tiket = await r.json()

      // 'expired' WAJIB ada di daftar ini: tanpanya, tiket kemarin tetap
      // dirender sebagai antrean aktif meski booth-nya sudah tutup.
      if (['done', 'skipped', 'left', 'expired'].includes(data.status)) {
        localStorage.removeItem(kunciTiket)
      }
      setTiket(data)
    } catch {
      /* abaikan, coba lagi di tik berikutnya */
    }
  }, [slug, kunciTiket])

  useEffect(() => {
    muatBooth()
    const id = localStorage.getItem(kunciTiket)
    if (id) muatTiket(id)

    if (iosTanpaPush()) setKabar('tak-didukung')
    else if (typeof window === 'undefined' || !('Notification' in window) || !('serviceWorker' in navigator)) setKabar('tak-didukung')
    else if (Notification.permission === 'denied') setKabar('ditolak')
    else setKabar('belum')
  }, [muatBooth, muatTiket, kunciTiket])

  useEffect(() => {
    const aktif = tiket && ['waiting', 'called', 'serving'].includes(tiket.status)
    const t = setInterval(() => {
      if (aktif && tiket) muatTiket(tiket.ticket_id)
      else muatBooth()
    }, aktif ? POLL_TIKET_MS : POLL_BOOTH_MS)
    return () => clearInterval(t)
  }, [tiket, muatTiket, muatBooth])

  // Pengunjung yang halamannya masih terbuka di tangan tidak menerima
  // notifikasi sistem (browser menahannya saat tab aktif), jadi perubahan
  // status harus terasa dari halaman itu sendiri.
  useEffect(() => {
    if (!tiket) return
    if (statusSebelum.current === 'waiting' && tiket.status === 'called') {
      try { navigator.vibrate?.([200, 100, 200, 100, 400]) } catch { /* tidak semua HP punya */ }
    }
    statusSebelum.current = tiket.status
  }, [tiket])

  async function ambilNomor() {
    setSibuk(true); setGalat(null)
    try {
      const r = await fetch(`${API}/api/queue/${slug}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: nama.trim() || null,
          phone: telepon.trim() || null,
          fingerprint: fingerprint(),
        }),
      })
      const data = await r.json()
      if (!r.ok) { setGalat(data.message || 'Gagal mengambil nomor.'); return }
      localStorage.setItem(kunciTiket, data.ticket_id)
      await muatTiket(data.ticket_id)
    } catch {
      setGalat('Tidak bisa terhubung. Cek sinyal lalu coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  async function nyalakanKabar() {
    if (!tiket || !booth?.vapid_public_key) return
    setSibuk(true)
    try {
      // Izin diminta lewat tap eksplisit, bukan otomatis saat halaman terbuka.
      // Prompt otomatis sering diblokir Chrome diam-diam, dan pengunjung tidak
      // pernah tahu notifikasinya mati.
      const izin = await Notification.requestPermission()
      if (izin !== 'granted') { setKabar('ditolak'); return }

      const reg = await navigator.serviceWorker.register('/sw.js')
      await navigator.serviceWorker.ready
      const langganan = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: kunciKeBytes(booth.vapid_public_key),
      })
      const r = await fetch(`${API}/api/queue/${slug}/t/${tiket.ticket_id}/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: langganan.toJSON() }),
      })
      setKabar(r.ok ? 'aktif' : 'belum')
      if (r.ok) setTiket({ ...tiket, dikabari: true })
    } catch {
      setKabar('tak-didukung')
    } finally {
      setSibuk(false)
    }
  }

  async function bukaPilihanFrame() {
    setBukaFrame(true)
    if (frames) return
    try {
      const r = await fetch(`${API}/api/queue/${slug}/frames`, { cache: 'no-store' })
      if (r.ok) setFrames((await r.json()).frames || [])
    } catch { setFrames([]) }
  }

  async function pilihFrame(id: string) {
    if (!tiket) return
    setSibuk(true)
    try {
      const r = await fetch(`${API}/api/queue/${slug}/t/${tiket.ticket_id}/frame`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ frame_id: id }),
      })
      if (r.ok) { setTiket({ ...tiket, frame_id: id }); setBukaFrame(false) }
    } finally { setSibuk(false) }
  }

  async function batalkan() {
    if (!tiket) return
    setSibuk(true)
    try {
      await fetch(`${API}/api/queue/${slug}/t/${tiket.ticket_id}/leave`, { method: 'POST' })
      localStorage.removeItem(kunciTiket)
      setTiket(null)
      muatBooth()
    } finally { setSibuk(false) }
  }

  const aktif = tiket && ['waiting', 'called', 'serving'].includes(tiket.status)
  const kabarAktif = kabar === 'aktif' || tiket?.dikabari

  return (
    <div style={{ minHeight: '100dvh', background: C.ground, color: C.teks, fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        .q-btn { border:none; font-family:inherit; font-weight:700; cursor:pointer;
                 width:100%; padding:17px 20px; font-size:16px;
                 border-radius:${R_KENDALI}px; transition:transform .12s ease, background .18s ease; }
        .q-btn:active { transform:scale(.985); }
        .q-btn:disabled { opacity:.5; cursor:default; transform:none; }
        .q-field { width:100%; padding:15px 16px; border-radius:${R_KENDALI}px; font-family:inherit;
                   font-size:16px; border:1px solid ${C.garis}; background:${C.papan}; color:${C.teks};
                   transition:border-color .18s ease; }
        .q-field::placeholder { color:${C.teks3}; }
        .q-field:focus { outline:none; border-color:${C.aksen}; box-shadow:0 0 0 3px rgba(212,43,34,.14); }
        .q-skel { background:linear-gradient(90deg, rgba(21,12,9,.05), rgba(21,12,9,.10), rgba(21,12,9,.05));
                  background-size:200% 100%; animation:q-shine 1.3s ease-in-out infinite;
                  border-radius:${R_PERMUKAAN}px; }
        @keyframes q-shine { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        /* Satu-satunya animasi berulang di halaman ini. Tugasnya menarik
           perhatian dari beberapa meter, jadi geraknya dibenarkan. */
        .q-alert { animation:q-breathe 2s ease-in-out infinite; }
        @keyframes q-breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.015)} }
        @media (prefers-reduced-motion: reduce) {
          .q-skel, .q-alert { animation:none; }
          .q-btn { transition:none; }
        }
      `}</style>

      <div style={{ maxWidth: 440, margin: '0 auto', padding: '32px 20px 56px' }}>

        <header style={{ marginBottom: 28 }}>
          <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110}
            style={{ width: 104, height: 'auto', display: 'block' }} />
          <p style={{ fontSize: 13, color: C.teks3, marginTop: 8 }}>{boothName}</p>
        </header>

        {/* Muat awal: kerangka seukuran kartu aslinya, bukan pemintal generik */}
        {!booth && (
          <div style={{ display: 'grid', gap: 12 }}>
            <div className="q-skel" style={{ height: 132 }} />
            <div className="q-skel" style={{ height: 56, borderRadius: R_KENDALI }} />
          </div>
        )}

        {/* ── GILIRANMU ── */}
        {booth && aktif && tiket?.status === 'called' && (
          <section className="q-alert" style={{
            background: C.aksen, color: '#fff', borderRadius: R_PERMUKAAN, padding: '32px 24px',
            boxShadow: '0 14px 40px rgba(212,43,34,.24)',
          }}>
            <p style={{ fontSize: 13, fontWeight: 600, letterSpacing: '.08em', opacity: .92 }}>GILIRANMU SEKARANG</p>
            <p style={{ fontSize: 68, fontWeight: 800, lineHeight: 1, margin: '8px 0 4px', letterSpacing: '-0.03em' }}>
              {tiket.nomor}
            </p>
            <p style={{ fontSize: 15, opacity: .92, marginBottom: 22 }}>Datang ke booth sekarang.</p>
            <div style={{ background: 'rgba(255,255,255,.16)', borderRadius: R_KENDALI, padding: '16px 18px' }}>
              <p style={{ fontSize: 12.5, opacity: .88, marginBottom: 4 }}>Tunjukkan kode ini di booth</p>
              <p style={{ fontSize: 42, fontWeight: 800, letterSpacing: '.18em', lineHeight: 1.1 }}>{tiket.kode}</p>
            </div>
          </section>
        )}

        {/* ── SEDANG BERFOTO ── */}
        {booth && aktif && tiket?.status === 'serving' && (
          <section style={{ background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN, padding: 32 }}>
            <p style={{ fontSize: 19, fontWeight: 700 }}>Selamat berfoto</p>
            <p style={{ fontSize: 14, color: C.teks2, marginTop: 6, lineHeight: 1.6 }}>
              Sesimu sedang berlangsung di booth.
            </p>
          </section>
        )}

        {/* ── MENUNGGU ── */}
        {booth && aktif && tiket?.status === 'waiting' && (
          <>
            <section style={{
              background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN,
              padding: '26px 24px 22px',
            }}>
              <p style={{ fontSize: 12.5, color: C.teks3, fontWeight: 600, letterSpacing: '.07em' }}>NOMOR ANTREANMU</p>
              <p style={{ fontSize: 76, fontWeight: 800, color: C.aksen, lineHeight: 1, margin: '4px 0 20px', letterSpacing: '-0.04em' }}>
                {tiket.nomor}
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, borderTop: `1px solid ${C.garisTipis}`, paddingTop: 18 }}>
                <div>
                  <p style={{ fontSize: 21, fontWeight: 700 }}>
                    {tiket.posisi === 1 ? 'Berikutnya' : `${(tiket.posisi ?? 1) - 1} orang`}
                  </p>
                  <p style={{ fontSize: 12, color: C.teks3, marginTop: 2 }}>
                    {tiket.posisi === 1 ? 'kamu paling depan' : 'di depanmu'}
                  </p>
                </div>
                <div>
                  <p style={{ fontSize: 21, fontWeight: 700 }}>
                    {menitDari(tiket.estimasi_tunggu) ?? 'Belum'} {menitDari(tiket.estimasi_tunggu) ? 'menit' : 'terhitung'}
                  </p>
                  <p style={{ fontSize: 12, color: C.teks3, marginTop: 2 }}>perkiraan tunggu</p>
                </div>
              </div>
            </section>

            <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
              {kabarAktif ? (
                <p style={{
                  display: 'flex', gap: 10, alignItems: 'center', fontSize: 13.5, color: C.teks2,
                  padding: '14px 16px', border: `1px solid ${C.garisTipis}`, borderRadius: R_KENDALI, lineHeight: 1.5,
                }}>
                  <Bell size={17} strokeWidth={1.8} color={C.aksen} style={{ flexShrink: 0 }} />
                  Kami kabari lewat HP ini. Silakan jalan-jalan dulu.
                </p>
              ) : kabar === 'belum' ? (
                <button className="q-btn" onClick={nyalakanKabar} disabled={sibuk || !booth.vapid_public_key}
                  style={{ background: C.teks, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                  <Bell size={17} strokeWidth={2} /> Kabari saya di HP ini
                </button>
              ) : (
                <p style={{
                  display: 'flex', gap: 10, alignItems: 'flex-start', fontSize: 13, color: C.teks2,
                  padding: '14px 16px', border: `1px solid ${C.garis}`, borderRadius: R_KENDALI, lineHeight: 1.55,
                }}>
                  <BellOff size={17} strokeWidth={1.8} color={C.teks3} style={{ flexShrink: 0, marginTop: 1 }} />
                  <span>
                    <strong style={{ color: C.teks }}>Notifikasi tidak aktif di HP ini.</strong>{' '}
                    Jangan jauh dari booth, atau biarkan halaman ini terbuka.
                  </span>
                </p>
              )}

              {/* Pilih frame cukup satu tombol. Kisi thumbnail dibuka di lembar
                  terpisah supaya halaman utamanya tetap sependek mungkin. */}
              <button className="q-btn" onClick={bukaPilihanFrame} disabled={sibuk}
                style={{
                  background: C.papan, color: tiket.frame_id ? C.aksen : C.teks,
                  border: `1px solid ${tiket.frame_id ? C.aksen : C.garis}`, fontWeight: 600, fontSize: 15,
                }}>
                {tiket.frame_id ? 'Frame sudah dipilih. Ganti' : 'Pilih frame sekarang'}
              </button>

              <button onClick={batalkan} disabled={sibuk}
                style={{
                  background: 'none', border: 'none', color: C.teks3, fontSize: 13, fontFamily: 'inherit',
                  cursor: 'pointer', padding: 12, textDecoration: 'underline', textUnderlineOffset: 3,
                }}>
                Batalkan antrean
              </button>
            </div>
          </>
        )}

        {/* ── TIKET SUDAH TUNTAS ── */}
        {booth && tiket && !aktif && (
          <section style={{ background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN, padding: 28 }}>
            <p style={{ fontSize: 18, fontWeight: 700, marginBottom: 6 }}>
              {tiket.status === 'done' ? 'Sesimu sudah selesai'
                : tiket.status === 'skipped' ? 'Nomormu terlewat'
                : tiket.status === 'expired' ? 'Nomor ini sudah tidak berlaku'
                : 'Antrean dibatalkan'}
            </p>
            <p style={{ fontSize: 14, color: C.teks2, lineHeight: 1.6, marginBottom: 20 }}>
              {tiket.status === 'skipped' ? 'Nomormu dipanggil tapi belum ada yang datang. Temui petugas di booth.'
                : tiket.status === 'expired' ? 'Nomor antrean hanya berlaku di hari yang sama.'
                : 'Terima kasih sudah berfoto bersama kami.'}
            </p>
            <button className="q-btn" onClick={() => { setTiket(null); muatBooth() }}
              style={{ background: C.aksen, color: '#fff' }}>
              Ambil nomor baru
            </button>
          </section>
        )}

        {/* ── BELUM PUNYA TIKET ── */}
        {booth && !tiket && (
          booth.mode === 'off' ? (
            <section style={{ background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN, padding: 28 }}>
              <p style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>Booth sedang kosong</p>
              <p style={{ fontSize: 14.5, color: C.teks2, lineHeight: 1.6 }}>
                Tidak perlu antre. Langsung datang saja ke booth dan mulai berfoto.
              </p>
            </section>
          ) : !booth.menerima_tiket ? (
            <section style={{ background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN, padding: 28 }}>
              <p style={{ fontSize: 19, fontWeight: 700, marginBottom: 8 }}>
                {booth.mode === 'closing' ? 'Antrean sudah ditutup' : 'Antrean sedang penuh'}
              </p>
              <p style={{ fontSize: 14.5, color: C.teks2, lineHeight: 1.6 }}>
                {booth.mode === 'closing'
                  ? 'Pendaftaran hari ini sudah ditutup. Temui petugas di booth.'
                  : `Ada ${booth.menunggu} orang mengantre. Coba lagi sekitar ${menitDari(booth.estimasi_tunggu) ?? 30} menit lagi.`}
              </p>
            </section>
          ) : (
            <section>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, padding: '20px 0 22px',
                borderBottom: `1px solid ${C.garisTipis}`, marginBottom: 22,
              }}>
                <div>
                  <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>{booth.menunggu}</p>
                  <p style={{ fontSize: 12.5, color: C.teks3, marginTop: 5 }}>sedang mengantre</p>
                </div>
                <div>
                  <p style={{ fontSize: 30, fontWeight: 800, lineHeight: 1 }}>
                    {menitDari(booth.estimasi_tunggu) ?? 0}<span style={{ fontSize: 16, fontWeight: 600 }}> mnt</span>
                  </p>
                  <p style={{ fontSize: 12.5, color: C.teks3, marginTop: 5 }}>perkiraan tunggu</p>
                </div>
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <div style={{ display: 'grid', gap: 7 }}>
                  <label htmlFor="q-nama" style={{ fontSize: 13, fontWeight: 600, color: C.teks2 }}>Nama</label>
                  <input id="q-nama" className="q-field" value={nama} maxLength={40}
                    onChange={(e) => setNama(e.target.value)} placeholder="Boleh dikosongkan" />
                </div>

                <div style={{ display: 'grid', gap: 7 }}>
                  <label htmlFor="q-hp" style={{ fontSize: 13, fontWeight: 600, color: C.teks2 }}>Nomor HP</label>
                  <input id="q-hp" className="q-field" value={telepon} inputMode="tel" maxLength={20}
                    onChange={(e) => setTelepon(e.target.value)} placeholder="Boleh dikosongkan" />
                  <p style={{ fontSize: 12, color: C.teks3, lineHeight: 1.5, display: 'flex', gap: 7, alignItems: 'flex-start' }}>
                    <Phone size={13} strokeWidth={1.8} style={{ flexShrink: 0, marginTop: 2 }} />
                    Hanya dipakai petugas kalau notifikasi tidak sampai.
                  </p>
                </div>

                {galat && (
                  <p style={{ fontSize: 13, color: C.aksenTua, lineHeight: 1.5, fontWeight: 600 }}>{galat}</p>
                )}

                <button className="q-btn" onClick={ambilNomor} disabled={sibuk}
                  style={{ background: C.aksen, color: '#fff' }}>
                  {sibuk ? 'Mengambil nomor' : 'Ambil nomor antrean'}
                </button>
              </div>
            </section>
          )
        )}
      </div>

      {/* ── LEMBAR PILIH FRAME ── */}
      {bukaFrame && (
        <div
          role="dialog" aria-modal="true" aria-label="Pilih frame"
          onClick={() => setBukaFrame(false)}
          style={{
            position: 'fixed', inset: 0, zIndex: 50, background: 'rgba(21,12,9,.45)',
            display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
          }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{
              background: C.ground, width: '100%', maxWidth: 440, maxHeight: '82dvh', overflowY: 'auto',
              borderRadius: `${R_PERMUKAAN}px ${R_PERMUKAAN}px 0 0`, padding: '20px 20px 32px',
            }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <p style={{ fontSize: 16, fontWeight: 700 }}>Pilih frame</p>
              <button onClick={() => setBukaFrame(false)} aria-label="Tutup"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.teks3, padding: 4 }}>
                <X size={20} strokeWidth={2} />
              </button>
            </div>
            <p style={{ fontSize: 13, color: C.teks2, marginBottom: 16, lineHeight: 1.5 }}>
              Memilih sekarang membuatmu langsung berfoto saat gilirannya tiba.
            </p>

            {!frames ? (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {[0, 1, 2, 3, 4, 5].map((i) => (
                  <div key={i} className="q-skel" style={{ aspectRatio: '2/3', borderRadius: R_KENDALI }} />
                ))}
              </div>
            ) : frames.length === 0 ? (
              <p style={{ fontSize: 13.5, color: C.teks2, padding: '24px 0' }}>
                Belum ada frame yang bisa dipilih. Kamu tetap bisa memilihnya nanti di booth.
              </p>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                {frames.map((f) => {
                  const terpilih = tiket?.frame_id === f.id
                  return (
                    <button key={f.id} onClick={() => pilihFrame(f.id)} disabled={sibuk} aria-label={f.name}
                      style={{
                        border: `2px solid ${terpilih ? C.aksen : 'transparent'}`,
                        borderRadius: R_KENDALI, padding: 3, background: C.papan, cursor: 'pointer',
                        boxShadow: terpilih ? 'none' : `inset 0 0 0 1px ${C.garisTipis}`,
                      }}>
                      <img src={f.thumbnail_url || f.image_url || ''} alt={f.name}
                        style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: R_KENDALI - 4, display: 'block' }} />
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
