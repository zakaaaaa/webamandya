const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');
const { sendMessage, esc } = require('../utils/telegram');
const { cobaSegera } = require('../workers/pengirim');

// Endpoint publik: dipanggil langsung dari browser pelanggan di halaman
// unduh, tanpa login dan tanpa HWID. Karena itu semua masukan diperlakukan
// sebagai tidak tepercaya dan lajunya dibatasi.

const REASONS = {
  foto_tidak_muncul: 'Foto tidak muncul',
  foto_tidak_lengkap: 'Foto tidak lengkap',
  hasil_salah: 'Hasil tidak sesuai',
  lainnya: 'Lainnya',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_EMAIL = 160;
const MAX_NOTE = 500;

// Satu sesi wajar mengadu sekali, dua kali kalau ragu. Lebih dari itu dalam
// sejam hampir pasti tombolnya ditekan berulang-ulang.
const MAX_PER_SESSION_PER_HOUR = 3;

// Pembatas kasar per alamat IP, cukup untuk meredam penyalahgunaan iseng.
// Disimpan di memori proses: hilang saat restart, dan itu tidak masalah.
const MAX_PER_IP = 6;
const IP_WINDOW_MS = 10 * 60 * 1000;
const ipHits = new Map();

function ipRateLimited(ip) {
  const now = Date.now();
  const hits = (ipHits.get(ip) || []).filter((t) => now - t < IP_WINDOW_MS);
  hits.push(now);
  ipHits.set(ip, hits);

  // Sapu bersih sesekali supaya Map tidak tumbuh selamanya.
  if (ipHits.size > 500) {
    for (const [key, times] of ipHits) {
      if (!times.some((t) => now - t < IP_WINDOW_MS)) ipHits.delete(key);
    }
  }
  return hits.length > MAX_PER_IP;
}

function cleanWhatsapp(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/[^\d]/g, '');
  if (digits.length < 8 || digits.length > 15) return null;
  return digits;
}

const formatWaktu = (iso) =>
  new Date(iso).toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Jakarta',
  });

