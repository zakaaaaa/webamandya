// Aturan pembayaran DOKU — sengaja TANPA I/O supaya bisa dites.
//
// Satu baris sesi = satu pelanggan. Setiap percobaan bayar QRIS menjadi satu
// invoice DOKU di tabel payment_invoices (lihat sql/2026-09-14_payment_invoices.sql).
// Sambungan ke Supabase/DOKU yang sebenarnya ada di ./pembayaran.js.

// DOKU Checkout membatasi order.invoice_number 64 karakter.
const MAKS_PANJANG_INVOICE = 64;

// Sesi yang tidak berubah selama ini dianggap ditinggal pelanggan. Timer sesi
// kiosk hanya beberapa menit dan order QRIS kedaluwarsa dalam 30 menit
// (payment_due_date di /payment/generate), jadi 45 menit sudah longgar.
const SESI_BASI_MS = 45 * 60 * 1000;

// DOKU yang menjawab 404 untuk invoice semuda ini belum tentu berarti order
// tidak ada — pembuatannya bisa masih berjalan. Diperlakukan sebagai 'open'.
const INVOICE_MUDA_MS = 10 * 60 * 1000;

// Status sesi yang masih boleh berubah menjadi lunas. 'expired' ikut karena
// pelanggan bisa membayar QR yang masih berlaku setelah sesinya ditutup.
const STATUS_BELUM_LUNAS = ['pending', 'expired', 'failed'];

function buatNomorInvoice(transactionCode, nowMs = Date.now()) {
  if (!transactionCode || typeof transactionCode !== 'string') {
    throw new Error('transaction_code kosong.');
  }
  const nomor = `${transactionCode}-p${nowMs.toString(36)}`;
  if (nomor.length > MAKS_PANJANG_INVOICE) {
    throw new Error(`Nomor invoice ${nomor.length} karakter, DOKU membatasi ${MAKS_PANJANG_INVOICE}.`);
  }
  return nomor;
}

/**
 * Terjemahkan jawaban GET /orders/v1/status/<invoice>.
 * @returns {'paid'|'expired'|'failed'|'open'|'not_found'|'unknown'}
 */
function klasifikasiStatusDoku(httpStatus, data) {
  if (httpStatus === 404) return 'not_found';
  if (!(httpStatus >= 200 && httpStatus < 300)) return 'unknown';

  const tx = data?.transaction?.status;
  const order = data?.order?.status;
  if (tx === 'SUCCESS') return 'paid';
  if (tx === 'FAILED') return 'failed';
  // QRIS yang tak jadi dibayar: transaction.status tetap 'PENDING' selamanya,
  // yang berubah hanya order.status (terverifikasi 23/23 order, 2026-08-28).
  if (order === 'ORDER_EXPIRED' || tx === 'EXPIRED') return 'expired';
  return 'open';
}

function kelasEfektif(kelas, umurMs) {
  if (kelas === 'not_found' && umurMs != null && umurMs < INVOICE_MUDA_MS) return 'open';
  return kelas;
}

/** Status baru untuk baris invoice, atau null kalau belum ada yang pasti. */
function statusInvoiceBaru(kelas) {
  switch (kelas) {
    case 'paid': return 'paid';
    case 'failed': return 'failed';
    case 'expired':
    case 'not_found': return 'expired';
    default: return null; // open, unknown
  }
}

/**
 * Status baru untuk sesi, atau null kalau tidak berubah.
 * [tutup] = pelanggan sudah pergi (abandon / penyapu / sesi basi).
 */
function putuskanStatusSesi(daftarKelas, tutup) {
  if (daftarKelas.includes('paid')) return 'paid';
  if (!tutup) return null;
  // Order yang masih bisa dibayar, atau DOKU yang tidak menjawab: belum bisa
  // dibuktikan tidak dibayar. Lebih baik menggantung sebentar daripada
  // menutup sesuatu yang ternyata lunas. Penyapu mencoba lagi nanti.
  if (daftarKelas.some((k) => k === 'open' || k === 'unknown')) return null;
  return 'expired';
}

function sesiBasi(updatedAt, nowMs = Date.now()) {
  const t = Date.parse(updatedAt);
  if (Number.isNaN(t)) return false;
  return nowMs - t > SESI_BASI_MS;
}

