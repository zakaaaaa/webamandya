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

module.exports = { saringKategoriMati };
