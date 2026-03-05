const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');

// POST /api/payment/generate  (dipanggil generatePaymentLink() Flutter)
// DOKU integration akan ditambahkan di Fase berikutnya
router.post('/generate', async (req, res) => {
  const { session_uuid, amount, device_id } = req.body;

  const { data: session } = await supabase
    .from('sessions')
    .select('id, payment_status')
    .eq('transaction_code', session_uuid)
    .single();

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
  }

  // TODO: Integrasi DOKU di sini nanti
  // Untuk sekarang return placeholder
  return res.status(200).json({
    success: true,
    qr_content: `https://placeholder-doku.com/pay/${session_uuid}`,
    message: 'DOKU integration coming soon'
  });
});

// POST /api/payment/check-status  (dipanggil checkPaymentStatus() Flutter - polling)
router.post('/check-status', async (req, res) => {
  const { session_uuid } = req.body;

  const { data: session } = await supabase
    .from('sessions')
    .select('payment_status')
    .eq('transaction_code', session_uuid)
    .single();

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
  }

  return res.status(200).json({
    status: session.payment_status,  // 'pending' | 'paid' | 'free'
  });
});

module.exports = router;