// Notifikasi operator lewat bot Telegram.
//
// Dipakai untuk hal yang butuh mata manusia segera — sejauh ini pengaduan
// pelanggan dari halaman unduh. Sengaja memakai parse_mode HTML, bukan
// MarkdownV2: MarkdownV2 mewajibkan escape belasan karakter (termasuk titik
// dan tanda hubung) sehingga alamat email dan nomor telepon gampang membuat
// seluruh pesan ditolak Telegram.

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const configured = Boolean(BOT_TOKEN && CHAT_ID);

// Batas waktu supaya Telegram yang lambat tidak ikut menahan permintaan
// pelanggan — notifikasi itu efek samping, bukan inti pekerjaan.
const TIMEOUT_MS = 10000;

/** Amankan teks yang berasal dari pelanggan sebelum disisipkan ke HTML. */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Kirim satu pesan. Tidak pernah melempar: pemanggil tidak boleh gagal hanya
 * karena notifikasinya tidak sampai.
 * @returns {Promise<boolean>} true kalau Telegram menerima pesannya.
 */
async function sendMessage(html) {
  if (!configured) {
    console.warn('[Telegram] Dilewati: TELEGRAM_BOT_TOKEN/TELEGRAM_CHAT_ID belum diisi.');
    return false;
  }
  try {
    const res = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: html,
        parse_mode: 'HTML',
        disable_web_page_preview: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const data = await res.json();
    if (!data.ok) {
      console.error('[Telegram] Ditolak:', data.description);
      return false;
    }
    return true;
  } catch (e) {
    console.error('[Telegram] Gagal kirim:', e.message);
    return false;
  }
}

module.exports = { sendMessage, esc, configured };
