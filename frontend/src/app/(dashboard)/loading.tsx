/*
 * Kerangka yang tampil SEKETIKA saat pindah menu dasbor.
 *
 * Tanpa berkas ini Next menahan halaman lama sampai seluruh query halaman baru
 * selesai — klik menu terasa "tidak terjadi apa-apa" selama itu. Sidebar dan
 * layout tetap di tempat; hanya area konten yang diganti kerangka ini.
 */
export default function DashboardLoading() {
  return (
    <>
      <style>{`
        @keyframes pk-shimmer { from { background-position: -400px 0 } to { background-position: 400px 0 } }
        .pk-skel {
          border-radius: 20px;
          background: linear-gradient(90deg, rgba(212,43,34,0.05) 0%, rgba(212,43,34,0.09) 50%, rgba(212,43,34,0.05) 100%);
          background-size: 800px 100%;
          animation: pk-shimmer 1.2s linear infinite;
        }
        .pk-skel-grid { display: grid; gap: 16px; grid-template-columns: repeat(4, minmax(0, 1fr)); margin-bottom: 28px; }
        @media (max-width: 1100px) { .pk-skel-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); } }
        @media (max-width: 520px)  { .pk-skel-grid { grid-template-columns: minmax(0, 1fr); } }
        @media (prefers-reduced-motion: reduce) { .pk-skel { animation: none; } }
      `}</style>
      <div aria-busy="true" aria-label="Memuat halaman">
        <div className="pk-skel" style={{ width: 120, height: 12, marginBottom: 12, borderRadius: 6 }} />
        <div className="pk-skel" style={{ width: 220, height: 30, marginBottom: 32, borderRadius: 10 }} />
        <div className="pk-skel-grid">
          {[0, 1, 2, 3].map(i => <div key={i} className="pk-skel" style={{ height: 104 }} />)}
        </div>
        <div className="pk-skel" style={{ height: 360 }} />
      </div>
    </>
  )
}
