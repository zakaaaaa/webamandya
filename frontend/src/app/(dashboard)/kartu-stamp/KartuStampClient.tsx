'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Check, Copy, ExternalLink, Gift, Instagram, Search } from 'lucide-react'

import { createClient } from '@/lib/supabase'
import { formatWaktu } from '@/lib/waktu'
import { JUMLAH_STAMP, gambarKecil } from '@/lib/stamp'

export type KartuAdmin = {
  id: string; kode: string; ig_username: string | null; diajukan_at: string | null
  voucher_kode: string | null; hadiah_at: string | null; created_at: string
  stamps: { urutan: number; kode_sesi: string; gambar: string | null; tanggal_sesi: string; harga: number | null }[]
}

type Tab = 'menunggu' | 'mengumpulkan' | 'selesai'

const ABJAD = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
const kodeVoucher = (kodeKartu: string) =>
  'FREE' + kodeKartu.replace('PK-', '').slice(0, 4) +
  Array.from({ length: 3 }, () => ABJAD[Math.floor(Math.random() * ABJAD.length)]).join('')

const pesanDm = (k: KartuAdmin, kode: string) =>
  `Halo @${k.ig_username}! Makasih sudah pamerin Papan Kenangan-mu 💛\n` +
  `Sesuai janji, ini voucher 1 sesi GRATIS buat kamu: ${kode}\n` +
  `Masukkan kodenya di booth waktu pilih pembayaran. Yuk, mulai papan barumu! 📸`

