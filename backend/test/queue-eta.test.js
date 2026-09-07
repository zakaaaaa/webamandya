const test = require('node:test');
const assert = require('node:assert');
const { hitungPosisi, sisaSesiBerjalan, etaDetik, hitungEta } = require('../src/utils/queue-eta');

const DURASI = 300; // 5 menit, dari session_duration_minutes

const sekarang = () => new Date().toISOString();
const tiket = (id, status) => ({ id, status });

// Alur yang dipakai di lapangan: dua orang sudah berdiri antre sebelum mode
// antrean dinyalakan (satu sedang berfoto dengan sisa 3 menit, satu menunggu),
// lalu customer ke-3 dan ke-4 mengambil nomor lewat QR.
test('barisan fisik yang belum bertiket ikut dihitung', () => {
  const state = { walkin_ahead: 2, sesi_sisa_detik: 180, sesi_sisa_at: sekarang() };
  const papan = [tiket('t3', 'waiting'), tiket('t4', 'waiting')];

  // 3 menit sisa customer 1 + 5 menit customer 2
  assert.strictEqual(hitungEta(state, papan, 't3', DURASI), 480);
  // + 5 menit customer 3
  assert.strictEqual(hitungEta(state, papan, 't4', DURASI), 780);

  // Angka yang dibaca pengunjung harus cocok dengan yang dia lihat di booth.
  assert.strictEqual(hitungPosisi(papan, 't3', state.walkin_ahead), 3);
  assert.strictEqual(hitungPosisi(papan, 't4', state.walkin_ahead), 4);
});

test('customer 1 selesai: barisan fisik maju, sesi berjalan hilang', () => {
  const state = { walkin_ahead: 1, sesi_sisa_detik: null, sesi_sisa_at: null };
  const papan = [tiket('t3', 'waiting'), tiket('t4', 'waiting')];
  assert.strictEqual(hitungEta(state, papan, 't3', DURASI), 300);
});

test('customer 2 masuk booth: sisanya menggantikan satu sesi penuh', () => {
  const state = { walkin_ahead: 1, sesi_sisa_detik: 240, sesi_sisa_at: sekarang() };
  const papan = [tiket('t3', 'waiting'), tiket('t4', 'waiting')];
  assert.strictEqual(hitungEta(state, papan, 't3', DURASI), 240);
  assert.strictEqual(hitungEta(state, papan, 't4', DURASI), 540);
});

test('barisan fisik habis: pemegang tiket dipanggil', () => {
  const state = { walkin_ahead: 0, sesi_sisa_detik: null, sesi_sisa_at: null };
  const papan = [tiket('t3', 'called'), tiket('t4', 'waiting')];
  // t3 dipanggil tapi belum mulai berfoto: dia tetap satu sesi penuh.
  assert.strictEqual(hitungEta(state, papan, 't4', DURASI), 300);
});

test('orang yang sedang berfoto tidak dihitung dua kali', () => {
  const state = { walkin_ahead: 0, sesi_sisa_detik: 120, sesi_sisa_at: sekarang() };
  const papan = [tiket('t3', 'serving'), tiket('t4', 'waiting')];
  assert.strictEqual(hitungEta(state, papan, 't4', DURASI), 120);
});

test('kiosk berhenti mengabari: sesi berjalan dihitung satu sesi penuh', () => {
  const basi = new Date(Date.now() - 120_000).toISOString();
  const state = { walkin_ahead: 0, sesi_sisa_detik: 120, sesi_sisa_at: basi };
  const papan = [tiket('t3', 'serving'), tiket('t4', 'waiting')];
  assert.strictEqual(sisaSesiBerjalan(state), 0);
  assert.strictEqual(hitungEta(state, papan, 't4', DURASI), 300);
});

test('laporan sisa menua seiring waktu, tidak membeku', () => {
  const state = { walkin_ahead: 0, sesi_sisa_detik: 180, sesi_sisa_at: new Date(Date.now() - 30_000).toISOString() };
  assert.strictEqual(sisaSesiBerjalan(state), 150);
});

test('booth kosong: pendatang baru tidak menunggu apa pun', () => {
  const state = { walkin_ahead: 0, sesi_sisa_detik: null, sesi_sisa_at: null };
  assert.strictEqual(etaDetik(state, [], 0, DURASI), 0);
});

test('estimasi untuk yang belum bertiket menghitung semua penunggu', () => {
  const state = { walkin_ahead: 2, sesi_sisa_detik: 180, sesi_sisa_at: sekarang() };
  const papan = [tiket('t3', 'waiting'), tiket('t4', 'waiting')];
  // 3 menit sisa + customer 2 + customer 3 + customer 4
  assert.strictEqual(etaDetik(state, papan, papan.length, DURASI), 180 + 3 * 300);
});

test('tiket yang tidak lagi menunggu tidak punya estimasi', () => {
  const state = { walkin_ahead: 0 };
  assert.strictEqual(hitungEta(state, [tiket('t3', 'serving')], 't3', DURASI), null);
  assert.strictEqual(hitungPosisi([tiket('t3', 'serving')], 't3'), null);
});