/**
 * Rakit fungsi rekonsiliasi dari operasi penyimpanan + DOKU yang disuntikkan.
 *
 * deps:
 *   ambilInvoice(sessionId)            -> [{ invoice_number, status, created_at }]
 *   simpanStatusInvoice(nomor, status) -> hanya mengubah baris yang masih 'pending'
 *   tandaiSesiLunas(sessionId)         -> status sesi SETELAH percobaan update
 *   tutupSesi(sessionId)               -> status sesi SETELAH percobaan update
 *   tanyaDoku(kredensial, nomor)       -> kelas dari klasifikasiStatusDoku
 *   peringatan({ sesi, invoices, statusAwal })  (opsional)
 *   peringatanKurangBayar({ sesi, invoices })   (opsional)
 */
function buatRekonsiliasi(deps) {
  const {
    ambilInvoice,
    simpanStatusInvoice,
    tandaiSesiLunas,
    tutupSesi,
    tanyaDoku,
    peringatan = () => {},
    peringatanKurangBayar = () => {},
    sekarang = () => Date.now(),
  } = deps;

  /**
   * sesi: { id, transaction_code, payment_status, clients: { doku_client_id, doku_secret_key } }
   * @returns {Promise<{ status: string, berubah: boolean, takTerjawab: boolean }>}
   */
  return async function rekonsiliasiSesi(sesi, { tutup = false } = {}) {
    const statusAwal = sesi.payment_status;
    const kred = sesi.clients || {};
    const adaKredensial = Boolean(kred.doku_client_id && kred.doku_secret_key);
    const sudahSelesai = statusAwal === 'paid' || statusAwal === 'free';

    const invoices = await ambilInvoice(sesi.id);
    let kandidat;
    if (invoices.length) {
      kandidat = invoices
        .filter((i) => i.status === 'pending')
        .map((i) => ({
          nomor: i.invoice_number,
          baris: true,
          umurMs: sekarang() - Date.parse(i.created_at),
          amount: i.amount ?? null,
        }));
    } else if (!sudahSelesai) {
      // Sesi dari app versi lama: invoice DOKU-nya = transaction_code, tanpa baris.
      kandidat = [{ nomor: sesi.transaction_code, baris: false, umurMs: null }];
    } else {
      kandidat = [];
    }

    const hasil = [];
    for (const k of kandidat) {
      const mentah = adaKredensial ? await tanyaDoku(kred, k.nomor) : 'not_found';
      hasil.push({ ...k, kelas: kelasEfektif(mentah, k.umurMs) });
    }

    for (const h of hasil) {
      if (!h.baris) continue;
      const st = statusInvoiceBaru(h.kelas);
      if (st) await simpanStatusInvoice(h.nomor, st);
    }

    const takTerjawab = hasil.some((h) => h.kelas === 'unknown');
    const lunas = hasil.filter((h) => h.kelas === 'paid');
    if (lunas.length && (sudahSelesai || lunas.length > 1)) {
      peringatan({ sesi, invoices: lunas.map((h) => h.nomor), statusAwal });
    }

    const keputusan = putuskanStatusSesi(hasil.map((h) => h.kelas), tutup);

    if (keputusan === 'paid') {
      // Harga sesi mengikuti kategori frame. Pelanggan yang pindah ke frame
      // lebih mahal SETELAH QR dibuat masih bisa membayar QR lama yang lebih
      // murah. Uangnya sudah masuk, jadi sesi tetap lunas — menahan pelanggan
      // di depan booth jauh lebih buruk — tapi operator harus tahu.
      const harga = Number(sesi.amount);
      const kurang = lunas.filter((h) => h.amount != null && Number(h.amount) < harga);
      if (harga > 0 && kurang.length && kurang.length === lunas.length) {
        peringatanKurangBayar({
          sesi,
          invoices: kurang.map((h) => ({ nomor: h.nomor, amount: Number(h.amount) })),
        });
      }
      const status = await tandaiSesiLunas(sesi.id);
      return { status, berubah: status !== statusAwal, takTerjawab };
    }
    if (keputusan === 'expired' && statusAwal === 'pending') {
      const status = await tutupSesi(sesi.id);
      return { status, berubah: status !== statusAwal, takTerjawab };
    }
    return { status: statusAwal, berubah: false, takTerjawab };
  };
}

module.exports = {
  MAKS_PANJANG_INVOICE,
  SESI_BASI_MS,
  INVOICE_MUDA_MS,
  STATUS_BELUM_LUNAS,
  buatNomorInvoice,
  klasifikasiStatusDoku,
  kelasEfektif,
  statusInvoiceBaru,
  putuskanStatusSesi,
  sesiBasi,
  buatRekonsiliasi,
};
