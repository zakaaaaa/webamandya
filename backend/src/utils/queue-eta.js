// Hitungan posisi dan estimasi tunggu antrean.
//
// Dipisah dari routes/queue.js supaya bisa diuji tanpa database: rumus inilah
// satu-satunya bagian antrean yang salahnya tidak kelihatan sampai ada orang
// berdiri kecewa di depan booth.

// Umur maksimal laporan sisa waktu dari aplikasi kiosk. Kiosk mengirimnya
// tiap ~10 detik selama sesi berjalan; lewat ambang ini laporannya dianggap
// tidak ada, bukan dianggap masih berlaku.
const HEARTBEAT_BASI = 45;

// Posisi 1 = "kamu berikutnya".
//
// Barisan fisik yang belum bertiket ikut dihitung di depan. Halaman
// pengunjung memakai angka ini untuk menulis "N orang di depanmu", dan angka
// itu harus cocok dengan yang dia lihat dengan matanya sendiri di depan booth
// — kalau layarnya bilang "kamu paling depan" sementara ada dua orang berdiri
// di sana, yang dia percayai berikutnya bukan lagi layar itu.
function hitungPosisi(papan, ticketId, walkin = 0) {
  const didepan = papan.filter((t) => t.status === 'called' || t.status === 'serving').length;
  const menunggu = papan.filter((t) => t.status === 'waiting');
  const idx = menunggu.findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  return Math.max(0, walkin) + didepan + idx + 1;
}

// Sisa sesi yang sedang berjalan menurut timer aplikasi kiosk sendiri
// (POST /kiosk/heartbeat), bukan tebakan dari selisih waktu mulai: sesi bisa
// dijeda atau berjalan lebih lama dari durasi setelan, dan satu tebakan yang
// meleset merusak estimasi SEMUA orang di belakangnya sekaligus.
//
// Laporan yang lebih tua dari HEARTBEAT_BASI dianggap tidak ada. Kalau
// aplikasi kiosk mati di tengah sesi, estimasi yang kehilangan komponen sisa
// jauh lebih baik daripada estimasi yang membeku di angka lama dan tidak
// pernah bergerak lagi selama acara.
function sisaSesiBerjalan(state) {
  if (state?.sesi_sisa_detik == null || !state?.sesi_sisa_at) return 0;
  const umur = (Date.now() - new Date(state.sesi_sisa_at)) / 1000;
  if (!Number.isFinite(umur) || umur < 0 || umur > HEARTBEAT_BASI) return 0;
  return Math.max(0, Math.round(state.sesi_sisa_detik - umur));
}

// Estimasi tunggu = sisa sesi yang sedang berjalan
//                 + (jumlah orang di depan yang akan memakai satu sesi penuh)
//                   x durasi sesi dari setelan.
//
// Orang yang SEDANG berfoto tidak pernah dihitung sebagai sesi penuh — dia
// sudah diwakili komponen sisa. Rumus lama menghitung keduanya sekaligus,
// jadi setiap estimasi kelebihan satu sesi penuh.
//
// Kalau ada sesi berjalan tapi tidak ada tiket berstatus 'serving', yang di
// booth adalah orang dari barisan fisik; dia sudah ikut di walkin_ahead, jadi
// satu dikurangi supaya tidak dihitung dua kali.
function etaDetik(state, papan, menungguDidepan, durasi) {
  const sisa = sisaSesiBerjalan(state);
  const adaTiketDilayani = papan.some((t) => t.status === 'serving');
  const walkin = Math.max(0, state?.walkin_ahead || 0);

  const walkinPenuh = sisa > 0 && !adaTiketDilayani ? Math.max(0, walkin - 1) : walkin;

  // Tiket 'serving' tanpa laporan sisa berarti aplikasi kiosk sedang tidak
  // mengabari; hitung dia satu sesi penuh daripada menganggap booth kosong.
  const tiketPenuh = papan.filter((t) => t.status === 'called').length
    + (adaTiketDilayani && sisa === 0 ? 1 : 0)
    + menungguDidepan;

  return Math.max(0, Math.round(sisa + (walkinPenuh + tiketPenuh) * durasi));
}

// Estimasi untuk pemegang tiket tertentu.
function hitungEta(state, papan, ticketId, durasi) {
  const idx = papan.filter((t) => t.status === 'waiting').findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  return etaDetik(state, papan, idx, durasi);
}

module.exports = { HEARTBEAT_BASI, hitungPosisi, sisaSesiBerjalan, etaDetik, hitungEta };
