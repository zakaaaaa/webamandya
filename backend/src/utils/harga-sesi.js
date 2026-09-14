// Harga sesi mengikuti kategori frame yang dipilih pelanggan.
//
// Kios membuat sesi (/start) saat pelanggan mengetuk frame, tapi pelanggan
// boleh kembali dari kamera dan memilih frame lain di sesi yang SAMA. Karena
// itu harga tidak cukup ditetapkan sekali di /start: amount sesi disamakan
// lagi dengan frame-nya di attach-frame, dan terakhir tepat sebelum invoice
// DOKU dibuat atau voucher dipakai — itulah angka yang benar-benar ditagih.
//
// Aturan harganya sendiri (murni, dites) ada di ./frame-categories.js.

const { supabase } = require('../middleware/validateDevice');
const { resolveSettings } = require('./settings');
const { hargaSesi } = require('./frame-categories');
const { STATUS_BELUM_LUNAS } = require('./pembayaran-logika');

/**
 * Harga kategori sebuah frame milik klien.
 * @returns {Promise<{ ada: boolean, harga: number|null }>}
 *   ada=false kalau frame tidak ditemukan untuk klien itu.
 */
async function hargaKategoriFrame(clientId, frameId) {
  if (!frameId) return { ada: false, harga: null };
  const { data, error } = await supabase
    .from('frames')
    .select('id, frame_categories(session_price)')
    .eq('id', frameId)
    .eq('client_id', clientId)
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca harga frame: ${error.message}`);
  if (!data) return { ada: false, harga: null };
  return { ada: true, harga: data.frame_categories?.session_price ?? null };
}

/**
 * Samakan amount sesi yang belum lunas dengan harga frame-nya.
 *
 * [frameId] opsional — frame yang dilaporkan app saat membayar, jaring
 * pengaman kalau attach-frame di latar gagal. Diabaikan kalau bukan milik
 * klien sesi.
 *
 * Tidak pernah melempar: gagal membaca harga tidak boleh menggagalkan
 * pembayaran pelanggan yang sedang berdiri di depan booth, jadi amount lama
 * dipakai dan kesalahannya dicatat.
 *
 * @returns {Promise<object>} sesi dengan amount/original_amount/frame_id terbaru.
 */
async function sesuaikanHargaSesi(sesi, { frameId } = {}) {
  // Cetak tambahan dihargai per lembar, bukan per frame.
  if (sesi.transaction_type && sesi.transaction_type !== 'session') return sesi;
  if (!STATUS_BELUM_LUNAS.includes(sesi.payment_status)) return sesi;

  try {
    let fid = sesi.frame_id || null;
    let info = null;
    if (frameId && frameId !== fid) {
      const dilapor = await hargaKategoriFrame(sesi.client_id, frameId);
      if (dilapor.ada) { fid = frameId; info = dilapor; }
    }
    if (!info) info = await hargaKategoriFrame(sesi.client_id, fid);

    const settings = await resolveSettings(sesi.client_id, sesi.device_id);
    const harga = hargaSesi(settings, info.harga);

    const patch = {};
    if (fid && fid !== sesi.frame_id) {
      patch.frame_id = fid;
      patch.selected_frame_id = fid;
    }
    if (Number(sesi.amount) !== harga || Number(sesi.original_amount) !== harga) {
      patch.amount = harga;
      patch.original_amount = harga;
    }
    if (Object.keys(patch).length === 0) return sesi;

    // Bersyarat pada status lama: kalau polling/webhook keburu menandai
    // lunas, harga sesi yang sudah dibayar tidak boleh berubah.
    const { data, error } = await supabase
      .from('sessions')
      .update(patch)
      .eq('id', sesi.id)
      .in('payment_status', STATUS_BELUM_LUNAS)
      .select('id')
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return sesi;

    if (patch.amount !== undefined) {
      console.log(`[Harga] Sesi ${sesi.transaction_code}: ${sesi.amount} → ${harga}`);
    }
    return { ...sesi, ...patch };
  } catch (e) {
    console.error(`[Harga] Gagal menyesuaikan harga sesi ${sesi.transaction_code}:`, e.message);
    return sesi;
  }
}

module.exports = { hargaKategoriFrame, sesuaikanHargaSesi };