// POST /api/complaints
router.post('/', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || 'tanpa-ip';
  if (ipRateLimited(ip)) {
    return res.status(429).json({ success: false, message: 'Terlalu banyak pengaduan. Coba lagi nanti.' });
  }

  const { transaction_code, email, whatsapp, reason, note } = req.body || {};

  if (!transaction_code || typeof transaction_code !== 'string' || transaction_code.length > 100) {
    return res.status(400).json({ success: false, message: 'Kode sesi tidak valid.' });
  }
  if (!email || typeof email !== 'string' || email.length > MAX_EMAIL || !EMAIL_RE.test(email)) {
    return res.status(400).json({ success: false, message: 'Alamat email tidak valid.' });
  }
  if (!reason || !REASONS[reason]) {
    return res.status(400).json({ success: false, message: 'Jenis keluhan tidak dikenal.' });
  }
  const catatan = typeof note === 'string' ? note.trim().slice(0, MAX_NOTE) : null;
  const nomorWa = cleanWhatsapp(whatsapp);

  // Sesi harus benar-benar ada — kalau tidak, pengaduan tidak bisa ditindak.
  const { data: session, error: sessionError } = await supabase
    .from('sessions')
    .select('id, client_id, created_at, result_url, clients(name)')
    .eq('transaction_code', transaction_code)
    .maybeSingle();

  if (sessionError) {
    console.error('[Complaint] Gagal membaca sesi:', sessionError.message);
    return res.status(500).json({ success: false, message: 'Gagal memproses pengaduan.' });
  }
  if (!session) {
    return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });
  }

  // Cegah tombol yang ditekan berkali-kali menjadi belasan pengaduan kembar.
  const sejamLalu = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { count: recent } = await supabase
    .from('complaints')
    .select('id', { count: 'exact', head: true })
    .eq('transaction_code', transaction_code)
    .gte('created_at', sejamLalu);

  if ((recent ?? 0) >= MAX_PER_SESSION_PER_HOUR) {
    return res.status(429).json({
      success: false,
      message: 'Pengaduan untuk sesi ini sudah kami terima. Petugas sedang menanganinya.',
    });
  }

  const { count: photoCount } = await supabase
    .from('photos')
    .select('id', { count: 'exact', head: true })
    .eq('session_id', session.id);

  const adaFoto = (photoCount ?? 0) > 0;
  const adaStrip = Boolean(session.result_url);

  const { data: complaint, error: insertError } = await supabase
    .from('complaints')
    .insert({
      session_id: session.id,
      transaction_code,
      client_id: session.client_id,
      email: email.trim(),
      whatsapp: nomorWa,
      reason,
      note: catatan || null,
      had_result: adaStrip,
      photo_count: photoCount ?? 0,
    })
    .select('id')
    .single();

  if (insertError) {
    console.error('[Complaint] Gagal menyimpan:', insertError.message);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan pengaduan.' });
  }

  // ── Notifikasi operator ──
  const namaClient = Array.isArray(session.clients)
    ? session.clients[0]?.name
    : session.clients?.name;
  const frontend = (process.env.FRONTEND_URL || 'https://www.pabrikenangan.my.id').replace(/\/$/, '');

  const baris = [
    '🔴 <b>Pengaduan baru</b>',
    '',
    `<b>Kode sesi:</b> <code>${esc(transaction_code)}</code>`,
    `<b>Waktu sesi:</b> ${esc(formatWaktu(session.created_at))}`,
  ];
  if (namaClient) baris.push(`<b>Lokasi:</b> ${esc(namaClient)}`);
  baris.push(
    '',
    `<b>Keluhan:</b> ${esc(REASONS[reason])}`,
    `<b>Email:</b> ${esc(email.trim())}`,
  );
  if (nomorWa) baris.push(`<b>WhatsApp:</b> ${esc(nomorWa)}`);
  if (catatan) baris.push(`<b>Catatan:</b> ${esc(catatan)}`);
  baris.push(
    '',
    '<b>Keadaan di server:</b>',
    `• Foto tersimpan: <b>${photoCount ?? 0}</b>`,
    `• Photo strip: <b>${adaStrip ? 'ada' : 'belum ada'}</b>`,
    '',
    adaFoto && adaStrip
      ? '<i>Hasilnya sebenarnya sudah ada di server — kemungkinan pelanggan kehilangan tautannya.</i>'
      : '<i>Berkasnya belum sampai server. Cek mesin photobooth: berkasnya ada di simpanan lokal dan akan diunggah ulang oleh antrean.</i>',
    '',
    `<a href="${frontend}/download/${encodeURIComponent(transaction_code)}">Buka halaman unduh</a>`,
  );

  const terkirim = await sendMessage(baris.join('\n'));
  if (!terkirim) {
    // Pengaduannya sudah aman di database; operator masih bisa melihatnya
    // walau notifikasinya gagal. Jangan bikin pelanggan mengulang.
    console.warn('[Complaint] Notifikasi Telegram gagal untuk', complaint.id);
  }

  // Coba antar sekarang juga, tanpa menunggu putaran pekerja berikutnya.
  // Sengaja tidak di-await: pelanggan tidak perlu menunggu unggahan lampiran
  // selesai hanya untuk tahu laporannya diterima.
  cobaSegera(complaint.id);

  return res.status(201).json({
    success: true,
    complaint_id: complaint.id,
    has_result: adaStrip,
    photo_count: photoCount ?? 0,
    message: adaStrip
      ? 'Pengaduan diterima. Hasil fotomu sudah ada di server dan akan kami kirim ke email.'
      : 'Pengaduan diterima. Fotomu belum sampai server — petugas kami sudah diberi tahu.',
  });
});

module.exports = router;
