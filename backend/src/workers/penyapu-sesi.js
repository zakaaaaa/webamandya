// Penyapu sesi basi: menutup baris sesi 'pending' yang ditinggal pelanggan.
//
// App memanggil /session/abandon saat sesi berakhir tanpa bayar, tapi itu
// tidak menolong kalau kiosk mati listrik, app ditutup paksa, internet putus
// tepat saat itu, atau order QRIS masih bisa dibayar ketika pelanggan pergi
// (abandon sengaja membiarkannya pending). Penyapu ini jaring pengamannya:
// setiap sesi yang lama tidak berubah direkonsiliasi ke DOKU dengan aturan
// yang sama persis — lunas jadi 'paid', terbukti tak dibayar jadi 'expired',
// dan DOKU yang tidak menjawab membuatnya menunggu putaran berikutnya.

const { supabase } = require('../middleware/validateDevice');
const { KOLOM_SESI, rekonsiliasiSesi } = require('../utils/pembayaran');
const { SESI_BASI_MS } = require('../utils/pembayaran-logika');

const JEDA_MS = 10 * 60 * 1000;
const PER_HALAMAN = 50;
// Batas per putaran supaya DOKU tidak dibanjiri kalau tumpukannya besar.
const MAKS_HALAMAN = 4;

let berjalan = false;

async function putaran() {
  if (berjalan) return;
  berjalan = true;
  const hitung = { paid: 0, expired: 0, tertahan: 0, gagal: 0 };
  try {
    const batas = new Date(Date.now() - SESI_BASI_MS).toISOString();

    for (let halaman = 0; halaman < MAKS_HALAMAN; halaman++) {
      // Sesi yang tertahan (order masih terbuka / DOKU diam) tetap pending
      // dan tetap paling tua, jadi halaman berikutnya dilompati lewat offset
      // sebanyak yang tertahan — bukan PER_HALAMAN, karena yang ditutup
      // sudah keluar dari hasil query.
      const offset = hitung.tertahan + hitung.gagal;
      const { data, error } = await supabase
        .from('sessions')
        .select(KOLOM_SESI)
        .eq('payment_status', 'pending')
        .lt('updated_at', batas)
        .order('updated_at', { ascending: true })
        .range(offset, offset + PER_HALAMAN - 1);

      if (error) {
        console.error('[Penyapu] Gagal membaca sesi:', error.message);
        break;
      }
      if (!data || !data.length) break;

      for (const sesi of data) {
        try {
          const hasil = await rekonsiliasiSesi(sesi, { tutup: true });
          if (hasil.status === 'paid') hitung.paid++;
          else if (hasil.status === 'pending') hitung.tertahan++;
          else hitung.expired++;
        } catch (e) {
          hitung.gagal++;
          console.error('[Penyapu] Gagal merekonsiliasi', sesi.transaction_code, '-', e.message);
        }
      }
      if (data.length < PER_HALAMAN) break;
    }

    const total = hitung.paid + hitung.expired + hitung.tertahan + hitung.gagal;
    if (total) {
      console.log(`[Penyapu] ${total} sesi basi: ${hitung.expired} ditutup, ${hitung.paid} ternyata lunas, ` +
        `${hitung.tertahan} dibiarkan pending, ${hitung.gagal} gagal.`);
    }
  } catch (e) {
    console.error('[Penyapu] Kesalahan putaran:', e.message);
  } finally {
    berjalan = false;
  }
}

function mulai() {
  setInterval(putaran, JEDA_MS).unref();
  console.log(`[Penyapu] Aktif — menutup sesi pending yang basi setiap ${JEDA_MS / 60000} menit.`);
  putaran();
}

module.exports = { mulai, putaran };
