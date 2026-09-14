const express = require('express');
const router = express.Router();
const { supabase, validateDevice } = require('../middleware/validateDevice');
const { resolveSettings } = require('../utils/settings');
const { KOLOM_SESI, rekonsiliasiSesi } = require('../utils/pembayaran');
const { STATUS_BELUM_LUNAS } = require('../utils/pembayaran-logika');
const { hargaSesi } = require('../utils/frame-categories');
const { hargaKategoriFrame, sesuaikanHargaSesi } = require('../utils/harga-sesi');

function metodeDiizinkan(settings) {
  return Array.isArray(settings.payment_methods_enabled)
    ? settings.payment_methods_enabled
    : ['qris', 'voucher'];
}

/**
 * Validasi voucher dan hitung harga akhirnya. Dipakai /start (app lama) dan
 * /redeem-voucher (sesi yang sudah ada).
 * @returns {Promise<{ gagal: object } | { voucher: object, final_amount: number }>}
 */
async function periksaVoucher({ settings, client_id, code, original_amount }) {
  const gagal = (message, kode) => ({ gagal: { success: false, message, code: kode } });

  if (!settings.voucher_enabled) {
    return gagal('Voucher tidak diaktifkan untuk unit ini.', 'VOUCHER_DISABLED');
  }
  if (!code) {
    return gagal('Kode voucher wajib diisi.', 'MISSING_VOUCHER_CODE');
  }

  const { data: voucher, error: vErr } = await supabase
    .from('vouchers')
    .select('*')
    .eq('code', code)
    .eq('client_id', client_id)
    .eq('is_active', true)
    .maybeSingle();

  if (vErr || !voucher) {
    return gagal('Kode voucher tidak valid.', 'VOUCHER_INVALID');
  }
  if (voucher.max_uses && voucher.used_count >= voucher.max_uses) {
    return gagal('Voucher sudah habis digunakan.', 'VOUCHER_EXHAUSTED');
  }
  if (voucher.valid_from && new Date() < new Date(voucher.valid_from)) {
    return gagal('Voucher belum berlaku.', 'VOUCHER_NOT_STARTED');
  }
  if (voucher.valid_until && new Date() > new Date(voucher.valid_until)) {
    return gagal('Voucher sudah expired.', 'VOUCHER_EXPIRED');
  }

  let final_amount = original_amount;
  if (voucher.discount_type === 'full')    final_amount = 0;
  if (voucher.discount_type === 'percent') final_amount = Math.round(original_amount * (1 - voucher.discount_value / 100));
  if (voucher.discount_type === 'fixed')   final_amount = Math.max(0, original_amount - voucher.discount_value);

  return { voucher, final_amount };
}

// Increment pemakaian voucher hanya setelah sesi benar-benar tersimpan.
async function catatPemakaianVoucher(voucher) {
  await supabase
    .from('vouchers')
    .update({ used_count: (voucher.used_count ?? 0) + 1 })
    .eq('id', voucher.id);
}

