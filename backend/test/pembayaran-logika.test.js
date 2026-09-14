const test = require('node:test');
const assert = require('node:assert');
const L = require('../src/utils/pembayaran-logika');

const MENIT = 60 * 1000;
const SEKARANG = Date.parse('2026-09-14T10:00:00Z');
const lalu = (ms) => new Date(SEKARANG - ms).toISOString();
const KRED = { doku_client_id: 'BRN-x', doku_secret_key: 'rahasia' };

// Penyimpanan palsu yang meniru update BERSYARAT di ./pembayaran.js.
function dunia({ status = 'pending', invoices = [], doku = {}, kred = KRED, amount = 30000 } = {}) {
  const db = { status, invoices: invoices.map((i) => ({ ...i })) };
  const ditanya = [];
  const alarm = [];
  const kurang = [];
  const rekon = L.buatRekonsiliasi({
    sekarang: () => SEKARANG,
    ambilInvoice: async () => db.invoices.map((i) => ({ ...i })),
    simpanStatusInvoice: async (nomor, st) => {
      const i = db.invoices.find((x) => x.invoice_number === nomor && x.status === 'pending');
      if (i) i.status = st;
    },
    tandaiSesiLunas: async () => {
      if (L.STATUS_BELUM_LUNAS.includes(db.status)) db.status = 'paid';
      return db.status;
    },
    tutupSesi: async () => {
      if (db.status === 'pending') db.status = 'expired';
      return db.status;
    },
    tanyaDoku: async (_k, nomor) => {
      ditanya.push(nomor);
      return doku[nomor] ?? 'not_found';
    },
    peringatan: (x) => alarm.push(x),
    peringatanKurangBayar: (x) => kurang.push(x),
  });
  const sesi = () => ({ id: 's1', transaction_code: 'sesi-1', payment_status: db.status, amount, clients: kred });
  return { db, ditanya, alarm, kurang, jalan: (opsi) => rekon(sesi(), opsi) };
}

// ── Nomor invoice ──

test('nomor invoice unik per percobaan dan muat batas DOKU', () => {
  const a = L.buatNomorInvoice('sesi-1789303442808', SEKARANG);
  const b = L.buatNomorInvoice('sesi-1789303442808', SEKARANG + 1);
  assert.match(a, /^sesi-1789303442808-p[0-9a-z]+$/);
  assert.notStrictEqual(a, b);
  // Kode terpanjang yang dibuat app: cetak tambahan.
  const extra = L.buatNomorInvoice('sesi-1789301312760-extra-1789301361859', SEKARANG);
  assert.ok(extra.length <= L.MAKS_PANJANG_INVOICE, extra);
});

test('nomor invoice yang melebihi batas ditolak, bukan dipotong diam-diam', () => {
  assert.throws(() => L.buatNomorInvoice('x'.repeat(60), SEKARANG), /64/);
  assert.throws(() => L.buatNomorInvoice('', SEKARANG));
});

// ── Klasifikasi jawaban DOKU ──

test('klasifikasi jawaban status DOKU', () => {
  assert.strictEqual(L.klasifikasiStatusDoku(200, { transaction: { status: 'SUCCESS' } }), 'paid');
  assert.strictEqual(L.klasifikasiStatusDoku(200, { order: { status: 'ORDER_EXPIRED' }, transaction: { status: 'PENDING' } }), 'expired');
  assert.strictEqual(L.klasifikasiStatusDoku(200, { transaction: { status: 'EXPIRED' } }), 'expired');
  assert.strictEqual(L.klasifikasiStatusDoku(200, { transaction: { status: 'FAILED' } }), 'failed');
  assert.strictEqual(L.klasifikasiStatusDoku(200, { order: { status: 'ORDER_GENERATED' }, transaction: { status: 'PENDING' } }), 'open');
  assert.strictEqual(L.klasifikasiStatusDoku(404, {}), 'not_found');
  assert.strictEqual(L.klasifikasiStatusDoku(500, {}), 'unknown');
  assert.strictEqual(L.klasifikasiStatusDoku(401, {}), 'unknown');
});

