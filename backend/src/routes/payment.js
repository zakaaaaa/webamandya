const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { generateSignature, generateSignatureGet, getTimestamp } = require('../utils/doku');

const DOKU_BASE_URL = process.env.DOKU_BASE_URL || 'https://api.doku.com';

// POST /api/payment/generate  (dipanggil generatePaymentLink() Flutter)
router.post('/generate', async (req, res) => {
  const { session_uuid } = req.body;

  try {
    // 1. Dapatkan sesi dan kredensial DOKU klien
    const { data: session, error: sessErr } = await supabase
      .from('sessions')
      .select('id, payment_status, client_id, amount, clients(doku_client_id, doku_secret_key)')
      .eq('transaction_code', session_uuid)
      .single();

    if (sessErr || !session) {
      console.error('[Payment] Session error:', sessErr);
      return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
    }

    if (session.payment_status === 'paid' || session.payment_status === 'free') {
      return res.status(400).json({ success: false, message: 'Transaksi ini sudah lunas.' });
    }

    const { doku_client_id, doku_secret_key } = session.clients || {};
    if (!doku_client_id || !doku_secret_key) {
      return res.status(400).json({ success: false, message: 'Kredensial DOKU belum diatur untuk klien ini.' });
    }

    // 2. Siapkan request ke DOKU Checkout
    const targetPath = '/checkout/v1/payment';
    const requestId = uuidv4();
    const timestamp = getTimestamp();
    const amountNum = parseInt(session.amount) || 0;

    const requestBody = {
      order: {
        invoice_number: session_uuid,
        amount: amountNum
      },
      payment: {
        payment_due_date: 30
      },
      customer: {
        name: 'Photobooth Customer',
        email: 'customer@photobooth.com'
      }
    };

    // 3. Generate Signature (HMAC SHA256 — simpel!)
    const signature = generateSignature(
      doku_client_id,
      doku_secret_key,
      requestId,
      timestamp,
      targetPath,
      requestBody
    );

    // 4. Hit DOKU Checkout API
    console.log('[Payment] Hitting DOKU Checkout for:', session_uuid);
    console.log('[Payment] URL:', `${DOKU_BASE_URL}${targetPath}`);
    console.log('[Payment] Body:', JSON.stringify(requestBody));
    console.log('[Payment] Headers:', JSON.stringify({
      'Client-Id': doku_client_id,
      'Request-Id': requestId,
      'Request-Timestamp': timestamp,
      'Signature': signature,
    }));

    const dokuResponse = await axios.post(`${DOKU_BASE_URL}${targetPath}`, requestBody, {
      headers: {
        'Client-Id': doku_client_id,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': signature,
        'Content-Type': 'application/json'
      }
    });

    console.log('[Payment] DOKU response:', JSON.stringify(dokuResponse.data));

    // 5. Ambil payment_url dari response
    const paymentUrl = dokuResponse.data?.response?.payment?.url;
    const qrContent = dokuResponse.data?.response?.payment?.qr_content;

    if (!paymentUrl) {
      console.error('[Payment] No payment URL in response:', JSON.stringify(dokuResponse.data));
      return res.status(500).json({ success: false, message: 'Gagal mendapatkan URL pembayaran.' });
    }

    return res.status(200).json({
      success: true,
      payment_url: paymentUrl,
      qr_content: qrContent || null,
      message: 'Berhasil generate link pembayaran'
    });

  } catch (error) {
    console.error('[Payment] Error:', error?.response?.data || error.message);
    return res.status(500).json({
      success: false,
      message: 'Gagal menghubungi Payment Gateway',
      error: error?.response?.data || error.message
    });
  }
});

// POST /api/payment/check-status  (polling tiap 2 detik dari Flutter)
//
// PENTING: jangan hanya membaca payment_status dari database. Webhook DOKU
// (/notification) tidak selalu dikonfigurasi di back office DOKU, sehingga status
// bisa tidak pernah berubah dan aplikasi mentok di halaman pembayaran.
// Karena itu di sini kita AKTIF menanyakan status order ke DOKU.
router.post('/check-status', async (req, res) => {
  const { session_uuid } = req.body;

  const { data: session } = await supabase
    .from('sessions')
    .select('id, payment_status, clients(doku_client_id, doku_secret_key)')
    .eq('transaction_code', session_uuid)
    .maybeSingle();

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
  }

  // Sudah lunas / gratis -> tidak perlu tanya DOKU lagi.
  if (session.payment_status === 'paid' || session.payment_status === 'free') {
    return res.status(200).json({ status: session.payment_status });
  }

  const { doku_client_id, doku_secret_key } = session.clients || {};
  if (!doku_client_id || !doku_secret_key) {
    return res.status(200).json({ status: session.payment_status });
  }

  try {
    const targetPath = `/orders/v1/status/${session_uuid}`;
    const requestId = uuidv4();
    const timestamp = getTimestamp();
    const signature = generateSignatureGet(doku_client_id, doku_secret_key, requestId, timestamp, targetPath);

    const dokuResponse = await axios.get(`${DOKU_BASE_URL}${targetPath}`, {
      headers: {
        'Client-Id': doku_client_id,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': signature,
      },
      timeout: 10000,
    });

    const txStatus = dokuResponse.data?.transaction?.status;

    if (txStatus === 'SUCCESS') {
      await supabase
        .from('sessions')
        .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
        .eq('id', session.id);

      console.log('[Payment] ✅ Terdeteksi LUNAS via polling DOKU:', session_uuid);
      return res.status(200).json({ status: 'paid' });
    }

    return res.status(200).json({ status: session.payment_status, doku_status: txStatus || null });
  } catch (error) {
    // Kalau DOKU tidak bisa dihubungi, jangan gagalkan polling —
    // kembalikan status terakhir yang tersimpan supaya app tetap menunggu.
    console.error('[Payment] Gagal cek status ke DOKU:', error?.response?.data || error.message);
    return res.status(200).json({ status: session.payment_status });
  }
});

// POST /api/payment/notification (DOKU Webhook — dipanggil DOKU saat customer bayar)
router.post('/notification', async (req, res) => {
  try {
    console.log('[Webhook] DOKU notification received:', JSON.stringify(req.body));

    // DOKU Checkout mengirim order.invoice_number di notification
    const invoiceNumber = req.body?.order?.invoice_number;
    if (!invoiceNumber) {
      return res.status(400).send('Invalid payload');
    }

    // Cari sesi
    const { data: session } = await supabase
      .from('sessions')
      .select('id, payment_status')
      .eq('transaction_code', invoiceNumber)
      .single();

    if (!session) {
      return res.status(404).send('Session not found');
    }

    if (session.payment_status === 'paid') {
      return res.status(200).send('Already paid');
    }

    // DOKU Checkout notification: transaction.status = 'SUCCESS'
    const txStatus = req.body?.transaction?.status;

    if (txStatus === 'SUCCESS') {
      await supabase
        .from('sessions')
        .update({ payment_status: 'paid' })
        .eq('transaction_code', invoiceNumber);

      console.log('[Webhook] ✅ Payment marked as PAID for:', invoiceNumber);
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

module.exports = router;