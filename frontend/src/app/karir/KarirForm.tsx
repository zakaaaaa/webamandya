'use client'

import { useState } from 'react'
import { Check } from 'lucide-react'

/*
 * FORM TALENT POOL CREW FREELANCE
 *
 * Design read: satu halaman, satu tugas, hampir selalu dibuka dari link atau
 * QR di HP. Yang menentukan berhasil-tidaknya bukan komposisi, melainkan
 * berapa cepat orang selesai mengisi. VARIANCE 3 / MOTION 1 / DENSITY 2.
 *
 * Aturan yang dikunci di berkas ini — sama dengan halaman /antri supaya kedua
 * halaman publik terbaca sebagai satu situs:
 *   - Satu aksen saja: merah merek. Tidak ada warna kedua.
 *   - Dua tingkat radius: permukaan 20px, kendali 14px.
 *   - Tema terang dikunci, mengikuti sistem desain situs.
 *   - Tanpa emoji; simbol memakai glif ikon.
 *   - Gerak hanya transisi.
 *
 * Satu keputusan yang perlu dicatat: field memakai font-size 16px. Di iOS
 * Safari, input di bawah 16px memaksa halaman ikut ter-zoom saat difokus, dan
 * pengisinya terlanjur kehilangan tombol kirim dari layar.
 */

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

// Nomor yang sama dengan Landing.tsx. Disalin, bukan diimpor: Landing.tsx
// adalah komponen 'use client' seukuran halaman penuh, dan mengimpor satu
// konstanta dari sana akan menyeret seluruh berkas itu ke bundel /karir.
const WA = '6289508279690'

type Hasil = { nama: string; sudahTerdaftar: boolean }

