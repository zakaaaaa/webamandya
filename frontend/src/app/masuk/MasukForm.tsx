'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

/*
 * HALAMAN MASUK DASH
 *
 * Design read: satu kolom sandi, dibuka sesekali oleh satu-dua orang yang
 * sudah tahu apa ini. Tidak ada yang perlu dijelaskan, dijual, atau dinavigasi.
 * VARIANCE 2 / MOTION 1 / DENSITY 1.
 *
 * Mengikuti sistem dasbor: latar #FAF7F5, kartu putih radius 20, aksen merah
 * merek, Poppins, tombol clay yang sama dengan /karir.
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

export default function MasukForm() {
  const router = useRouter()
  const [sandi, setSandi] = useState('')
  const [sibuk, setSibuk] = useState(false)
  const [galat, setGalat] = useState<string | null>(null)

  async function kirim(e: React.FormEvent) {
    e.preventDefault()
    if (sibuk) return
    setSibuk(true)
    setGalat(null)
    try {
      const r = await fetch('/api/talent/masuk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sandi }),
      })
      const data = await r.json()
      if (!r.ok) {
        setGalat(data.error || 'Gagal masuk.')
        setSandi('')
        return
      }
      // refresh() dulu supaya proxy membaca cookie yang baru disetel;
      // push() saja bisa disajikan dari cache klien dan memantul kembali ke sini.
      router.replace('/')
      router.refresh()
    } catch {
      setGalat('Tidak ada koneksi.')
    } finally {
      setSibuk(false)
    }
  }

  return (
    <div style={{
      minHeight: '100dvh', background: C.ground, color: C.teks,
      fontFamily: "'Poppins',sans-serif",
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&display=swap');
        *, *::before, *::after { box-sizing:border-box; }
        .m-btn { border:none; font-family:inherit; font-weight:700; cursor:pointer;
                 width:100%; padding:16px 20px; font-size:15px; color:#fff;
                 position:relative; overflow:hidden; border-radius:14px;
                 background:linear-gradient(160deg,#E83530 0%,#D42B22 55%,#C02018 100%);
                 box-shadow:inset 0 2px 3px rgba(255,255,255,0.28),
                            0 8px 24px rgba(180,30,20,0.28);
                 transition:transform .25s cubic-bezier(0.34,1.56,0.64,1), box-shadow .25s ease; }
        .m-btn:hover:not(:disabled) { transform:translateY(-3px);
          box-shadow:inset 0 2px 3px rgba(255,255,255,0.32), 0 14px 32px rgba(180,30,20,0.34); }
        .m-btn:active:not(:disabled) { transform:translateY(1px);
          box-shadow:inset 0 4px 8px rgba(120,18,12,0.42), 0 3px 10px rgba(180,30,20,0.18); }
        .m-btn:disabled { cursor:default; transform:none;
          background:linear-gradient(160deg,#E5A5A1 0%,#DB9C97 55%,#D0928D 100%);
          box-shadow:inset 0 2px 3px rgba(255,255,255,0.22); }
        .m-field { width:100%; padding:15px 16px; border-radius:14px; font-family:inherit;
                   font-size:16px; border:1px solid ${C.garis}; background:${C.papan};
                   color:${C.teks}; transition:border-color .18s, box-shadow .18s; }
        .m-field:focus { outline:none; border-color:${C.aksen};
                         box-shadow:0 0 0 3px rgba(212,43,34,.14); }
        @media (prefers-reduced-motion: reduce) { .m-btn, .m-field { transition:none; } }
      `}</style>

      <div style={{ width: '100%', maxWidth: 360 }}>
        <img src="/logo-pk.webp" alt="Pabrik Kenangan" width={196} height={110}
          style={{ width: 104, height: 'auto', display: 'block', margin: '0 auto 26px' }} />

        <form onSubmit={kirim} style={{
          background: C.papan, border: `1px solid ${C.garisTipis}`, borderRadius: 20,
          padding: '26px 24px',
          boxShadow: '0 2px 12px rgba(212,43,34,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 18 }}>
            <Lock size={16} strokeWidth={2} color={C.aksen} />
            <h1 style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.01em' }}>Talent Pool</h1>
          </div>

          <label htmlFor="m-sandi" style={{
            display: 'block', fontSize: 13, fontWeight: 600, color: C.teks2, marginBottom: 7,
          }}>
            Kata sandi
          </label>
          <input
            id="m-sandi"
            className="m-field"
            type="password"
            value={sandi}
            onChange={(e) => setSandi(e.target.value)}
            autoComplete="current-password"
            autoFocus
            required
            style={{ marginBottom: 18 }}
          />

          {galat && (
            <p role="alert" style={{
              fontSize: 13.5, color: C.aksen, lineHeight: 1.5, marginBottom: 16,
              padding: '11px 13px', borderRadius: 14,
              background: 'rgba(212,43,34,.06)', border: '1px solid rgba(212,43,34,.20)',
            }}>
              {galat}
            </p>
          )}

          <button className="m-btn" type="submit" disabled={sibuk}>
            {sibuk ? 'Memeriksa...' : 'Masuk'}
          </button>
        </form>

        <p style={{ fontSize: 12, color: C.teks3, textAlign: 'center', marginTop: 16 }}>
          dash.pabrikenangan.my.id
        </p>
      </div>
    </div>
  )
}
