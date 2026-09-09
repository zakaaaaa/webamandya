const test = require('node:test');
const assert = require('node:assert');
const { saringKategoriMati } = require('../src/utils/frame-categories');

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