export default function KartuStampClient({ kartu, clientId }: { kartu: KartuAdmin[]; clientId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const [tab, setTab] = useState<Tab>('menunggu')
  const [cari, setCari] = useState('')
  const [sibuk, setSibuk] = useState<string | null>(null)
  const [galat, setGalat] = useState('')
  const [tersalin, setTersalin] = useState<string | null>(null)

  const kelompok = useMemo(() => ({
    menunggu: kartu.filter((k) => k.diajukan_at && !k.hadiah_at),
    mengumpulkan: kartu.filter((k) => !k.diajukan_at && !k.hadiah_at),
    selesai: kartu.filter((k) => k.hadiah_at),
  }), [kartu])

  const tampil = kelompok[tab].filter((k) => {
    const q = cari.trim().toLowerCase().replace(/^@/, '')
    return !q || k.kode.toLowerCase().includes(q) || (k.ig_username ?? '').includes(q)
  })

  async function salin(teks: string, id: string) {
    try { await navigator.clipboard.writeText(teks); setTersalin(id); setTimeout(() => setTersalin(null), 1500) } catch {}
  }

  async function beriVoucher(k: KartuAdmin) {
    if (!confirm(`Buat voucher sesi gratis untuk papan ${k.kode} (@${k.ig_username})?\nPastikan postingan IG-nya sudah dicek.`)) return
    setSibuk(k.id); setGalat('')
    try {
      // Kode bentrok praktis mustahil, tapi tetap dicoba ulang sekali dua kali.
      let kode = '', voucherId = ''
      for (let i = 0; i < 3 && !voucherId; i++) {
        kode = kodeVoucher(k.kode)
        const { data, error } = await supabase.from('vouchers').insert({
          code: kode, client_id: clientId,
          // 'test' = sesi gratis (Rp0), tidak masuk pendapatan dan tidak
          // menghasilkan stamp baru di kartu berikutnya.
          kind: 'test', discount_type: 'full', discount_value: 100,
          max_uses: 1, valid_until: null, is_active: true,
        }).select('id').single()
        if (data) voucherId = data.id
        else if (error && error.code !== '23505') throw new Error(error.message)
      }
      if (!voucherId) throw new Error('Kode voucher bentrok, coba lagi.')

      const { error } = await supabase.from('stamp_cards')
        .update({ voucher_id: voucherId, voucher_kode: kode, hadiah_at: new Date().toISOString() })
        .eq('id', k.id)
      if (error) throw new Error(error.message)

      await salin(pesanDm(k, kode), k.id + 'dm')
      router.refresh()
    } catch (e) {
      setGalat((e as Error).message)
    } finally {
      setSibuk(null)
    }
  }

  return (
    <>
      <style>{`
        @keyframes fade-up{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:none}}
        .ks{font-family:'Poppins',sans-serif;animation:fade-up .45s ease both}
        .ks .btn{display:inline-flex;align-items:center;gap:6px;padding:8px 14px;border-radius:10px;font-size:13px;font-weight:600;cursor:pointer;border:1px solid transparent;font-family:inherit;transition:all .2s;text-decoration:none}
        .ks .btn:disabled{opacity:.45;cursor:not-allowed}
        .ks .merah{background:linear-gradient(135deg,#E83530,#C02018);color:#fff;box-shadow:0 4px 16px rgba(212,43,34,.3)}
        .ks .muda{background:rgba(212,43,34,.08);color:#C02018;border-color:rgba(212,43,34,.15)}
        .ks .tabs{display:flex;gap:6px;flex-wrap:wrap;margin-bottom:16px}
        .ks .tab{padding:8px 14px;border-radius:999px;border:1px solid rgba(212,43,34,.12);background:#fff;color:rgba(74,46,34,.9);font:600 13px Poppins,sans-serif;cursor:pointer}
        .ks .tab.on{background:#150C09;color:#fff;border-color:#150C09}
        .ks .tab b{margin-left:6px;opacity:.6}
        .ks .cari{position:relative;max-width:320px;margin-bottom:18px}
        .ks .cari input{width:100%;padding:9px 12px 9px 36px;border-radius:10px;border:1px solid rgba(212,43,34,.1);background:rgba(212,43,34,.04);font:13px Poppins,sans-serif;outline:none}
        .ks .cari svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(122,98,89,.8)}
        .ks .daftar{display:grid;gap:14px}
        .ks .kartu{padding:18px;border-radius:16px}
        .ks .atas{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap;margin-bottom:14px}
        .ks .kode{font:700 17px monospace;letter-spacing:2px;color:#150C09}
        .ks .meta{font-size:12px;color:rgba(122,98,89,.9);margin-top:2px}
        .ks .ig{display:inline-flex;align-items:center;gap:5px;color:#C02018;font-weight:600;font-size:14px;text-decoration:none}
        .ks .strips{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:8px}
        .ks .strip{border-radius:8px;overflow:hidden;background:rgba(212,43,34,.05);aspect-ratio:2/3;display:block;position:relative}
        .ks .strip img{width:100%;height:100%;object-fit:contain;display:block}
        .ks .strip.kosong{border:2px dashed rgba(212,43,34,.15);display:grid;place-items:center;color:rgba(122,98,89,.6);font-weight:700}
        .ks .tgl{font-size:11px;color:rgba(122,98,89,.9);margin-top:4px;text-align:center;line-height:1.3}
        .ks .aksi{display:flex;gap:8px;flex-wrap:wrap;margin-top:14px}
        .ks .vc{display:inline-flex;align-items:center;gap:8px;padding:6px 12px;border-radius:10px;background:rgba(16,185,129,.1);color:#047857;font:700 14px monospace;letter-spacing:1.5px}
        .ks .kosong-daftar{padding:40px 20px;text-align:center;color:rgba(122,98,89,.85);font-size:14px}
        @media (max-width:520px){.ks .strips{gap:5px}.ks .kartu{padding:14px}}
      `}</style>

      <div className="ks">
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
            <div style={{ width: 3, height: 20, borderRadius: 2, background: 'linear-gradient(to bottom,#E83530,#D42B22)' }} />
            <p style={{ color: 'rgba(122,98,89,0.8)', fontSize: 11, fontWeight: 600, letterSpacing: '2.5px', textTransform: 'uppercase' }}>Admin · Promo</p>
          </div>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ color: '#150C09', fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Papan Kenangan</h1>
              <p style={{ color: 'rgba(122,98,89,0.8)', fontSize: 14 }}>Foto {JUMLAH_STAMP}x, yang ke-{JUMLAH_STAMP + 1} gratis. Cek postingan IG pelanggan, lalu kirim vouchernya.</p>
            </div>
            <a className="btn muda" href="https://www.pabrikenangan.my.id/stamp" target="_blank" rel="noreferrer">
              <ExternalLink size={14} />Halaman pelanggan
            </a>
          </div>
          {galat && <p style={{ marginTop: 12, padding: '10px 14px', borderRadius: 10, background: 'rgba(212,43,34,.08)', color: '#C02018', fontSize: 13 }}>{galat}</p>}
        </div>

        <div className="tabs">
          {([['menunggu', 'Menunggu voucher'], ['mengumpulkan', 'Masih mengumpulkan'], ['selesai', 'Voucher terkirim']] as [Tab, string][]).map(([t, l]) => (
            <button key={t} className={`tab${tab === t ? ' on' : ''}`} onClick={() => setTab(t)}>{l}<b>{kelompok[t].length}</b></button>
          ))}
        </div>

        <div className="cari">
          <Search size={14} />
          <input value={cari} onChange={(e) => setCari(e.target.value)} placeholder="Cari kode papan / username IG" />
        </div>

        <div className="daftar">
          {tampil.length === 0 && <div className="glass-card kosong-daftar">Belum ada papan di sini.</div>}
          {tampil.map((k) => (
            <div key={k.id} className="glass-card kartu">
              <div className="atas">
                <div>
                  <div className="kode">{k.kode}</div>
                  <div className="meta">
                    {k.stamps.length}/{JUMLAH_STAMP} kenangan · papan dibuat {formatWaktu(k.created_at)}
                    {k.diajukan_at && <> · diajukan {formatWaktu(k.diajukan_at)}</>}
                  </div>
                </div>
                {k.ig_username && (
                  <a className="ig" href={`https://instagram.com/${k.ig_username}`} target="_blank" rel="noreferrer">
                    <Instagram size={16} />@{k.ig_username}
                  </a>
                )}
              </div>

              <div className="strips">
                {Array.from({ length: JUMLAH_STAMP }, (_, i) => {
                  const s = k.stamps.find((x) => x.urutan === i + 1)
                  if (!s) return <div key={i}><div className="strip kosong">{i + 1}</div></div>
                  return (
                    <div key={i}>
                      <a className="strip" href={`/download/${s.kode_sesi}`} target="_blank" rel="noreferrer" title={s.kode_sesi}>
                        {s.gambar && <img src={gambarKecil(s.gambar, 256)} alt={`Stamp ${i + 1}`} loading="lazy" />}
                      </a>
                      <div className="tgl">{formatWaktu(s.tanggal_sesi)}</div>
                    </div>
                  )
                })}
              </div>

              <div className="aksi">
                {tab === 'menunggu' && (
                  <button className="btn merah" disabled={sibuk === k.id} onClick={() => beriVoucher(k)}>
                    <Gift size={14} />{sibuk === k.id ? 'Membuat…' : 'Postingan OK, buat voucher'}
                  </button>
                )}
                {k.voucher_kode && (
                  <>
                    <span className="vc">{k.voucher_kode}</span>
                    <button className="btn muda" onClick={() => salin(pesanDm(k, k.voucher_kode!), k.id + 'dm')}>
                      {tersalin === k.id + 'dm' ? <Check size={14} /> : <Copy size={14} />}
                      {tersalin === k.id + 'dm' ? 'Pesan DM tersalin' : 'Salin pesan DM'}
                    </button>
                    {k.hadiah_at && <span className="meta" style={{ alignSelf: 'center' }}>dikirim {formatWaktu(k.hadiah_at)}</span>}
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}