// POST /api/photobooth/session/start  (dipanggil startSession() Flutter)
//
// Flutter TIDAK pernah mengirim `amount` — harga selalu dihitung di server dari
// client_settings/device_settings supaya tidak bisa dimanipulasi dari sisi alat.
router.post('/start', validateDevice, async (req, res) => {
  const {
    transaction_code,
    payment_method = 'qris',
    transaction_type = 'session',
    extra_print_count = 0,
    code,
    frame_id,
  } = req.body;
  const { id: device_id, client_id } = req.device;

  if (!transaction_code) {
    return res.status(400).json({ success: false, message: 'transaction_code wajib diisi.', code: 'MISSING_TRANSACTION_CODE' });
  }

  try {
    const settings = await resolveSettings(client_id, device_id);

    if (!metodeDiizinkan(settings).includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Metode pembayaran tidak diaktifkan untuk unit ini.',
        code: 'UNSUPPORTED_PAYMENT_METHOD',
      });
    }

    // ── Hitung harga dasar dari setting ──
    let original_amount;
    let frameSah = null;
    if (transaction_type === 'extra_print') {
      if (!settings.extra_print_enabled) {
        return res.status(400).json({ success: false, message: 'Cetak tambahan tidak diaktifkan.', code: 'EXTRA_PRINT_DISABLED' });
      }
      const qty = parseInt(extra_print_count, 10);
      if (!Number.isInteger(qty) || qty <= 0) {
        return res.status(400).json({ success: false, message: 'Jumlah cetak tambahan tidak valid.', code: 'INVALID_EXTRA_PRINT_COUNT' });
      }
      original_amount = qty * Number(settings.extra_print_price ?? 0);
    } else {
      // App baru mengirim frame yang diketuk pelanggan; harga kategorinya
      // menimpa session_price. App lama tidak mengirimnya — harganya tetap
      // disamakan nanti di attach-frame dan /payment/generate.
      let info = { ada: false, harga: null };
      try {
        info = await hargaKategoriFrame(client_id, frame_id);
      } catch (e) {
        console.error('[Session] Harga frame gagal dibaca, pakai harga setelan:', e.message);
      }
      if (info.ada) frameSah = frame_id;
      original_amount = hargaSesi(settings, info.harga);
    }

    let final_amount = original_amount;
    let voucher_id = null;
    let voucher_row = null;

    // ── Voucher ──
    if (payment_method === 'voucher') {
      const hasil = await periksaVoucher({ settings, client_id, code, original_amount });
      if (hasil.gagal) return res.status(400).json(hasil.gagal);

      final_amount = hasil.final_amount;
      voucher_id = hasil.voucher.id;
      voucher_row = hasil.voucher;
    }

    const isFree = payment_method === 'voucher' || payment_method === 'bypass' || final_amount <= 0;

    const { data: session, error } = await supabase
      .from('sessions')
      .insert({
        transaction_code,
        device_id,
        client_id,
        voucher_id,
        payment_method,
        transaction_type,
        amount: final_amount,
        original_amount,
        payment_status: isFree ? 'free' : 'pending',
        paid_at: isFree ? new Date().toISOString() : null,
        ...(frameSah ? { frame_id: frameSah, selected_frame_id: frameSah, frame_locked_at: new Date().toISOString() } : {}),
      })
      .select()
      .single();

    if (error) {
      console.error('[Session] Insert error:', error);
      return res.status(500).json({ success: false, message: 'Gagal membuat sesi.', code: 'SESSION_INSERT_FAILED' });
    }

    if (voucher_row) {
      await catatPemakaianVoucher(voucher_row);
    }

    return res.status(201).json({
      success: true,
      session_id: session.id,
      amount: final_amount,
      original_amount,
      payment_status: session.payment_status,
    });
  } catch (e) {
    console.error('[Session] Error:', e);
    return res.status(500).json({ success: false, message: 'Server error.', code: 'SERVER_ERROR' });
  }
});