test('404 untuk invoice yang baru dibuat tidak dianggap tidak ada', () => {
  assert.strictEqual(L.kelasEfektif('not_found', 2 * MENIT), 'open');
  assert.strictEqual(L.kelasEfektif('not_found', 30 * MENIT), 'not_found');
  assert.strictEqual(L.kelasEfektif('not_found', null), 'not_found');
});

test('sesi basi dihitung dari updated_at', () => {
  assert.strictEqual(L.sesiBasi(lalu(50 * MENIT), SEKARANG), true);
  assert.strictEqual(L.sesiBasi(lalu(5 * MENIT), SEKARANG), false);
  assert.strictEqual(L.sesiBasi(null, SEKARANG), false);
});

// ── Rekonsiliasi ──

test('sesi frame yang ditinggal tanpa pernah bayar: ditutup expired', async () => {
  const w = dunia();
  const r = await w.jalan({ tutup: true });
  assert.deepStrictEqual(w.ditanya, ['sesi-1']);
  assert.strictEqual(r.status, 'expired');
  assert.strictEqual(r.berubah, true);
});

test('tanpa tutup, sesi yang belum dibayar tidak diubah', async () => {
  const w = dunia();
  const r = await w.jalan({ tutup: false });
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(w.db.status, 'pending');
});

test('pelanggan membayar QR LAMA setelah menekan Coba Lagi: tetap lunas', async () => {
  const w = dunia({
    invoices: [
      { invoice_number: 'sesi-1-pbaru', status: 'pending', created_at: lalu(1 * MENIT) },
      { invoice_number: 'sesi-1-plama', status: 'pending', created_at: lalu(3 * MENIT) },
    ],
    doku: { 'sesi-1-pbaru': 'open', 'sesi-1-plama': 'paid' },
  });
  const r = await w.jalan();
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(w.db.invoices.find((i) => i.invoice_number === 'sesi-1-plama').status, 'paid');
  assert.strictEqual(w.db.invoices.find((i) => i.invoice_number === 'sesi-1-pbaru').status, 'pending');
  assert.strictEqual(w.alarm.length, 0);
  // Sesi yang punya baris invoice tidak lagi ditanyakan dengan transaction_code.
  assert.ok(!w.ditanya.includes('sesi-1'));
});

test('order yang masih bisa dibayar menahan sesi tetap pending meski pelanggan pergi', async () => {
  const w = dunia({
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(20 * MENIT) }],
    doku: { 'sesi-1-pa': 'open' },
  });
  const r = await w.jalan({ tutup: true });
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(w.db.invoices[0].status, 'pending');
});

test('DOKU tidak menjawab: sesi dibiarkan pending', async () => {
  const w = dunia({ doku: { 'sesi-1': 'unknown' } });
  const r = await w.jalan({ tutup: true });
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(r.takTerjawab, true);
});

test('invoice muda yang 404 tidak ditutup', async () => {
  const w = dunia({
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(1 * MENIT) }],
  });
  const r = await w.jalan({ tutup: true });
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(w.db.invoices[0].status, 'pending');
});

test('invoice tua yang 404 dan kedaluwarsa: invoice dan sesi ditutup', async () => {
  const w = dunia({
    invoices: [
      { invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(40 * MENIT) },
      { invoice_number: 'sesi-1-pb', status: 'pending', created_at: lalu(35 * MENIT) },
      { invoice_number: 'sesi-1-pc', status: 'failed', created_at: lalu(34 * MENIT) },
    ],
    doku: { 'sesi-1-pb': 'expired' },
  });
  const r = await w.jalan({ tutup: true });
  assert.strictEqual(r.status, 'expired');
  assert.deepStrictEqual(w.db.invoices.map((i) => i.status), ['expired', 'expired', 'failed']);
  // Invoice yang sudah final tidak ditanyakan lagi.
  assert.ok(!w.ditanya.includes('sesi-1-pc'));
});

