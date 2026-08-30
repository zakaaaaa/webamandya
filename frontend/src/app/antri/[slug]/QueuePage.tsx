'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Bell, BellOff, Check, Loader2, TriangleAlert, X } from 'lucide-react'

const API = process.env.NEXT_PUBLIC_API_URL || 'https://api.pabrikenangan.my.id'

// Polling, bukan websocket: wifi mall dan tethering HP sering memutus koneksi
// panjang, dan permintaan pendek yang gagal cukup diulang 4 detik kemudian.
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
  status: 'waiting' | 'called' | 'serving' | 'done' | 'skipped' | 'left'
  posisi: number | null
  estimasi_tunggu: number | null
  frame_id: string | null
  dikabari: boolean
}

type Frame = { id: string; name: string; thumbnail_url: string | null; image_url: string | null }

// Keadaan notifikasi yang DITAMPILKAN APA ADANYA ke pengunjung. Kegagalan
// terburuk fitur ini bukan push yang tidak terkirim, melainkan orang yang
// menjauh dari tenant karena mengira akan dikabari padahal izinnya mati.
type Kabar = 'memuat' | 'belum' | 'aktif' | 'ditolak' | 'tak-didukung'

const C = {
  merah: '#D42B22', merahTua: '#C02018',
  teks: '#150C09', teks3: '#7A6259', teks4: '#9E8880',
  bg: '#FAF7F5', kartu: '#FFFFFF', garis: 'rgba(212,43,34,0.14)',
}

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
// kasus ini dideteksi dan dijawab jujur — bukan dibiarkan gagal diam-diam.
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

  // ── Muat keadaan booth ────────────────────────────────────────────────
  const muatBooth = useCallback(async () => {
    try {
      const r = await fetch(`${API}/api/queue/${slug}`, { cache: 'no-store' })
      if (r.ok) setBooth(await r.json())
    } catch {
      // Jaringan tenant sering putus-nyambung; diamkan dan coba lagi di tik berikutnya.
    }
  }, [slug])

  // ── Muat tiket tersimpan ──────────────────────────────────────────────
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

      // Tiket yang sudah tuntas dilepas dari penyimpanan supaya orang yang
      // memindai QR lagi besok tidak tersangkut pada tiket kemarin.
      if (['done', 'skipped', 'left'].includes(data.status)) {
        localStorage.removeItem(kunciTiket)
      }
      setTiket(data)
    } catch {
      /* abaikan, coba lagi */
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

  // ── Polling ───────────────────────────────────────────────────────────
  useEffect(() => {
    const aktif = tiket && ['waiting', 'called', 'serving'].includes(tiket.status)
    const jeda = aktif ? POLL_TIKET_MS : POLL_BOOTH_MS

    const t = setInterval(() => {
      if (aktif && tiket) muatTiket(tiket.ticket_id)
      else muatBooth()
    }, jeda)
    return () => clearInterval(t)
  }, [tiket, muatTiket, muatBooth])

  // ── Getar saat giliran tiba ───────────────────────────────────────────
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

  // ── Ambil nomor ───────────────────────────────────────────────────────
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

      // Izin notifikasi diminta SESUDAH nomor didapat, dan hanya lewat tap
      // eksplisit di layar berikutnya. Prompt otomatis saat halaman terbuka
      // sering diblokir Chrome diam-diam, dan pengunjung tidak pernah tahu
      // notifikasinya mati.
    } catch {
      setGalat('Tidak bisa terhubung. Cek sinyal lalu coba lagi.')
    } finally {
      setSibuk(false)
    }
  }

  // ── Nyalakan notifikasi ───────────────────────────────────────────────
  async function nyalakanKabar() {
    if (!tiket || !booth?.vapid_public_key) return
    setSibuk(true)
    try {
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

  // ── Frame ─────────────────────────────────────────────────────────────
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

  // ── Tampilan ──────────────────────────────────────────────────────────
  const aktif = tiket && ['waiting', 'called', 'serving'].includes(tiket.status)

  return (
    <div style={{ minHeight: '100dvh', background: C.bg, color: C.teks, fontFamily: "'Poppins',sans-serif" }}>
      <style>{`
        @keyframes denyut { 0%,100%{transform:scale(1)} 50%{transform:scale(1.03)} }
        .denyut { animation: denyut 1.4s ease-in-out infinite; }
        .tombol { border:none; border-radius:14px; font-family:inherit; font-weight:700;
                  cursor:pointer; width:100%; padding:16px; font-size:16px; }
        .tombol:disabled { opacity:.55; cursor:default; }
        .isian { width:100%; padding:14px 16px; border-radius:12px; font-family:inherit;
                 font-size:16px; border:1px solid ${C.garis}; background:#fff; color:${C.teks}; }
        .isian:focus { outline:2px solid ${C.merah}; outline-offset:-1px; }
      `}</style>

      <div style={{ maxWidth: 460, margin: '0 auto', padding: '28px 20px 48px' }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110}
            style={{ width: 116, height: 'auto', margin: '0 auto 10px', display: 'block' }} />
          <div style={{ fontSize: 12.5, color: C.teks4, letterSpacing: '.04em' }}>{boothName}</div>
        </div>

        {!booth && (
          <div style={{ textAlign: 'center', padding: 48, color: C.teks4 }}>
            <Loader2 size={26} className="denyut" style={{ opacity: .6 }} />
          </div>
        )}

        {/* ── Sudah punya tiket ── */}
        {booth && aktif && tiket && (
          <>
            {tiket.status === 'called' && (
              <div className="denyut" style={{
                background: C.merah, color: '#fff', borderRadius: 22, padding: '30px 22px',
                textAlign: 'center', marginBottom: 16,
                boxShadow: '0 10px 30px rgba(212,43,34,.28)',
              }}>
                <div style={{ fontSize: 13, opacity: .9, fontWeight: 600, letterSpacing: '.06em' }}>GILIRANMU SEKARANG</div>
                <div style={{ fontSize: 58, fontWeight: 900, lineHeight: 1.1, margin: '6px 0 2px' }}>{tiket.nomor}</div>
                <div style={{ fontSize: 14, opacity: .92, marginBottom: 18 }}>Datang ke booth sekarang ya</div>
                <div style={{ background: 'rgba(255,255,255,.16)', borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ fontSize: 12, opacity: .85, marginBottom: 4 }}>Sebutkan / ketik kode ini di booth</div>
                  <div style={{ fontSize: 40, fontWeight: 900, letterSpacing: '.16em' }}>{tiket.kode}</div>
                </div>
              </div>
            )}

            {tiket.status === 'serving' && (
              <div style={{
                background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 22,
                padding: 30, textAlign: 'center', marginBottom: 16,
              }}>
                <Check size={34} color={C.merah} style={{ margin: '0 auto 10px', display: 'block' }} />
                <div style={{ fontSize: 18, fontWeight: 800 }}>Selamat berfoto!</div>
                <div style={{ fontSize: 13.5, color: C.teks3, marginTop: 6 }}>
                  Sesimu sedang berlangsung di booth.
                </div>
              </div>
            )}

            {tiket.status === 'waiting' && (
              <div style={{
                background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 22,
                padding: '26px 22px', textAlign: 'center', marginBottom: 14,
                boxShadow: '0 2px 12px rgba(212,43,34,.06)',
              }}>
                <div style={{ fontSize: 12.5, color: C.teks4, letterSpacing: '.06em', fontWeight: 600 }}>NOMOR ANTREANMU</div>
                <div style={{ fontSize: 64, fontWeight: 900, color: C.merah, lineHeight: 1.05, margin: '2px 0 14px' }}>
                  {tiket.nomor}
                </div>

                <div style={{ display: 'flex', gap: 10 }}>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 14, padding: '12px 8px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>
                      {tiket.posisi === 1 ? 'Berikutnya' : `${(tiket.posisi ?? 1) - 1} orang`}
                    </div>
                    <div style={{ fontSize: 11.5, color: C.teks4, marginTop: 2 }}>
                      {tiket.posisi === 1 ? 'kamu paling depan' : 'di depanmu'}
                    </div>
                  </div>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 14, padding: '12px 8px' }}>
                    <div style={{ fontSize: 22, fontWeight: 800 }}>±{menitDari(tiket.estimasi_tunggu)} mnt</div>
                    <div style={{ fontSize: 11.5, color: C.teks4, marginTop: 2 }}>perkiraan tunggu</div>
                  </div>
                </div>
              </div>
            )}

            {/* Status notifikasi — selalu jujur */}
            {tiket.status !== 'serving' && (
              <div style={{ marginBottom: 14 }}>
                {kabar === 'aktif' || tiket.dikabari ? (
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'center', background: '#EDF7EE',
                    border: '1px solid rgba(45,125,60,.18)', borderRadius: 14, padding: '13px 15px',
                  }}>
                    <Bell size={17} color="#2D7D3C" style={{ flexShrink: 0 }} />
                    <div style={{ fontSize: 13, color: '#2D7D3C', lineHeight: 1.45 }}>
                      Kami akan mengabarimu di HP ini. Silakan jalan-jalan dulu.
                    </div>
                  </div>
                ) : kabar === 'belum' ? (
                  <button className="tombol" onClick={nyalakanKabar} disabled={sibuk || !booth.vapid_public_key}
                    style={{ background: C.teks, color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9 }}>
                    <Bell size={17} /> Kabari saya di HP ini
                  </button>
                ) : (
                  <div style={{
                    display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFF6E9',
                    border: '1px solid rgba(190,120,20,.2)', borderRadius: 14, padding: '13px 15px',
                  }}>
                    <TriangleAlert size={17} color="#B87514" style={{ flexShrink: 0, marginTop: 1 }} />
                    <div style={{ fontSize: 12.5, color: '#8A5810', lineHeight: 1.5 }}>
                      <b>Notifikasi tidak aktif di HP ini.</b> Jangan jauh-jauh dari booth, atau
                      biarkan halaman ini terbuka — petugas juga bisa memanggil namamu.
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Pilih frame sambil menunggu */}
            {tiket.status === 'waiting' && (
              <div style={{ marginBottom: 14 }}>
                {!bukaFrame ? (
                  <button className="tombol" onClick={bukaPilihanFrame}
                    style={{ background: tiket.frame_id ? '#EDF7EE' : C.kartu, color: tiket.frame_id ? '#2D7D3C' : C.teks, border: `1px solid ${C.garis}` }}>
                    {tiket.frame_id ? '✓ Frame sudah dipilih — ganti?' : 'Pilih frame sekarang (hemat waktu di booth)'}
                  </button>
                ) : (
                  <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 18, padding: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <b style={{ fontSize: 14 }}>Pilih frame</b>
                      <button onClick={() => setBukaFrame(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.teks4 }}>
                        <X size={18} />
                      </button>
                    </div>
                    {!frames ? (
                      <div style={{ textAlign: 'center', padding: 24, color: C.teks4 }}><Loader2 size={20} className="denyut" /></div>
                    ) : frames.length === 0 ? (
                      <div style={{ fontSize: 13, color: C.teks4 }}>Belum ada frame yang bisa dipilih.</div>
                    ) : (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                        {frames.map((f) => (
                          <button key={f.id} onClick={() => pilihFrame(f.id)} disabled={sibuk}
                            style={{
                              border: tiket.frame_id === f.id ? `2px solid ${C.merah}` : `1px solid ${C.garis}`,
                              borderRadius: 12, padding: 4, background: '#fff', cursor: 'pointer',
                            }}>
                            <img src={f.thumbnail_url || f.image_url || ''} alt={f.name}
                              style={{ width: '100%', aspectRatio: '2/3', objectFit: 'cover', borderRadius: 8, display: 'block' }} />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {tiket.status !== 'serving' && (
              <button onClick={batalkan} disabled={sibuk}
                style={{ background: 'none', border: 'none', color: C.teks4, fontSize: 13, fontFamily: 'inherit', cursor: 'pointer', width: '100%', padding: 12 }}>
                Batalkan antrean
              </button>
            )}
          </>
        )}

        {/* ── Tiket sudah selesai / dilewati ── */}
        {booth && tiket && !aktif && (
          <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 22, padding: 30, textAlign: 'center' }}>
            <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 6 }}>
              {tiket.status === 'done' ? 'Sesimu sudah selesai' : tiket.status === 'skipped' ? 'Nomormu terlewat' : 'Antrean dibatalkan'}
            </div>
            <p style={{ fontSize: 13.5, color: C.teks3, lineHeight: 1.6, marginBottom: 18 }}>
              {tiket.status === 'skipped'
                ? 'Nomormu dipanggil tapi belum ada yang datang. Ambil nomor baru atau temui petugas di booth.'
                : 'Terima kasih sudah berfoto bersama kami!'}
            </p>
            <button className="tombol" onClick={() => { setTiket(null); muatBooth() }} style={{ background: C.merah, color: '#fff' }}>
              Ambil nomor baru
            </button>
          </div>
        )}

        {/* ── Belum punya tiket ── */}
        {booth && !tiket && (
          <>
            {booth.mode === 'off' ? (
              <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 22, padding: 32, textAlign: 'center' }}>
                <div style={{ fontSize: 34, marginBottom: 10 }}>📸</div>
                <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>Booth sedang kosong</div>
                <p style={{ fontSize: 14, color: C.teks3, lineHeight: 1.6 }}>
                  Tidak perlu antre — <b>langsung datang saja</b> ke booth dan mulai berfoto.
                </p>
              </div>
            ) : !booth.menerima_tiket ? (
              <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 22, padding: 32, textAlign: 'center' }}>
                <BellOff size={30} color={C.teks4} style={{ margin: '0 auto 12px', display: 'block' }} />
                <div style={{ fontSize: 19, fontWeight: 800, marginBottom: 8 }}>
                  {booth.mode === 'closing' ? 'Antrean sudah ditutup' : 'Antrean sedang penuh'}
                </div>
                <p style={{ fontSize: 14, color: C.teks3, lineHeight: 1.6 }}>
                  {booth.mode === 'closing'
                    ? 'Pendaftaran antrean hari ini sudah ditutup. Coba tanya petugas di booth.'
                    : `Sedang ada ${booth.menunggu} orang mengantre. Coba lagi sekitar ${menitDari(booth.estimasi_tunggu)} menit lagi.`}
                </p>
              </div>
            ) : (
              <div style={{ background: C.kartu, border: `1px solid ${C.garis}`, borderRadius: 22, padding: 24, boxShadow: '0 2px 12px rgba(212,43,34,.06)' }}>
                <div style={{ display: 'flex', gap: 10, marginBottom: 20 }}>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 14, padding: '14px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{booth.menunggu}</div>
                    <div style={{ fontSize: 11.5, color: C.teks4 }}>sedang mengantre</div>
                  </div>
                  <div style={{ flex: 1, background: C.bg, borderRadius: 14, padding: '14px 8px', textAlign: 'center' }}>
                    <div style={{ fontSize: 24, fontWeight: 800 }}>±{menitDari(booth.estimasi_tunggu)} mnt</div>
                    <div style={{ fontSize: 11.5, color: C.teks4 }}>perkiraan tunggu</div>
                  </div>
                </div>

                <div style={{ display: 'grid', gap: 10, marginBottom: 16 }}>
                  <input className="isian" placeholder="Nama (opsional)" value={nama}
                    onChange={(e) => setNama(e.target.value)} maxLength={40} />
                  <input className="isian" placeholder="Nomor HP (opsional)" value={telepon} inputMode="tel"
                    onChange={(e) => setTelepon(e.target.value)} maxLength={20} />
                  <div style={{ fontSize: 11.5, color: C.teks4, lineHeight: 1.5 }}>
                    Nomor HP hanya dipakai petugas untuk memanggilmu kalau notifikasi tidak sampai.
                  </div>
                </div>

                {galat && (
                  <div style={{ fontSize: 13, color: C.merahTua, marginBottom: 12, lineHeight: 1.5 }}>{galat}</div>
                )}

                <button className="tombol" onClick={ambilNomor} disabled={sibuk}
                  style={{ background: C.merah, color: '#fff' }}>
                  {sibuk ? 'Mengambil…' : 'Ambil nomor antrean'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