export default function KarirForm() {
  const [nama, setNama] = useState('')
  const [telepon, setTelepon] = useState('')
  const [sosmed, setSosmed] = useState('')
  const [website, setWebsite] = useState('') // honeypot, lihat route /api/karir
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)
  const [hasil, setHasil] = useState<Hasil | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    if (sibuk) return
    setSibuk(true)
    setGalat(null)
    try {
      const r = await fetch('/api/karir', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nama, telepon, sosmed, website }),
      })
      const data = await r.json()
      if (!r.ok) {
        setGalat(data.error || 'Pendaftaran gagal terkirim.')
        return
      }
      setHasil({
        nama: nama.trim().split(' ')[0],
        sudahTerdaftar: data.sudahTerdaftar === true,
      })
    } catch {
      setGalat('Tidak ada koneksi. Periksa jaringan lalu kirim ulang.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    /* Kolom flex, bukan aliran biasa: formnya pendek, dan tanpa ini footer
       berhenti di tengah layar dengan ruang kosong menganga di bawahnya. */
    <div style={{
      minHeight: '100dvh', background: C.ground, color: C.teks,
      fontFamily: "'Poppins',sans-serif",
      display: 'flex', flexDirection: 'column',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; }
        /* ── TOMBOL CLAYMORPHISM ──
           Resep yang sama dengan kartu statistik dasbor (dashboard/page.tsx)
           dan .stat-card::before di globals.css, supaya halaman publik ini
           terbaca sebagai bahan yang sama dengan bagian dalam aplikasi:
             1. gradien 160 derajat, bukan warna rata  -> bidangnya melengkung
             2. inset putih di tepi atas               -> cahaya jatuh dari atas
             3. bayangan BERWARNA merah, bukan hitam   -> benda empuk berwarna
           Keadaan :active membalik bayangan jadi ke dalam. Itu inti clay:
           benda yang ditekan masuk ke dalam bahannya, bukan sekadar mengecil. */
        .k-btn { border:none; font-family:inherit; font-weight:700; cursor:pointer;
                 width:100%; padding:17px 20px; font-size:16px; color:#fff;
                 position:relative; overflow:hidden;
                 background:linear-gradient(160deg,#E83530 0%,#D42B22 55%,#C02018 100%);
                 border-radius:${R_KENDALI}px;
                 box-shadow:inset 0 2px 3px rgba(255,255,255,0.28),
                            0 8px 24px rgba(180,30,20,0.28),
                            0 16px 40px rgba(0,0,0,0.04);
                 transition:transform .25s cubic-bezier(0.34,1.56,0.64,1), box-shadow .25s ease; }
        /* Kilau diagonal, sama persis dengan .stat-card::before. */
        .k-btn::before { content:''; position:absolute; inset:0; border-radius:inherit;
                         pointer-events:none;
                         background:linear-gradient(135deg,rgba(255,255,255,0.18) 0%,transparent 50%); }
        /* Garis rambut di tepi atas, sama dengan sisipan di kartu statistik. */
        .k-btn::after { content:''; position:absolute; top:0; left:22px; right:22px; height:1px;
                        pointer-events:none;
                        background:linear-gradient(90deg,transparent,rgba(255,255,255,0.40),transparent); }
        .k-btn:hover:not(:disabled) {
          transform:translateY(-3px);
          box-shadow:inset 0 2px 3px rgba(255,255,255,0.32),
                     0 14px 32px rgba(180,30,20,0.34),
                     0 22px 48px rgba(0,0,0,0.05);
        }
        .k-btn:active:not(:disabled) {
          transform:translateY(1px);
          box-shadow:inset 0 4px 8px rgba(120,18,12,0.42),
                     inset 0 1px 2px rgba(120,18,12,0.30),
                     0 3px 10px rgba(180,30,20,0.18);
        }
        .k-btn:focus-visible { outline:none;
          box-shadow:inset 0 2px 3px rgba(255,255,255,0.28),
                     0 0 0 4px rgba(212,43,34,0.22),
                     0 8px 24px rgba(180,30,20,0.28); }
        /* Nonaktif: bayangan berwarnanya dicabut, bukan cuma diredupkan.
           Benda empuk yang tidak bisa ditekan tidak boleh tetap mengambang. */
        .k-btn:disabled { cursor:default; transform:none;
          background:linear-gradient(160deg,#E5A5A1 0%,#DB9C97 55%,#D0928D 100%);
          box-shadow:inset 0 2px 3px rgba(255,255,255,0.22); }
        .k-field { width:100%; padding:15px 16px; border-radius:${R_KENDALI}px; font-family:inherit;
                   font-size:16px; border:1px solid ${C.garis}; background:${C.papan}; color:${C.teks};
                   transition:border-color .18s ease, box-shadow .18s ease; }
        .k-field::placeholder { color:${C.teks3}; }
        .k-field:focus { outline:none; border-color:${C.aksen}; box-shadow:0 0 0 3px rgba(212,43,34,.14); }
        .k-label { display:block; font-size:13px; font-weight:600; color:${C.teks2}; margin-bottom:7px; }
        /* Honeypot: tersembunyi dari mata dan dari pembaca layar, tapi tetap
           ada di DOM sehingga pengisi-otomatis menemukannya. */
        .k-hp { position:absolute; left:-9999px; width:1px; height:1px; overflow:hidden; }
        /* ── FOOTER ──
           Aturan disalin dari landing.css.ts (blok "Footer", baris 569-576)
           berikut ralat layar sempitnya di baris 650. Nilainya ditulis ulang
           dengan angka mentah karena halaman ini tidak memuat LANDING_CSS,
           jadi var(--line) dan kawan-kawannya tidak ada di sini:
             --line rgba(212,43,34,.12) | --ink-3 #7A6259 | --ink-4 #9E8880
           Kolom ini selalu sempit, jadi yang dipakai langsung bentuk <=760px:
           blok hak cipta rata kiri, bukan mengambang ke kanan. */
        .k-foot { border-top:1px solid rgba(212,43,34,.12); padding:44px 0 52px; }
        .k-foot-in { max-width:440px; margin:0 auto; padding:0 20px; }
        .k-sitefoot { display:flex; align-items:flex-start; gap:32px; flex-wrap:wrap; }
        .k-sitefoot .k-col { display:flex; flex-direction:column; gap:9px; }
        .k-sitefoot .k-col b { font-size:11px; letter-spacing:.14em; text-transform:uppercase;
                               color:#9E8880; font-family:'IBM Plex Mono',ui-monospace,monospace;
                               font-weight:500; }
        .k-sitefoot .k-col a { font-size:13.5px; color:#7A6259; text-decoration:none;
                               transition:color .18s; }
        .k-sitefoot .k-col a:hover { color:${C.aksen}; }
        .k-sitefoot .k-end { margin-left:0; text-align:left; display:flex;
                             flex-direction:column; gap:6px; }
        .k-sitefoot .k-end span { font-family:'IBM Plex Mono',ui-monospace,monospace;
                                  font-size:10.5px; letter-spacing:.12em; color:#9E8880; }
        .k-foot-brand { display:block; margin-bottom:10px; }
        .k-foot-brand img { width:116px; height:auto; display:block; }
        @media (prefers-reduced-motion: reduce) {
          .k-btn, .k-field, .k-sitefoot .k-col a { transition:none; }
        }
      `}</style>

      <div style={{ maxWidth: 440, width: '100%', margin: '0 auto', padding: '32px 20px 56px', flex: 1 }}>

        <header style={{ marginBottom: 28 }}>
          <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110}
            style={{ width: 104, height: 'auto', display: 'block', margin: '0 auto' }} />
        </header>

        {hasil ? (
          /* ── TERKIRIM ──
             Nama depan disebut supaya orang yakin datanya benar-benar masuk,
             bukan sekadar layar sukses generik. */
          <section style={{
            background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN,
            padding: '32px 24px',
          }}>
            <div style={{
              width: 46, height: 46, borderRadius: '50%', background: C.aksen,
              display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 20,
            }}>
              <Check size={24} strokeWidth={2.6} color="#fff" />
            </div>
            <h1 style={{ fontSize: 21, fontWeight: 700, letterSpacing: '-0.01em' }}>
              {hasil.sudahTerdaftar ? 'Kamu sudah terdaftar' : `Terima kasih, ${hasil.nama}`}
            </h1>
            <p style={{ fontSize: 14.5, color: C.teks2, marginTop: 10, lineHeight: 1.65 }}>
              {hasil.sudahTerdaftar
                ? 'Nomor ini sudah ada di daftar crew kami, jadi tidak perlu mendaftar ulang. Kami hubungi lewat WhatsApp begitu ada jadwal yang cocok.'
                : 'Datamu sudah masuk ke daftar crew Pabrik Kenangan. Kami hubungi lewat WhatsApp begitu ada jadwal acara yang cocok.'}
            </p>
            <p style={{ fontSize: 13, color: C.teks3, marginTop: 18, lineHeight: 1.6 }}>
              Simpan nomor kami supaya pesannya tidak masuk ke folder spam.
            </p>
          </section>
        ) : (
          <>
            {/* Judul dan paragraf pengantarnya diperlakukan sebagai satu blok
                rata tengah. Menengahkan judul saja, dengan paragraf tepat di
                bawahnya tetap rata kiri, terbaca seperti salah setel. */}
            <h1 style={{ fontSize: 26, fontWeight: 800, lineHeight: 1.25, letterSpacing: '-0.02em', textAlign: 'center' }}>
              Gabung jadi crew<br />Pabrik Kenangan
            </h1>
            <p style={{ fontSize: 14.5, color: C.teks2, marginTop: 12, marginBottom: 26, lineHeight: 1.65, textAlign: 'center' }}>
              Kami sering butuh tambahan crew freelance untuk menjaga photobooth
              di acara. Tinggalkan nama dan nomor WhatsApp-mu, nanti kami hubungi
              saat ada jadwal.
            </p>

            <form onSubmit={kirim} style={{
              background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: R_PERMUKAAN,
              padding: '24px 22px',
            }}>
              <div style={{ marginBottom: 18 }}>
                <label className="k-label" htmlFor="k-nama">Nama lengkap</label>
                <input
                  id="k-nama"
                  className="k-field"
                  value={nama}
                  onChange={(e) => setNama(e.target.value)}
                  autoComplete="name"
                  maxLength={80}
                  required
                />
              </div>

              <div style={{ marginBottom: 22 }}>
                <label className="k-label" htmlFor="k-wa">Nomor WhatsApp</label>
                <input
                  id="k-wa"
                  className="k-field"
                  value={telepon}
                  onChange={(e) => setTelepon(e.target.value)}
                  /* type tel, bukan number: type number membuang angka nol di
                     depan dan memunculkan tombol panah naik-turun yang tidak
                     ada gunanya untuk nomor telepon. */
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={20}
                  required
                />
              </div>

              {/* Kolom ini tidak wajib: tidak ada `required`, dan route
                  /api/karir menyimpannya sebagai null kalau dikosongkan.
                  Penandanya di label dihapus atas permintaan, jadi orang yang
                  tidak punya akun tetap bisa menekan kirim — kolomnya memang
                  tidak akan menahan mereka. */}
              <div style={{ marginBottom: 22 }}>
                <label className="k-label" htmlFor="k-sosmed">
                  Instagram atau media sosial lain
                </label>
                <input
                  id="k-sosmed"
                  className="k-field"
                  value={sosmed}
                  onChange={(e) => setSosmed(e.target.value)}
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  maxLength={120}
                />
              </div>

              <div className="k-hp" aria-hidden="true">
                <label htmlFor="k-website">Website</label>
                <input
                  id="k-website"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </div>

              {galat && (
                <p role="alert" style={{
                  fontSize: 13.5, color: C.aksen, lineHeight: 1.55, marginBottom: 16,
                  padding: '12px 14px', borderRadius: R_KENDALI,
                  background: 'rgba(212,43,34,.06)', border: '1px solid rgba(212,43,34,.20)',
                }}>
                  {galat}
                </p>
              )}

              <button className="k-btn" type="submit" disabled={sibuk}>
                {sibuk ? 'Mengirim...' : 'Daftar sekarang'}
              </button>
            </form>
          </>
        )}
      </div>

      {/* Isi footer sama dengan Landing.tsx. Satu perbedaan yang WAJIB:
          tautan bagian di sana ditulis "#paket", jangkar di halaman yang sama.
          Dari /karir jangkar itu tidak ada, jadi harus "/#paket" — kalau
          disalin mentah, tiga tautan pertama hanya menggeser halaman ini ke
          atas dan tidak membawa siapa pun ke halaman sewa. */}
      <footer className="k-foot">
        <div className="k-foot-in">
          <div className="k-sitefoot">
            <div className="k-col">
              <a className="k-foot-brand" href="/" aria-label="Pabrik Kenangan, ke halaman utama">
                <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110} />
              </a>
              <a href="/#paket">Paket sewa</a>
              <a href="/#galeri">Hasil cetakan</a>
              <a href="/#mesin">Spesifikasi unit</a>
            </div>
            <div className="k-col">
              <b>Hubungi</b>
              <a href={`https://wa.me/${WA}`}>WhatsApp 0895-0827-9690</a>
              <a href="https://instagram.com/pabrikenangan">@pabrikenangan</a>
              <a href="mailto:main@pabrikenangan.my.id">main@pabrikenangan.my.id</a>
            </div>
            <div className="k-col">
              <b>Lain-lain</b>
              {/* Langsung ke app supaya tidak singgah di pengalihan www -> app. */}
              <a href="https://app.pabrikenangan.my.id/login">Masuk dasbor</a>
              <a href="/#tanya">Tanya jawab</a>
            </div>
            <div className="k-end">
              <span>PABRIK KENANGAN &copy; 2026</span>
              <span>BANDAR LAMPUNG</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}
