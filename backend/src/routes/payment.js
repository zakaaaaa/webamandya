const express = require('express');
const router = express.Router();
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../middleware/validateDevice');
const { generateSignature, getTimestamp } = require('../utils/doku');
const {
  KOLOM_SESI,
  DOKU_BASE_URL,
  rekonsiliasiSesi,
  buatInvoice,
  simpanStatusInvoice,
  bukaKembaliSesi,
} = require('../utils/pembayaran');
const { sesiBasi } = require('../utils/pembayaran-logika');
const { sesuaikanHargaSesi } = require('../utils/harga-sesi');

async function cariSesi(transactionCode) {
  const { data, error } = await supabase
    .from('sessions')
    .select(KOLOM_SESI)
    .eq('transaction_code', transactionCode)
    .maybeSingle();
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  return data;
}

// POST /api/payment/generate  (dipanggil generatePaymentLink() Flutter)
//
// Satu sesi boleh punya banyak percobaan bayar ("Coba Lagi", kembali ke menu
// lalu QRIS lagi). Tiap panggilan membuat invoice DOKU BARU yang menempel ke
// baris sesi yang sama — invoice_number tidak boleh dipakai dua kali di DOKU,
// dan dulu itulah alasan kiosk membuat baris sesi kedua yang lalu mengendap
// 'pending' di dasbor.
router.post('/generate', async (req, res) => {
  // frame_id opsional (app baru): frame yang sedang dipakai pelanggan, jaring
  // pengaman kalau attach-frame di latar gagal. Diperiksa milik klien sesi.
  // paper_type opsional: kertas pilihan pelanggan di frame newspaper A4.
  const { session_uuid, frame_id, paper_type } = req.body;

  if (!session_uuid) {
    return res.status(400).json({ success: false, message: 'session_uuid wajib diisi.' });
  }

  try {
    // 1. Dapatkan sesi dan kredensial DOKU klien
    const session = await cariSesi(session_uuid);
    if (!session) {
      return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
    }

    if (session.payment_status === 'paid' || session.payment_status === 'free') {
      return res.status(400).json({ success: false, message: 'Transaksi ini sudah lunas.', status: session.payment_status });
    }

    const { doku_client_id, doku_secret_key } = session.clients || {};
    if (!doku_client_id || !doku_secret_key) {
      return res.status(400).json({ success: false, message: 'Kredensial DOKU belum diatur untuk klien ini.' });
    }

    // 2. QR lama bisa saja sudah dibayar tepat sebelum pelanggan menekan
    //    "Coba Lagi" — jangan sampai ia ditagih dua kali.
    const cek = await rekonsiliasiSesi(session);
    if (cek.status === 'paid' || cek.status === 'free') {
      return res.status(400).json({ success: false, message: 'Transaksi ini sudah lunas.', status: cek.status });
    }

    // 3. Catat invoice SEBELUM order dibuat, supaya webhook dan polling
    //    selalu bisa menemukan sesinya.
    //    Harga ditetapkan ulang dari kategori frame tepat sebelum ditagih —
    //    inilah angka yang benar-benar masuk ke order DOKU.
    const sesiBerharga = await sesuaikanHargaSesi(session, { frameId: frame_id, paperType: paper_type });
    const amountNum = parseInt(sesiBerharga.amount) || 0;
    const invoiceNumber = await buatInvoice(sesiBerharga, amountNum);

    const targetPath = '/checkout/v1/payment';
    const requestId = uuidv4();
    const timestamp = getTimestamp();

    const requestBody = {
      order: {
        invoice_number: invoiceNumber,
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

    const signature = generateSignature(
      doku_client_id,
      doku_secret_key,
      requestId,
      timestamp,
      targetPath,
      requestBody
    );

    // 4. Hit DOKU Checkout API
    console.log('[Payment] Hitting DOKU Checkout for:', session_uuid, 'invoice:', invoiceNumber);
    console.log('[Payment] Body:', JSON.stringify(requestBody));

    let dokuResponse;
    try {
      dokuResponse = await axios.post(`${DOKU_BASE_URL}${targetPath}`, requestBody, {
        headers: {
          'Client-Id': doku_client_id,
          'Request-Id': requestId,
          'Request-Timestamp': timestamp,
          'Signature': signature,
          'Content-Type': 'application/json'
        },
        timeout: 30000,
      });
    } catch (error) {
      // 4xx = DOKU menolak, order pasti tidak terbentuk. Selain itu (timeout,
      // 5xx) order MUNGKIN terbentuk, jadi invoice dibiarkan 'pending' dan
      // rekonsiliasi yang memastikan nanti.
      const kode = error?.response?.status;
      if (kode >= 400 && kode < 500) {
        await simpanStatusInvoice(invoiceNumber, 'failed').catch((e) =>
          console.error('[Payment] Gagal menandai invoice failed:', e.message));
      }
      throw error;
    }

    console.log('[Payment] DOKU response:', JSON.stringify(dokuResponse.data));

    // 5. Ambil payment_url dari response
    const paymentUrl = dokuResponse.data?.response?.payment?.url;
    const qrContent = dokuResponse.data?.response?.payment?.qr_content;

    if (!paymentUrl) {
      console.error('[Payment] No payment URL in response:', JSON.stringify(dokuResponse.data));
      return res.status(500).json({ success: false, message: 'Gagal mendapatkan URL pembayaran.' });
    }

    // Sesi yang sempat ditutup (penyapu/abandon) tapi dipakai lagi oleh kiosk
    // harus kembali 'pending' selama ada order yang bisa dibayar.
    if (session.payment_status !== 'pending') {
      await bukaKembaliSesi(session.id);
    }

    return res.status(200).json({
      success: true,
      payment_url: paymentUrl,
      qr_content: qrContent || null,
      invoice_number: invoiceNumber,
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

// POST /api/payment/check-status  (polling tiap 2 detik dari Flutter, dan
// tombol "Cek DOKU" di dasbor transaksi)
//
// PENTING: jangan hanya membaca payment_status dari database. Webhook DOKU
// (/notification) tidak selalu dikonfigurasi di back office DOKU, sehingga status
// bisa tidak pernah berubah dan aplikasi mentok di halaman pembayaran.
// Karena itu di sini kita AKTIF menanyakan SEMUA invoice sesi yang masih
// terbuka ke DOKU — termasuk QR lama dari percobaan sebelumnya.
router.post('/check-status', async (req, res) => {
  const { session_uuid } = req.body;

  let session;
  try {
    session = session_uuid ? await cariSesi(session_uuid) : null;
  } catch (e) {
    console.error('[Payment] check-status:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal membaca sesi.' });
  }

  if (!session) {
    return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });
  }

  // Sudah lunas / gratis -> tidak perlu tanya DOKU lagi.
  if (session.payment_status === 'paid' || session.payment_status === 'free') {
    return res.status(200).json({ status: session.payment_status });
  }

  try {
    // Sesi yang lama tidak berubah berarti pelanggannya sudah pergi: boleh
    // ditutup kalau DOKU membuktikan tidak ada yang dibayar. Sesi yang masih
    // berjalan TIDAK ditutup — pelanggan mungkin sedang mencoba lagi.
    const hasil = await rekonsiliasiSesi(session, { tutup: sesiBasi(session.updated_at) });
    if (hasil.berubah) {
      console.log(`[Payment] Sesi ${session_uuid}: ${session.payment_status} → ${hasil.status}.`);
    }
    return res.status(200).json({ status: hasil.status });
  } catch (error) {
    // Kalau DOKU/DB bermasalah, jangan gagalkan polling —
    // kembalikan status terakhir yang tersimpan supaya app tetap menunggu.
    console.error('[Payment] Gagal cek status:', error.message);
    return res.status(200).json({ status: session.payment_status });
  }
});

// POST /api/payment/notification (DOKU Webhook — dipanggil DOKU saat customer bayar)
//
// Isi body TIDAK dipercaya: endpoint ini publik dan tanda tangan DOKU tidak
// diverifikasi, jadi siapa pun bisa mengirim "SUCCESS" palsu. Notifikasi hanya
// dipakai sebagai pemicu — status sebenarnya ditanyakan langsung ke DOKU.
router.post('/notification', async (req, res) => {
  try {
    console.log('[Webhook] DOKU notification received:', JSON.stringify(req.body));

    // DOKU Checkout mengirim order.invoice_number di notification
    const invoiceNumber = req.body?.order?.invoice_number;
    if (!invoiceNumber || typeof invoiceNumber !== 'string') {
      return res.status(400).send('Invalid payload');
    }

    const { data: invoice, error: invErr } = await supabase
      .from('payment_invoices')
      .select('session_id')
      .eq('invoice_number', invoiceNumber)
      .maybeSingle();
    if (invErr) throw new Error(`Gagal membaca invoice: ${invErr.message}`);

    let session = null;
    if (invoice) {
      const { data, error } = await supabase
        .from('sessions')
        .select(KOLOM_SESI)
        .eq('id', invoice.session_id)
        .maybeSingle();
      if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
      session = data;
    } else {
      // Order dari app versi lama: invoice_number = transaction_code.
      session = await cariSesi(invoiceNumber);
      if (session?.payment_status === 'paid') {
        return res.status(200).send('Already paid');
      }
    }

    if (!session) {
      return res.status(404).send('Session not found');
    }

    const hasil = await rekonsiliasiSesi(session);
    if (hasil.berubah) {
      console.log(`[Webhook] Sesi ${session.transaction_code}: ${session.payment_status} → ${hasil.status} (invoice ${invoiceNumber}).`);
    }
    // DOKU tidak bisa ditanya balik: minta DOKU mengirim ulang nanti.
    if (hasil.takTerjawab) {
      return res.status(503).send('Retry later');
    }

    return res.status(200).send('OK');
  } catch (error) {
    console.error('[Webhook] Error:', error);
    return res.status(500).send('Internal Server Error');
  }
});

module.exports = router;