test('tanpa tutup, invoice tetap diperbarui walau sesi tidak', async () => {
  const w = dunia({
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(40 * MENIT) }],
    doku: { 'sesi-1-pa': 'expired' },
  });
  const r = await w.jalan({ tutup: false });
  assert.strictEqual(r.status, 'pending');
  assert.strictEqual(w.db.invoices[0].status, 'expired');
});

test('sesi yang sudah ditutup lalu dibayar: jadi lunas', async () => {
  const w = dunia({
    status: 'expired',
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(20 * MENIT) }],
    doku: { 'sesi-1-pa': 'paid' },
  });
  const r = await w.jalan();
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(r.berubah, true);
});

test('sesi voucher yang juga dibayar QRIS: tetap free, operator diberi peringatan', async () => {
  const w = dunia({
    status: 'free',
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(3 * MENIT) }],
    doku: { 'sesi-1-pa': 'paid' },
  });
  const r = await w.jalan();
  assert.strictEqual(r.status, 'free');
  assert.strictEqual(w.db.invoices[0].status, 'paid');
  assert.strictEqual(w.alarm.length, 1);
});

test('dua QR dibayar sekaligus: lunas, operator diberi peringatan', async () => {
  const w = dunia({
    invoices: [
      { invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(3 * MENIT) },
      { invoice_number: 'sesi-1-pb', status: 'pending', created_at: lalu(2 * MENIT) },
    ],
    doku: { 'sesi-1-pa': 'paid', 'sesi-1-pb': 'paid' },
  });
  const r = await w.jalan();
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(w.alarm.length, 1);
});

test('sesi lunas tanpa baris invoice tidak ditanyakan ke DOKU', async () => {
  const w = dunia({ status: 'paid' });
  const r = await w.jalan({ tutup: true });
  assert.strictEqual(r.status, 'paid');
  assert.deepStrictEqual(w.ditanya, []);
  assert.strictEqual(w.alarm.length, 0);
});

// ── Harga per kategori frame ──

test('QR lama yang lebih murah dibayar setelah pindah frame: lunas, operator diberi tahu', async () => {
  const w = dunia({
    amount: 45000,
    invoices: [
      { invoice_number: 'sesi-1-pmurah', status: 'pending', amount: 30000, created_at: lalu(4 * MENIT) },
      { invoice_number: 'sesi-1-pmahal', status: 'pending', amount: 45000, created_at: lalu(1 * MENIT) },
    ],
    doku: { 'sesi-1-pmurah': 'paid', 'sesi-1-pmahal': 'open' },
  });
  const r = await w.jalan();
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(w.kurang.length, 1);
  assert.deepStrictEqual(w.kurang[0].invoices, [{ nomor: 'sesi-1-pmurah', amount: 30000 }]);
});

test('invoice seharga sesi atau lebih: tanpa peringatan kurang bayar', async () => {
  const w = dunia({
    amount: 30000,
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', amount: 45000, created_at: lalu(2 * MENIT) }],
    doku: { 'sesi-1-pa': 'paid' },
  });
  await w.jalan();
  assert.strictEqual(w.kurang.length, 0);
});

test('invoice lama tanpa kolom amount tidak memicu peringatan', async () => {
  const w = dunia({
    amount: 45000,
    invoices: [{ invoice_number: 'sesi-1-pa', status: 'pending', created_at: lalu(2 * MENIT) }],
    doku: { 'sesi-1-pa': 'paid' },
  });
  const r = await w.jalan();
  assert.strictEqual(r.status, 'paid');
  assert.strictEqual(w.kurang.length, 0);
});

test('klien tanpa kredensial DOKU: ditutup tanpa bertanya ke DOKU', async () => {
  const w = dunia({ kred: {} });
  const r = await w.jalan({ tutup: true });
  assert.strictEqual(r.status, 'expired');
  assert.deepStrictEqual(w.ditanya, []);
});
