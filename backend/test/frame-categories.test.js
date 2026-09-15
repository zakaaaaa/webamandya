const test = require('node:test');
const assert = require('node:assert');
const {
  saringKategoriMati, hargaSesi, kategoriDenganHarga, kertasSesi, hargaSesiKertas,
} = require('../src/utils/frame-categories');

const KATEGORI_AKTIF = [{ id: 'k-wisuda' }, { id: 'k-halloween' }];

test('frame tanpa kategori tidak pernah tersembunyi', () => {
  const hasil = saringKategoriMati([{ id: 'f1', category_id: null }], KATEGORI_AKTIF);
  assert.strictEqual(hasil.length, 1);
});

test('frame dari kategori aktif tetap tampil', () => {
  const hasil = saringKategoriMati([{ id: 'f1', category_id: 'k-wisuda' }], KATEGORI_AKTIF);
  assert.strictEqual(hasil.length, 1);
});

test('frame dari kategori yang dimatikan ikut hilang', () => {
  const hasil = saringKategoriMati(
    [{ id: 'f1', category_id: 'k-koran' }, { id: 'f2', category_id: 'k-wisuda' }],
    KATEGORI_AKTIF,
  );
  assert.deepStrictEqual(hasil.map((f) => f.id), ['f2']);
});

// Kalau pengambilan kategori gagal (Supabase balas error), yang boleh terjadi
// paling buruk adalah chip tidak muncul — BUKAN daftar frame jadi kosong dan
// pelanggan menatap layar tanpa satu pun pilihan.
test('kategori gagal dimuat: semua frame tetap tampil', () => {
  const frames = [{ id: 'f1', category_id: null }, { id: 'f2', category_id: 'k-wisuda' }];
  assert.deepStrictEqual(saringKategoriMati(frames, null).map((f) => f.id), ['f1', 'f2']);
  assert.deepStrictEqual(saringKategoriMati(frames, undefined).map((f) => f.id), ['f1', 'f2']);
});

test('semua kategori dimatikan: hanya frame tanpa kategori yang tersisa', () => {
  const frames = [{ id: 'f1', category_id: null }, { id: 'f2', category_id: 'k-wisuda' }];
  assert.deepStrictEqual(saringKategoriMati(frames, []).map((f) => f.id), ['f1']);
});

test('daftar frame kosong atau null aman', () => {
  assert.deepStrictEqual(saringKategoriMati(null, KATEGORI_AKTIF), []);
  assert.deepStrictEqual(saringKategoriMati([], KATEGORI_AKTIF), []);
});

// ── Harga per kategori ──

const SETELAN = { session_price: 30000 };

test('kategori berharga menimpa harga setelan (termasuk setelan unit)', () => {
  assert.strictEqual(hargaSesi(SETELAN, 45000), 45000);
  assert.strictEqual(hargaSesi({ session_price: 25000 }, 45000), 45000);
});

test('kategori tanpa harga dan frame tanpa kategori memakai harga setelan', () => {
  assert.strictEqual(hargaSesi(SETELAN, null), 30000);
  assert.strictEqual(hargaSesi(SETELAN, undefined), 30000);
});

// Harga 0 atau rusak TIDAK boleh jadi tagihan 0 — DOKU menolak order Rp0
// tepat di depan pelanggan.
test('harga kategori tidak sah jatuh ke harga setelan, bukan ke nol', () => {
  for (const aneh of [0, -5000, 12.5, 'abc', NaN]) {
    assert.strictEqual(hargaSesi(SETELAN, aneh), 30000, String(aneh));
  }
  assert.strictEqual(hargaSesi(SETELAN, '40000'), 40000);
});

test('payload kategori membawa harga efektif tanpa kolom mentahnya', () => {
  const hasil = kategoriDenganHarga(
    [{ id: 'k1', name: 'Wisuda', session_price: 45000 }, { id: 'k2', name: 'Koran', session_price: null }],
    SETELAN,
  );
  assert.deepStrictEqual(hasil, [
    { id: 'k1', name: 'Wisuda', harga: 45000 },
    { id: 'k2', name: 'Koran', harga: 30000 },
  ]);
  assert.deepStrictEqual(kategoriDenganHarga(null, SETELAN), []);
});

// ── Pilihan kertas (frame newspaper A4) ──

const KORAN = { harga: 30000, hargaBookpaper: 20000 };

test('frame berpilihan kertas: bookpaper memakai harga bookpaper, glossy harga kategori', () => {
  assert.strictEqual(hargaSesiKertas(SETELAN, KORAN, 'bookpaper'), 20000);
  assert.strictEqual(hargaSesiKertas(SETELAN, KORAN, 'glossy'), 30000);
});

// App lama tidak mengirim pilihan kertas: tagihannya harus tetap harga yang
// berlaku sebelum pilihan ini ada, bukan harga bookpaper yang lebih murah.
test('frame berpilihan kertas tanpa pilihan atau pilihan aneh: glossy', () => {
  for (const aneh of [undefined, null, '', 'BOOKPAPER', 'hvs']) {
    assert.strictEqual(kertasSesi(aneh, 20000), 'glossy', String(aneh));
    assert.strictEqual(hargaSesiKertas(SETELAN, KORAN, aneh), 30000, String(aneh));
  }
});

// Pelanggan pindah dari frame koran ke strip 4R di sesi yang sama: harga dan
// kertas bookpaper tidak boleh ikut terbawa.
test('frame tanpa pilihan kertas: kertas null dan bookpaper diabaikan', () => {
  assert.strictEqual(kertasSesi('bookpaper', null), null);
  assert.strictEqual(hargaSesiKertas(SETELAN, { harga: 35000, hargaBookpaper: null }, 'bookpaper'), 35000);
  assert.strictEqual(hargaSesiKertas(SETELAN, { harga: null, hargaBookpaper: null }, 'bookpaper'), 30000);
});

test('harga bookpaper tidak sah dianggap tidak ada pilihan kertas', () => {
  for (const aneh of [0, -1, 12.5, 'abc']) {
    assert.strictEqual(kertasSesi('bookpaper', aneh), null, String(aneh));
    assert.strictEqual(hargaSesiKertas(SETELAN, { harga: null, hargaBookpaper: aneh }, 'bookpaper'), 30000);
  }
});
