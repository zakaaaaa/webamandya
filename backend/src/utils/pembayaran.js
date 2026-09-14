// Sambungan aturan ./pembayaran-logika.js ke Supabase dan DOKU.

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../middleware/validateDevice');
const { generateSignatureGet, getTimestamp } = require('./doku');
const { sendMessage, esc } = require('./telegram');
const logika = require('./pembayaran-logika');

const DOKU_BASE_URL = process.env.DOKU_BASE_URL || 'https://api.doku.com';

// Kolom yang dibutuhkan semua jalur pembayaran dari sebuah baris sesi.
const KOLOM_SESI =
  'id, transaction_code, device_id, client_id, payment_status, payment_method, transaction_type, ' +
  'amount, original_amount, frame_id, updated_at, clients(doku_client_id, doku_secret_key)';

async function tanyaDoku({ doku_client_id, doku_secret_key }, nomor) {
  const targetPath = `/orders/v1/status/${nomor}`;
  const requestId = uuidv4();
  const timestamp = getTimestamp();
  try {
    const r = await axios.get(`${DOKU_BASE_URL}${targetPath}`, {
      headers: {
        'Client-Id': doku_client_id,
        'Request-Id': requestId,
        'Request-Timestamp': timestamp,
        'Signature': generateSignatureGet(doku_client_id, doku_secret_key, requestId, timestamp, targetPath),
      },
      timeout: 10000,
    });
    return logika.klasifikasiStatusDoku(r.status, r.data);
  } catch (e) {
    if (e.response) {
      const kelas = logika.klasifikasiStatusDoku(e.response.status, e.response.data);
      if (kelas === 'unknown') {
        console.error('[Pembayaran] DOKU menjawab', e.response.status, 'untuk', nomor, JSON.stringify(e.response.data));
      }
      return kelas;
    }
    console.error('[Pembayaran] DOKU tidak bisa dihubungi untuk', nomor, '-', e.message);
    return 'unknown';
  }
}

async function ambilInvoice(sessionId) {
  const { data, error } = await supabase
    .from('payment_invoices')
    .select('invoice_number, status, amount, created_at')
    .eq('session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(`Gagal membaca invoice: ${error.message}`);
  return data || [];
}

async function simpanStatusInvoice(nomor, status) {
  const { error } = await supabase
    .from('payment_invoices')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('invoice_number', nomor)
    .eq('status', 'pending');
  if (error) throw new Error(`Gagal menyimpan status invoice ${nomor}: ${error.message}`);
}

async function statusSesi(sessionId) {
  const { data, error } = await supabase
    .from('sessions')
    .select('payment_status')
    .eq('id', sessionId)
    .single();
  if (error) throw new Error(`Gagal membaca sesi: ${error.message}`);
  return data.payment_status;
}

// Semua perubahan status bersyarat pada status lama, supaya polling, webhook,
// dan penyapu yang berjalan bersamaan tidak saling menimpa.
async function tandaiSesiLunas(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .update({ payment_status: 'paid', paid_at: new Date().toISOString() })
    .eq('id', sessionId)
    .in('payment_status', logika.STATUS_BELUM_LUNAS);
  if (error) throw new Error(`Gagal menandai sesi lunas: ${error.message}`);
  return statusSesi(sessionId);
}

async function tutupSesi(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .update({ payment_status: 'expired' })
    .eq('id', sessionId)
    .eq('payment_status', 'pending');
  if (error) throw new Error(`Gagal menutup sesi: ${error.message}`);
  return statusSesi(sessionId);
}

/** Sesi yang ditutup (penyapu/abandon) dipakai lagi untuk percobaan bayar baru. */
async function bukaKembaliSesi(sessionId) {
  const { error } = await supabase
    .from('sessions')
    .update({ payment_status: 'pending' })
    .eq('id', sessionId)
    .in('payment_status', ['expired', 'failed']);
  if (error) throw new Error(`Gagal membuka kembali sesi: ${error.message}`);
}

/** Catat invoice baru SEBELUM order dibuat di DOKU, supaya webhook selalu menemukannya. */
async function buatInvoice(sesi, amount) {
  for (let percobaan = 0; percobaan < 3; percobaan++) {
    const nomor = logika.buatNomorInvoice(sesi.transaction_code, Date.now() + percobaan);
    const { error } = await supabase
      .from('payment_invoices')
      .insert({ invoice_number: nomor, session_id: sesi.id, amount });
    if (!error) return nomor;
    if (error.code !== '23505') throw new Error(`Gagal mencatat invoice: ${error.message}`);
  }
  throw new Error('Gagal membuat nomor invoice yang unik.');
}

function peringatan({ sesi, invoices, statusAwal }) {
  console.error('[Pembayaran] ⚠️ Kemungkinan bayar ganda:', sesi.transaction_code, statusAwal, invoices);
  sendMessage([
    '<b>⚠️ Kemungkinan pembayaran ganda</b>',
    `Sesi <code>${esc(sesi.transaction_code)}</code> berstatus <b>${esc(statusAwal)}</b>,`,
    `tapi DOKU mencatat LUNAS untuk: ${invoices.map((i) => `<code>${esc(i)}</code>`).join(', ')}.`,
    'Periksa di back office DOKU dan kembalikan dana pelanggan bila perlu.',
  ].join('\n'));
}

const rupiah = (n) => `Rp${Number(n).toLocaleString('id-ID')}`;

function peringatanKurangBayar({ sesi, invoices }) {
  console.error('[Pembayaran] ⚠️ Kurang bayar:', sesi.transaction_code, 'harga', sesi.amount, invoices);
  sendMessage([
    '<b>⚠️ Pembayaran di bawah harga sesi</b>',
    `Sesi <code>${esc(sesi.transaction_code)}</code> berharga <b>${esc(rupiah(sesi.amount))}</b>,`,
    `tapi yang dibayar: ${invoices.map((i) => `<code>${esc(i.nomor)}</code> ${esc(rupiah(i.amount))}`).join(', ')}.`,
    'Kemungkinan pelanggan pindah ke frame kategori yang lebih mahal setelah QR dibuat. Sesi tetap ditandai lunas.',
  ].join('\n'));
}

const rekonsiliasiSesi = logika.buatRekonsiliasi({
  ambilInvoice,
  simpanStatusInvoice,
  tandaiSesiLunas,
  tutupSesi,
  tanyaDoku,
  peringatan,
  peringatanKurangBayar,
});

module.exports = {
  KOLOM_SESI,
  DOKU_BASE_URL,
  rekonsiliasiSesi,
  buatInvoice,
  simpanStatusInvoice,
  bukaKembaliSesi,
  tanyaDoku,
};
