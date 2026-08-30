// Pengiriman Web Push untuk antrean pelanggan.
//
// KENAPA WEB PUSH, BUKAN WHATSAPP/SMS
// Tenant ramai membuat orang menjauh dari booth — mereka baru berani pergi
// kalau yakin akan dikabari. Web Push gratis, tanpa gateway, tanpa install,
// dan di Android Chrome tetap sampai meski HP terkunci di saku.
//
// BATASNYA HARUS DIINGAT: di iOS, Web Push hanya jalan kalau halamannya
// di-Add to Home Screen lebih dulu — permintaan yang terlalu besar untuk
// orang yang cuma mau berfoto. Karena itu pengguna iPhone ditutup jalur lain:
// tombol tel: di panel operator. Modul ini sengaja TIDAK pernah melempar
// error keluar, supaya kegagalan notifikasi tidak pernah menggagalkan
// pemanggilan antrean itu sendiri.

let webpush = null;
let siap = false;

try {
  // Sengaja require di dalam try: kalau paketnya belum terpasang di server,
  // antrean tetap harus jalan penuh — hanya notifikasinya yang mati.
  webpush = require('web-push');

  const { VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT } = process.env;

  if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
      VAPID_SUBJECT || 'mailto:halo@pabrikenangan.my.id',
      VAPID_PUBLIC_KEY,
      VAPID_PRIVATE_KEY
    );
    siap = true;
  } else {
    console.warn('[Push] VAPID belum diisi — notifikasi antrean dimatikan.');
  }
} catch (e) {
  console.warn('[Push] Paket web-push belum terpasang — notifikasi antrean dimatikan.');
}

function pushAktif() {
  return siap;
}

/**
 * Kirim satu notifikasi.
 *
 * Mengembalikan 'ok' | 'mati' | 'gagal'.
 *
 * 'mati' berarti langganan sudah tidak berlaku (404/410 dari push service —
 * pengunjung mencabut izin, membersihkan data peramban, atau menutup PWA-nya).
 * Pemanggil wajib mengosongkan push_subscription saat menerima ini, kalau
 * tidak endpoint mati itu akan terus dicoba setiap pergeseran antrean.
 */
async function kirimPush(subscription, payload) {
  if (!siap || !subscription) return 'gagal';

  try {
    await webpush.sendNotification(subscription, JSON.stringify(payload), {
      TTL: 300, // Notifikasi antrean basi dalam hitungan menit; jangan diantre lama.
      urgency: 'high',
    });
    return 'ok';
  } catch (e) {
    const status = e?.statusCode;
    if (status === 404 || status === 410) return 'mati';
    console.error('[Push] Gagal kirim:', status || e.message);
    return 'gagal';
  }
}

// Kunci publik VAPID disajikan lewat API, bukan lewat env terpisah di Vercel.
// Dengan begitu VAPID hanya dikonfigurasi di SATU tempat (.env di VPS) dan
// tidak mungkin ada kunci publik di frontend yang tidak cocok dengan kunci
// privat di backend — kesalahan yang gejalanya cuma "push diam-diam tidak
// pernah sampai" dan sangat mahal dilacak saat acara sedang berjalan.
function kunciPublik() {
  return siap ? process.env.VAPID_PUBLIC_KEY : null;
}

module.exports = { kirimPush, pushAktif, kunciPublik };
