const test = require('node:test');
const assert = require('node:assert');
const { saringKategoriMati, hargaSesi, kategoriDenganHarga } = require('../src/utils/frame-categories');

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
