// Tes sambungan harga sesi ke database, dengan Supabase tiruan.
//
// harga-sesi.js adalah kode yang benar-benar mengubah angka tagihan, jadi
// yang diuji di sini perilaku yang tidak tertangkap tes aturan murni:
// frame yang dilapor app, update bersyarat, dan kegagalan database.

const test = require('node:test');
const assert = require('node:assert');
const Module = require('module');
const path = require('path');

// Kedua modul di bawah mengambil `supabase` sekali saat dimuat, jadi yang
// dipasang adalah perantara stabil yang meneruskan ke tiruan milik tes aktif.
let aktif = null;
const jalurKlien = require.resolve(path.join(__dirname, '../src/middleware/validateDevice'));
const palsu = new Module(jalurKlien);
palsu.filename = jalurKlien;
palsu.loaded = true;
palsu.exports = { supabase: { from: (t) => aktif.from(t) } };
require.cache[jalurKlien] = palsu;

const { sesuaikanHargaSesi } = require('../src/utils/harga-sesi');

const KLIEN = 'klien-pk';
const FRAMES = {
  'f-keychain': { client_id: KLIEN, harga: 35000 },
  'f-4r':       { client_id: KLIEN, harga: null },   // kategori tanpa harga
  'f-lepas':    { client_id: KLIEN, harga: null, tanpaKategori: true },
  'f-asing':    { client_id: 'klien-lain', harga: 99000 },
};

function dunia({ status = 'pending', setelanUnit = null, gagalFrame = false, lunasDuluan = false } = {}) {
  const tulis = [];
  let baca = 0;
  aktif = {
    from(table) {
      const q = { table, filter: {}, patch: null };
      const b = {
        select: () => b, order: () => b, limit: () => b,
        eq: (k, v) => { q.filter[k] = v; return b; },
        in: (k, v) => { q.filter[k] = v; return b; },
        update: (p) => { q.patch = p; return b; },
        maybeSingle: async () => {
          baca++;
          if (table === 'frames') {
            if (gagalFrame) return { data: null, error: { message: 'koneksi putus' } };
            const f = FRAMES[q.filter.id];
            if (!f || f.client_id !== q.filter.client_id) return { data: null, error: null };
            return {
              data: { id: q.filter.id, frame_categories: f.tanpaKategori ? null : { session_price: f.harga } },
              error: null,
            };
          }
          if (table === 'client_settings') return { data: { session_price: 30000 }, error: null };
          if (table === 'device_settings') {
            return { data: setelanUnit ? { session_price: setelanUnit } : null, error: null };
          }
          if (table === 'sessions') {
            tulis.push(q);
            const bolehBerubah = q.filter.payment_status.includes(status) && !lunasDuluan;
            return { data: bolehBerubah ? { id: q.filter.id } : null, error: null };
          }
          throw new Error(`tabel tak terduga ${table}`);
        },
      };
      return b;
    },
  };
  return { tulis, jumlahBaca: () => baca };
}

const sesi = (lain = {}) => ({
  id: 's1', transaction_code: 'sesi-1', client_id: KLIEN, device_id: 'unit-1',
  payment_status: 'pending', transaction_type: 'session',
  frame_id: 'f-4r', amount: 30000, original_amount: 30000, ...lain,
});

test('pindah ke frame kategori berharga: amount dan original_amount ikut naik', async () => {
  const w = dunia();
  const hasil = await sesuaikanHargaSesi(sesi({ frame_id: 'f-keychain' }));
  assert.strictEqual(hasil.amount, 35000);
  assert.strictEqual(hasil.original_amount, 35000);
  assert.strictEqual(w.tulis.length, 1);
  assert.deepStrictEqual(w.tulis[0].patch, { amount: 35000, original_amount: 35000 });
});

test('pindah dari kategori berharga ke frame tanpa kategori: kembali ke harga default', async () => {
  dunia();
  const hasil = await sesuaikanHargaSesi(sesi({ frame_id: 'f-lepas', amount: 35000, original_amount: 35000 }));
  assert.strictEqual(hasil.amount, 30000);
});

