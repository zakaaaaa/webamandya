// Aturan "kategori mati ikut menyembunyikan frame di dalamnya".
//
// Ini satu-satunya cara operator bisa menyembunyikan sekelompok frame sekaligus
// — misalnya seluruh kategori kertas A4 saat kertas A4 sedang tidak terpasang —
// tanpa mematikan frame satu per satu lalu lupa menyalakannya lagi.
//
// Dipakai bersama oleh /api/frames (kios) dan /api/queue/:slug/frames (HP).
// Kalau logikanya disalin ke dua tempat, cepat atau lambat layar booth dan
// layar pelanggan akan menampilkan daftar yang berbeda.
//
// Frame dengan category_id NULL TIDAK PERNAH tersembunyi: frame yang belum
// dikategorikan harus tetap bisa dipilih.

function saringKategoriMati(frames, kategoriAktif) {
  const daftar = frames || [];

  // null/undefined = pengambilan kategori GAGAL, bukan "tidak ada kategori".
  // Bedanya menentukan: menyaring dengan daftar kosong akan menyembunyikan
  // setiap frame yang punya kategori, dan pelanggan menatap layar tanpa satu
  // pun pilihan. Saat ragu, tampilkan semuanya — paling buruk chip-nya salah.
  // Larik kosong tetap disaring: itu berarti semua kategori memang dimatikan.
  if (!Array.isArray(kategoriAktif)) return daftar;

  const hidup = new Set(kategoriAktif.map((c) => c.id));
  return daftar.filter((f) => !f.category_id || hidup.has(f.category_id));
}

// Harga sesi sebuah frame: harga kategorinya kalau diisi, selain itu
// session_price dari setelan. Harga kategori menimpa device_settings juga —
// lihat sql/2026-09-14_frame_category_price.sql.
//
// hargaKategori null/undefined/tidak sah = kategori tanpa harga sendiri, atau
// frame tanpa kategori. Nilai aneh dari database jatuh ke harga setelan,
// bukan ke 0: sesi QRIS berharga 0 ditolak DOKU di depan pelanggan.
function hargaSesi(settings, hargaKategori) {
  const n = Number(hargaKategori);
  if (hargaKategori !== null && hargaKategori !== undefined && Number.isInteger(n) && n > 0) {
    return n;
  }
  return Number(settings?.session_price ?? 0);
}

// Kategori untuk payload kios/HP: harga efektifnya sudah dihitung di sini,
// supaya kedua layar tidak perlu tahu aturan jatuh ke harga setelan.
function kategoriDenganHarga(categories, settings) {
  if (!Array.isArray(categories)) return [];
  return categories.map(({ session_price, ...c }) => ({
    ...c,
    harga: hargaSesi(settings, session_price),
  }));
}

module.exports = { saringKategoriMati, hargaSesi, kategoriDenganHarga };
