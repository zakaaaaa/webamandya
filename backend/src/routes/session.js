const express = require('express');
const router = express.Router();
const { supabase, validateDevice } = require('../middleware/validateDevice');

// POST /api/photobooth/session/start  (dipanggil startSession() Flutter)
router.post('/start', validateDevice, async (req, res) => {
  const { transaction_code, amount, payment_method } = req.body;
  const { id: device_id, client_id } = req.device;

  if (!transaction_code) {
    return res.status(400).json({ success: false, message: 'transaction_code wajib diisi.' });
  }

  // Validasi voucher jika payment_method = 'voucher'
  let voucher_id = null;
  let final_amount = parseFloat(amount) || 0;
  let original_amount = final_amount;

  if (payment_method === 'voucher') {
    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: 'Kode voucher wajib diisi.' });
    }

    const { data: voucher, error: vErr } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', code)
      .eq('client_id', client_id)
      .eq('is_active', true)
      .single();

    if (vErr || !voucher) {
      return res.status(400).json({ success: false, message: 'Kode voucher tidak valid.' });
    }
    if (voucher.max_uses && voucher.used_count >= voucher.max_uses) {
      return res.status(400).json({ success: false, message: 'Voucher sudah habis digunakan.' });
    }
    if (voucher.valid_until && new Date() > new Date(voucher.valid_until)) {
      return res.status(400).json({ success: false, message: 'Voucher sudah expired.' });
    }

    // Hitung diskon
    if (voucher.discount_type === 'full')    final_amount = 0;
    if (voucher.discount_type === 'percent') final_amount = original_amount * (1 - voucher.discount_value / 100);
    if (voucher.discount_type === 'fixed')   final_amount = Math.max(0, original_amount - voucher.discount_value);

    voucher_id = voucher.id;

    // Increment used_count
    await supabase.from('vouchers').update({ used_count: voucher.used_count + 1 }).eq('id', voucher.id);
  }

  // Buat session di database
  const { data: session, error } = await supabase
    .from('sessions')
    .insert({
      transaction_code,
      device_id,
      client_id,
      voucher_id,
      payment_method: payment_method || 'qris',
      amount:          final_amount,
      original_amount: original_amount,
      payment_status:  (payment_method === 'voucher' || payment_method === 'bypass') ? 'free' : 'pending',
    })
    .select()
    .single();

  if (error) {
    console.error('Insert session error:', error);
    return res.status(500).json({ success: false, message: 'Gagal membuat sesi.' });
  }

  return res.status(201).json({ success: true, session_id: session.id });
});

module.exports = router;