test('attach-frame gagal diam-diam: frame dari app dipakai dan dicatat ke sesi', async () => {
  const w = dunia();
  const hasil = await sesuaikanHargaSesi(sesi({ frame_id: 'f-4r' }), { frameId: 'f-keychain' });
  assert.strictEqual(hasil.amount, 35000);
  assert.strictEqual(hasil.frame_id, 'f-keychain');
  assert.strictEqual(w.tulis[0].patch.frame_id, 'f-keychain');
  assert.strictEqual(w.tulis[0].patch.selected_frame_id, 'f-keychain');
});

test('frame dari app milik klien lain diabaikan, harga dari frame sesi sendiri', async () => {
  const w = dunia();
  const hasil = await sesuaikanHargaSesi(sesi({ frame_id: 'f-4r' }), { frameId: 'f-asing' });
  assert.strictEqual(hasil.amount, 30000);
  assert.strictEqual(hasil.frame_id, 'f-4r');
  assert.strictEqual(w.tulis.length, 0);
});

test('harga kategori menimpa harga per unit; tanpa harga kategori, harga unit berlaku', async () => {
  dunia({ setelanUnit: 25000 });
  assert.strictEqual((await sesuaikanHargaSesi(sesi({ frame_id: 'f-keychain' }))).amount, 35000);
  dunia({ setelanUnit: 25000 });
  assert.strictEqual((await sesuaikanHargaSesi(sesi({ frame_id: 'f-4r' }))).amount, 25000);
});

test('harga sudah benar: tidak menulis apa pun', async () => {
  const w = dunia();
  const s = sesi({ frame_id: 'f-keychain', amount: 35000, original_amount: 35000 });
  assert.strictEqual(await sesuaikanHargaSesi(s), s);
  assert.strictEqual(w.tulis.length, 0);
});

test('sesi lunas, gratis, dan cetak tambahan tidak disentuh sama sekali', async () => {
  for (const s of [
    sesi({ frame_id: 'f-keychain', payment_status: 'paid' }),
    sesi({ frame_id: 'f-keychain', payment_status: 'free' }),
    sesi({ frame_id: null, transaction_type: 'extra_print', amount: 20000, original_amount: 20000 }),
  ]) {
    const w = dunia({ status: s.payment_status });
    assert.strictEqual(await sesuaikanHargaSesi(s, { frameId: 'f-keychain' }), s);
    assert.strictEqual(w.jumlahBaca(), 0);
  }
});

test('sesi basi (expired) yang dipakai lagi tetap disamakan harganya', async () => {
  dunia({ status: 'expired' });
  const hasil = await sesuaikanHargaSesi(sesi({ frame_id: 'f-keychain', payment_status: 'expired' }));
  assert.strictEqual(hasil.amount, 35000);
});

test('keburu lunas saat update: amount lama dikembalikan', async () => {
  dunia({ lunasDuluan: true });
  const s = sesi({ frame_id: 'f-keychain' });
  assert.strictEqual((await sesuaikanHargaSesi(s)).amount, 30000);
});

// Pelanggan sedang berdiri di depan booth: database bermasalah tidak boleh
// menggagalkan pembayarannya.
test('database gagal: tidak melempar, amount lama dipakai', async () => {
  dunia({ gagalFrame: true });
  const asli = console.error;
  console.error = () => {};
  try {
    const s = sesi({ frame_id: 'f-keychain' });
    assert.strictEqual(await sesuaikanHargaSesi(s), s);
  } finally {
    console.error = asli;
  }
});

test('sesi app lama tanpa frame sama sekali: harga default', async () => {
  const w = dunia();
  const hasil = await sesuaikanHargaSesi(sesi({ frame_id: null, amount: 30000 }));
  assert.strictEqual(hasil.amount, 30000);
  assert.strictEqual(w.tulis.length, 0);
});
