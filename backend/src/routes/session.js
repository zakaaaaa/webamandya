const express = require('express');
const router = express.Router();
const { supabase, validateDevice } = require('../middleware/validateDevice');
const { resolveSettings } = require('../utils/settings');

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
  } = req.body;
  const { id: device_id, client_id } = req.device;

  if (!transaction_code) {
    return res.status(400).json({ success: false, message: 'transaction_code wajib diisi.', code: 'MISSING_TRANSACTION_CODE' });
  }

  try {
    const settings = await resolveSettings(client_id, device_id);

    const allowedMethods = Array.isArray(settings.payment_methods_enabled)
      ? settings.payment_methods_enabled
      : ['qris', 'voucher'];

    if (!allowedMethods.includes(payment_method)) {
      return res.status(400).json({
        success: false,
        message: 'Metode pembayaran tidak diaktifkan untuk unit ini.',
        code: 'UNSUPPORTED_PAYMENT_METHOD',
      });
    }

    // ── Hitung harga dasar dari setting ──
    let original_amount;
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
      original_amount = Number(settings.session_price ?? 0);
    }

    let final_amount = original_amount;
    let voucher_id = null;
    let voucher_row = null;

    // ── Voucher ──
    if (payment_method === 'voucher') {
      if (!settings.voucher_enabled) {
        return res.status(400).json({ success: false, message: 'Voucher tidak diaktifkan untuk unit ini.', code: 'VOUCHER_DISABLED' });
      }
      if (!code) {
        return res.status(400).json({ success: false, message: 'Kode voucher wajib diisi.', code: 'MISSING_VOUCHER_CODE' });
      }

      const { data: voucher, error: vErr } = await supabase
        .from('vouchers')
        .select('*')
        .eq('code', code)
        .eq('client_id', client_id)
        .eq('is_active', true)
        .maybeSingle();

      if (vErr || !voucher) {
        return res.status(400).json({ success: false, message: 'Kode voucher tidak valid.', code: 'VOUCHER_INVALID' });
      }
      if (voucher.max_uses && voucher.used_count >= voucher.max_uses) {
        return res.status(400).json({ success: false, message: 'Voucher sudah habis digunakan.', code: 'VOUCHER_EXHAUSTED' });
      }
      if (voucher.valid_from && new Date() < new Date(voucher.valid_from)) {
        return res.status(400).json({ success: false, message: 'Voucher belum berlaku.', code: 'VOUCHER_NOT_STARTED' });
      }
      if (voucher.valid_until && new Date() > new Date(voucher.valid_until)) {
        return res.status(400).json({ success: false, message: 'Voucher sudah expired.', code: 'VOUCHER_EXPIRED' });
      }

      if (voucher.discount_type === 'full')    final_amount = 0;
      if (voucher.discount_type === 'percent') final_amount = Math.round(original_amount * (1 - voucher.discount_value / 100));
      if (voucher.discount_type === 'fixed')   final_amount = Math.max(0, original_amount - voucher.discount_value);

      voucher_id = voucher.id;
      voucher_row = voucher;
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
      })
      .select()
      .single();

    if (error) {
      console.error('[Session] Insert error:', error);
      return res.status(500).json({ success: false, message: 'Gagal membuat sesi.', code: 'SESSION_INSERT_FAILED' });
    }

    // Increment pemakaian voucher hanya setelah sesi benar-benar tersimpan.
    if (voucher_row) {
      await supabase
        .from('vouchers')
        .update({ used_count: (voucher_row.used_count ?? 0) + 1 })
        .eq('id', voucher_row.id);
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
      .select('id')
      .maybeSingle();

    if (error) {
      console.error('[Session] Attach frame error:', error);
      return res.status(500).json({ success: false, message: 'Gagal menyimpan frame.' });
    }
    if (!updated) {
      return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
    }

    return res.json({ success: true, session_id: updated.id, frame_id });
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

module.exports = router;