// PATCH /api/photobooth/session/attach-frame
// Dipanggil setelah user memilih frame supaya dashboard tahu frame mana yang dipakai.
router.patch('/attach-frame', validateDevice, async (req, res) => {
  const { session_uuid, frame_id } = req.body;
  const { client_id } = req.device;

  if (!session_uuid || !frame_id) {
    return res.status(400).json({ success: false, message: 'session_uuid dan frame_id wajib diisi.' });
  }

  try {
    const { data: frame } = await supabase
      .from('frames')
      .select('id')
      .eq('id', frame_id)
      .eq('client_id', client_id)
      .maybeSingle();

    if (!frame) {
      return res.status(404).json({ success: false, message: 'Frame tidak ditemukan untuk klien ini.' });
    }

    const { data: updated, error } = await supabase
      .from('sessions')
      .update({
        frame_id,
        selected_frame_id: frame_id,
        frame_locked_at: new Date().toISOString(),
      })
      .eq('transaction_code', session_uuid)
      .eq('client_id', client_id)
      .select(KOLOM_SESI)
      .maybeSingle();

    if (error) {
      console.error('[Session] Attach frame error:', error);
      return res.status(500).json({ success: false, message: 'Gagal menyimpan frame.' });
    }
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
    }

    // Pelanggan bisa kembali dari kamera dan memilih frame kategori lain di
    // sesi yang sama; harganya ikut berpindah selama sesi belum lunas.
    const sesi = await sesuaikanHargaSesi(updated);

    return res.json({ success: true, session_id: updated.id, frame_id, amount: Number(sesi.amount) });
  } catch (e) {
    console.error('[Session] Attach frame exception:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// PATCH /api/photobooth/session/media-status
// Dipanggil alat saat MULAI merakit video/GIF, supaya halaman unduh bisa
// menampilkan "sedang diproses" alih-alih terlihat seperti tidak ada filenya.
const MEDIA_STATES = ['pending', 'processing', 'ready', 'failed'];

router.patch('/media-status', validateDevice, async (req, res) => {
  const { session_uuid, video_status, gif_status } = req.body;
  const { client_id } = req.device;

  if (!session_uuid) {
    return res.status(400).json({ success: false, message: 'session_uuid wajib diisi.' });
  }

  const patch = {};
  if (video_status !== undefined) {
    if (!MEDIA_STATES.includes(video_status)) {
      return res.status(400).json({ success: false, message: 'video_status tidak valid.' });
    }
    patch.video_status = video_status;
  }
  if (gif_status !== undefined) {
    if (!MEDIA_STATES.includes(gif_status)) {
      return res.status(400).json({ success: false, message: 'gif_status tidak valid.' });
    }
    patch.gif_status = gif_status;
  }
  if (Object.keys(patch).length === 0) {
    return res.status(400).json({ success: false, message: 'Tidak ada status untuk diperbarui.' });
  }

  const { data: updated, error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('transaction_code', session_uuid)
    .eq('client_id', client_id)
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[Session] media-status error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status media.' });
  }
  if (!updated) {
    return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
  }

  return res.json({ success: true, ...patch });
});


// PATCH /api/photobooth/session/print-status
//
// Dipanggil PrintJobWatcher di app selama kertas keluar, supaya halaman unduh
// bisa menampilkan progres cetak. Cetak 4R makan menit-menitan (terukur
// 2026-09-06: satu lembar bertahan 4 menit 30 detik di antrian spooler), jadi
// tanpa ini pelanggan hanya bisa berdiri menunggu tanpa keterangan apa pun.
//
// Sumber datanya antrian spooler Windows, BUKAN sensor printer: 'done' berarti
// data cetakan sudah habis diterima printer. Lihat sql/2026-09-07_print_progress.sql.
const PRINT_STATES = ['queued', 'printing', 'done', 'stuck', 'failed'];

router.patch('/print-status', validateDevice, async (req, res) => {
  const {
    session_uuid,
    print_status,
    print_sheets_done,
    print_sheets_total,
    print_eta_seconds,
    print_reason,
  } = req.body;
  const { client_id } = req.device;

  if (!session_uuid) {
    return res.status(400).json({ success: false, message: 'session_uuid wajib diisi.' });
  }
  if (!PRINT_STATES.includes(print_status)) {
    return res.status(400).json({ success: false, message: 'print_status tidak valid.' });
  }

  const patch = { print_status };

  // Angka lembar datang dari app; dijaga di sini supaya nilai aneh tidak
  // pernah sampai ke UI pelanggan sebagai "lembar -1 dari 0".
  const asCount = (v) => {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };
  const done = asCount(print_sheets_done);
  const total = asCount(print_sheets_total);
  if (done !== null) patch.print_sheets_done = done;
  if (total !== null) patch.print_sheets_total = total;
  const eta = asCount(print_eta_seconds);
  if (eta !== null) patch.print_eta_seconds = eta;
  patch.print_reason = print_reason || null;

  const { data: existing } = await supabase
    .from('sessions')
    .select('id, print_started_at')
    .eq('transaction_code', session_uuid)
    .eq('client_id', client_id)
    .maybeSingle();

  if (!existing) {
    return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
  }

  // 'queued' adalah laporan PERTAMA dari sebuah cetakan, jadi ia selalu
  // menyetel ulang titik nolnya. Ini bukan detail kosmetik: pelanggan bisa
  // membeli cetakan tambahan di sesi yang sama, dan kalau waktu mulainya
  // tetap milik cetakan pertama, batang progres di HP-nya langsung mentok
  // sejak detik pertama cetakan kedua.
  //
  // Laporan berikutnya (printing/done/...) TIDAK boleh menggeser titik nol,
  // karena selisih mulai-selesai inilah bahan kalibrasi durasi per kertas.
  if (print_status === 'queued') {
    patch.print_started_at  = new Date().toISOString();
    patch.print_finished_at = null;
  } else if (!existing.print_started_at) {
    patch.print_started_at = new Date().toISOString();
  }
  if (print_status === 'done' || print_status === 'failed') {
    patch.print_finished_at = new Date().toISOString();
  }

  const { error } = await supabase
    .from('sessions')
    .update(patch)
    .eq('id', existing.id);

  if (error) {
    console.error('[Session] print-status error:', error);
    return res.status(500).json({ success: false, message: 'Gagal memperbarui status cetak.' });
  }

  return res.json({ success: true, ...patch });
});

// POST /api/photobooth/session/abandon  (dipanggil abandonSession() Flutter)
//
// Dipanggil ketika alur pembayaran QRIS berakhir TANPA pembayaran: link gagal
// dibuat, pelanggan menekan "Batalkan", atau halaman pembayaran ditutup.
//
// Kenapa perlu: baris sesi ditulis SEBELUM order DOKU dibuat (route /start di
// atas), jadi setiap pembatalan meninggalkan baris 'pending' yang tidak pernah
// tertutup. Pada audit 2026-08-28, 74 dari 109 sesi pending berasal dari sini
// dan tidak punya jejak apa pun di DOKU.
//
// Sejak 2026-09-14 app memanggilnya dari PhotoProvider.reset() — yaitu saat
// PELANGGAN pergi (timer habis / selesai), bukan per percobaan bayar: satu
// sesi kini bisa punya banyak invoice DOKU (lihat /payment/generate).
//
// Endpoint ini TIDAK pernah memutuskan sendiri bahwa sesi batal — semua
// invoice sesi ditanyakan ke DOKU lebih dulu (utils/pembayaran.js), supaya
// pembayaran yang webhook-nya belum sampai tidak ikut ditutup. Sesi sengaja
// DIBIARKAN 'pending' kalau DOKU tidak bisa dihubungi atau order-nya masih
// bisa dibayar; penyapu sesi (workers/penyapu-sesi.js) mencobanya lagi nanti.
router.post('/abandon', validateDevice, async (req, res) => {
  const { transaction_code } = req.body;
  const { id: device_id } = req.device;

  if (!transaction_code) {
    return res.status(400).json({ success: false, message: 'transaction_code wajib diisi.', code: 'MISSING_TRANSACTION_CODE' });
  }

  try {
    // Dibatasi ke perangkat pemilik sesi — satu unit tidak boleh menutup sesi unit lain.
    const { data: session, error } = await supabase
      .from('sessions')
      .select(KOLOM_SESI)
      .eq('transaction_code', transaction_code)
      .eq('device_id', device_id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.', code: 'SESSION_NOT_FOUND' });
    }

    // Idempoten: sesi yang sudah lunas/gratis/tertutup tidak pernah diubah.
    if (session.payment_status !== 'pending') {
      return res.status(200).json({ success: true, status: session.payment_status, changed: false });
    }

    const hasil = await rekonsiliasiSesi(session, { tutup: true });
    if (hasil.berubah) {
      console.log('[Session] Abandon', transaction_code, '→', hasil.status);
    } else {
      console.log('[Session] Abandon', transaction_code, '- dibiarkan', hasil.status,
        hasil.takTerjawab ? '(DOKU tidak menjawab)' : '(order masih bisa dibayar)');
    }
    return res.status(200).json({ success: true, status: hasil.status, changed: hasil.berubah });

  } catch (e) {
    console.error('[Session] Abandon error:', e);
    return res.status(500).json({ success: false, message: 'Server error.', code: 'SERVER_ERROR' });
  }
});

// POST /api/photobooth/session/redeem-voucher  (dipanggil redeemVoucher() Flutter)
//
// Memakai voucher untuk sesi yang SUDAH ada — sesi yang dibuat saat pelanggan
// memilih frame. Dulu voucher lewat /start yang selalu menyisipkan baris baru,
// sehingga tiap pelanggan voucher meninggalkan baris frame 'pending'.
router.post('/redeem-voucher', validateDevice, async (req, res) => {
  const { transaction_code, code } = req.body;
  const { id: device_id, client_id } = req.device;

  if (!transaction_code) {
    return res.status(400).json({ success: false, message: 'transaction_code wajib diisi.', code: 'MISSING_TRANSACTION_CODE' });
  }

  try {
    const { data: session, error } = await supabase
      .from('sessions')
      .select(KOLOM_SESI)
      .eq('transaction_code', transaction_code)
      .eq('device_id', device_id)
      .maybeSingle();
    if (error) throw new Error(error.message);

    if (!session) {
      return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.', code: 'SESSION_NOT_FOUND' });
    }

    const sudahSelesai = (status) => status === 'paid' || status === 'free';
    const tanpaVoucher = (status) =>
      res.status(200).json({ success: true, payment_status: status, voucher_used: false });

    if (sudahSelesai(session.payment_status)) return tanpaVoucher(session.payment_status);

    const settings = await resolveSettings(client_id, device_id);
    if (!metodeDiizinkan(settings).includes('voucher')) {
      return res.status(400).json({
        success: false,
        message: 'Metode pembayaran tidak diaktifkan untuk unit ini.',
        code: 'UNSUPPORTED_PAYMENT_METHOD',
      });
    }

    // QR yang sempat dipindai sebelum pelanggan beralih ke voucher bisa saja
    // sudah dibayar — jangan sampai kuota voucher ikut terpakai.
    const cek = await rekonsiliasiSesi(session);
    if (sudahSelesai(cek.status)) return tanpaVoucher(cek.status);

    // Diskon voucher dihitung dari harga kategori frame yang terakhir dipilih.
    const sesiBerharga = await sesuaikanHargaSesi(session);
    const original_amount = Number(sesiBerharga.original_amount ?? sesiBerharga.amount ?? 0);
    const hasil = await periksaVoucher({ settings, client_id, code, original_amount });
    if (hasil.gagal) return res.status(400).json(hasil.gagal);

    // Bersyarat pada status lama: kalau polling/webhook keburu menandai lunas,
    // voucher tidak dipakai.
    const { data: diubah, error: uErr } = await supabase
      .from('sessions')
      .update({
        payment_method: 'voucher',
        voucher_id: hasil.voucher.id,
        amount: hasil.final_amount,
        payment_status: 'free',
        paid_at: new Date().toISOString(),
      })
      .eq('id', session.id)
      .in('payment_status', STATUS_BELUM_LUNAS)
      .select('id')
      .maybeSingle();
    if (uErr) throw new Error(uErr.message);

    if (!diubah) {
      const { data: kini } = await supabase
        .from('sessions')
        .select('payment_status')
        .eq('id', session.id)
        .maybeSingle();
      return tanpaVoucher(kini?.payment_status ?? session.payment_status);
    }

    await catatPemakaianVoucher(hasil.voucher);

    return res.status(200).json({
      success: true,
      session_id: session.id,
      amount: hasil.final_amount,
      original_amount,
      payment_status: 'free',
      voucher_used: true,
    });
  } catch (e) {
    console.error('[Session] Redeem voucher error:', e);
    return res.status(500).json({ success: false, message: 'Server error.', code: 'SERVER_ERROR' });
  }
});

module.exports = router;
