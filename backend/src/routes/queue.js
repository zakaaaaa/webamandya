const express = require('express');
const router  = express.Router();
const crypto  = require('crypto');
const { supabase, validateDevice } = require('../middleware/validateDevice');
const { kirimPush, pushAktif, kunciPublik } = require('../utils/webpush');

// Antrean pelanggan photobooth.
//
// Tiga pemakai, satu sumber kebenaran di server:
//   - halaman pengunjung  : publik, dibuka dari QR di standee (slug pendek)
//   - panel operator      : publik + PIN, dibuka di HP operator
//   - aplikasi kiosk      : validateDevice (hwid), hanya membaca & mengklaim
//
// Kiosk sengaja dibuat sebagai PEMBACA, bukan pemilik antrean. Kalau aplikasi
// kiosk crash di tengah acara, antrean tetap hidup dan operator tetap bisa
// memanggil orang dari HP-nya.

const AKTIF = ['waiting', 'called', 'serving'];

// Estimasi tunggu dijaga di rentang masuk akal: satu sesi photobooth tidak
// pernah 30 detik dan tidak pernah setengah jam. Tanpa batas ini, satu sesi
// yang lupa ditutup operator akan merusak estimasi semua orang di belakangnya.
const ESTIMASI_MIN = 120;
const ESTIMASI_MAX = 1800;

// ============================================================
// Bantu-bantu
// ============================================================

// Tanggal WIB, bukan UTC. Tengah malam UTC = 07.00 WIB, jadi memakai tanggal
// UTC akan me-reset nomor antrean persis saat booth mulai ramai.
function tanggalJakarta() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
}

function samaAman(a, b) {
  const x = Buffer.from(String(a ?? ''));
  const y = Buffer.from(String(b ?? ''));
  if (x.length !== y.length || x.length === 0) return false;
  return crypto.timingSafeEqual(x, y);
}

async function ambilState(slug) {
  const { data } = await supabase
    .from('device_queue_state')
    .select('*, devices(id, hwid, device_name, client_id, is_active)')
    .eq('queue_slug', String(slug || '').toLowerCase())
    .maybeSingle();
  return data || null;
}

async function ambilStateByDevice(deviceId) {
  const { data } = await supabase
    .from('device_queue_state')
    .select('*')
    .eq('device_id', deviceId)
    .maybeSingle();
  return data || null;
}

// Tutup tiket yang tertinggal dari hari sebelumnya.
//
// Tanpa ini, tiket kemarin tetap 'waiting' selamanya: HP pengunjung masih
// merendernya sebagai antrean aktif meski mode sudah mati, kode klaimnya
// terkunci terus oleh indeks unik parsial, dan tiketnya sendiri tidak akan
// pernah bisa dipanggil karena papan hanya membaca hari ini.
//
// Dijalankan malas (saat ada yang membaca antrean) alih-alih lewat penjadwal:
// booth hanya hidup pada jam operasional, dan penjadwal tengah malam adalah
// satu bagian bergerak lagi yang bisa mati diam-diam tanpa ada yang sadar.
async function tutupTiketBasi(deviceId) {
  try {
    await supabase
      .from('queue_tickets')
      .update({ status: 'expired', closed_at: new Date().toISOString() })
      .eq('device_id', deviceId)
      .in('status', AKTIF)
      .lt('queue_date', tanggalJakarta());
  } catch (e) {
    // Pembersihan tidak boleh menggagalkan pembacaan antrean.
    console.error('[Queue] tutupTiketBasi error:', e);
  }
}

// Semua tiket hidup hari ini, terurut. Papan antrean, posisi, dan estimasi
// semuanya diturunkan dari SATU query ini supaya polling tetap murah.
async function ambilPapan(deviceId) {
  const { data } = await supabase
    .from('queue_tickets')
    .select('id, ticket_no, claim_code, status, display_name, phone, source, selected_frame_id, session_id, push_subscription, notified_soon_at, notified_turn_at, created_at, called_at, served_at')
    .eq('device_id', deviceId)
    .eq('queue_date', tanggalJakarta())
    .in('status', AKTIF)
    .order('ticket_no', { ascending: true });
  return data || [];
}

// Rata-rata durasi layanan nyata di booth ini. Dihitung dari tiket yang sudah
// selesai, bukan angka tetap — durasi sesi berbeda jauh antar lokasi dan antar
// jenis frame, dan estimasi yang meleset jauh lebih merusak kepercayaan
// daripada tidak ada estimasi sama sekali.
async function estimasiDetik(deviceId, state) {
  const cadangan = state?.fallback_session_seconds || 480;

  const { data } = await supabase
    .from('queue_tickets')
    .select('served_at, closed_at')
    .eq('device_id', deviceId)
    .eq('status', 'done')
    .not('served_at', 'is', null)
    .not('closed_at', 'is', null)
    .order('closed_at', { ascending: false })
    .limit(5);

  if (!data || data.length === 0) return cadangan;

  const durasi = data
    .map((t) => (new Date(t.closed_at) - new Date(t.served_at)) / 1000)
    .filter((d) => d >= ESTIMASI_MIN && d <= ESTIMASI_MAX);

  if (durasi.length === 0) return cadangan;

  const rata = durasi.reduce((a, b) => a + b, 0) / durasi.length;
  return Math.round(Math.min(ESTIMASI_MAX, Math.max(ESTIMASI_MIN, rata)));
}

// Posisi 1 = "kamu berikutnya". Tiket yang sedang dipanggil atau sedang
// difoto tetap dihitung berada di depan.
function hitungPosisi(papan, ticketId) {
  const didepan = papan.filter((t) => t.status === 'called' || t.status === 'serving').length;
  const menunggu = papan.filter((t) => t.status === 'waiting');
  const idx = menunggu.findIndex((t) => t.id === ticketId);
  if (idx < 0) return null;
  return didepan + idx + 1;
}

function sisaDetikSesiBerjalan(papan, rata) {
  const jalan = papan.find((t) => t.status === 'serving');
  if (!jalan || !jalan.served_at) return 0;
  const lewat = (Date.now() - new Date(jalan.served_at)) / 1000;
  return Math.max(60, Math.round(rata - lewat));
}

function hitungEta(papan, posisi, rata) {
  if (posisi == null) return null;
  return Math.max(0, Math.round((posisi - 1) * rata + sisaDetikSesiBerjalan(papan, rata)));
}

// Langganan push yang sudah mati harus dikosongkan, kalau tidak endpoint itu
// akan terus dicoba setiap pergeseran antrean sampai acara selesai.
async function pushKeTiket(tiket, payload) {
  if (!tiket?.push_subscription) return 'gagal';
  const hasil = await kirimPush(tiket.push_subscription, payload);
  if (hasil === 'mati') {
    await supabase.from('queue_tickets').update({ push_subscription: null }).eq('id', tiket.id);
  }
  return hasil;
}

// Notifikasi "bersiap" untuk semua yang sudah masuk ambang, sekali per tiket.
// Inilah sinyal yang sebenarnya membuat orang berani menjauh dari tenant:
// tanpa ini, pemberitahuan baru datang saat gilirannya tiba dan booth
// menganggur menunggu orangnya berjalan kembali.
async function sinkronSiapSiap(state, papan, rata) {
  const ambang = state.notify_lead ?? 2;
  const menunggu = papan.filter((t) => t.status === 'waiting');
  const didepan  = papan.filter((t) => t.status === 'called' || t.status === 'serving').length;

  for (let i = 0; i < menunggu.length; i++) {
    const tiket = menunggu[i];
    const posisi = didepan + i + 1;
    if (posisi > ambang) break;
    if (tiket.notified_soon_at || !tiket.push_subscription) continue;

    const menit = Math.max(1, Math.round(hitungEta(papan, posisi, rata) / 60));
    await pushKeTiket(tiket, {
      judul: 'Sebentar lagi giliranmu',
      isi: `Tinggal ${posisi - 1} orang di depanmu (±${menit} menit). Mulai jalan balik ke booth ya.`,
      nomor: tiket.ticket_no,
    });
    await supabase
      .from('queue_tickets')
      .update({ notified_soon_at: new Date().toISOString() })
      .eq('id', tiket.id);
  }
}

// Naikkan penunggu terdepan menjadi 'called'. Dipakai oleh kiosk saat sesi
// selesai dan oleh operator saat melewati orang yang tidak muncul.
async function panggilBerikutnya(state) {
  const papan = await ambilPapan(state.device_id);

  // Hanya satu orang boleh berstatus dipanggil/dilayani pada satu waktu —
  // memanggil dua orang sekaligus membuat keduanya datang bersamaan dan
  // urutan antreannya jadi perdebatan di depan booth.
  if (papan.some((t) => t.status === 'called' || t.status === 'serving')) {
    return { dipanggil: null, alasan: 'MASIH_ADA_YANG_AKTIF' };
  }

  const berikut = papan.find((t) => t.status === 'waiting');
  if (!berikut) {
    // Antrean habis: mode 'closing' berarti operator sudah menutup pendaftaran
    // dan tinggal menunggu sisa tiket bersih — sekarang saatnya benar-benar mati.
    if (state.mode === 'closing') {
      await supabase
        .from('device_queue_state')
        .update({ mode: 'off', updated_at: new Date().toISOString() })
        .eq('device_id', state.device_id);
    }
    return { dipanggil: null, alasan: 'ANTREAN_KOSONG' };
  }

  await supabase
    .from('queue_tickets')
    .update({ status: 'called', called_at: new Date().toISOString() })
    .eq('id', berikut.id);

  await pushKeTiket(berikut, {
    judul: `Giliranmu sekarang — nomor ${berikut.ticket_no}`,
    isi: `Datang ke booth dan masukkan kode ${berikut.claim_code}.`,
    nomor: berikut.ticket_no,
    kode: berikut.claim_code,
  });

  const rata = await estimasiDetik(state.device_id, state);
  await sinkronSiapSiap(state, await ambilPapan(state.device_id), rata);

  return { dipanggil: berikut, alasan: null };
}

// PostgREST mengembalikan fungsi bertipe komposit sebagai objek tunggal, tapi
// bentuknya bisa berubah jadi array satu elemen tergantung versi. Normalkan di
// satu tempat supaya pemanggilnya tidak perlu menebak.
function satuBaris(data) {
  return Array.isArray(data) ? data[0] : data;
}

function ringkasTiket(t) {
  return {
    id: t.id,
    nomor: t.ticket_no,
    kode: t.claim_code,
    nama: t.display_name,
    status: t.status,
    sumber: t.source,
    punya_frame: !!t.selected_frame_id,
    punya_sesi: !!t.session_id,
    dikabari: !!t.push_subscription,
  };
}

// ============================================================
// KIOSK — didaftarkan lebih dulu supaya '/kiosk/...' tidak tertangkap '/:slug'
// ============================================================

// POST /api/queue/kiosk/state — di-poll kiosk saat layar idle.
router.post('/kiosk/state', validateDevice, async (req, res) => {
  try {
    const state = await ambilStateByDevice(req.device.id);
    if (!state) return res.json({ success: true, mode: 'off', slug: null, dipanggil: null, menunggu: 0 });

    await tutupTiketBasi(state.device_id);
    const papan = await ambilPapan(state.device_id);
    const dipanggil = papan.find((t) => t.status === 'called') || null;
    const dilayani  = papan.find((t) => t.status === 'serving') || null;

    return res.json({
      success: true,
      mode: state.mode,
      slug: state.queue_slug,
      dipanggil: dipanggil ? ringkasTiket(dipanggil) : null,
      dilayani: dilayani ? ringkasTiket(dilayani) : null,
      menunggu: papan.filter((t) => t.status === 'waiting').length,
      berikutnya: papan.filter((t) => t.status === 'waiting').slice(0, 3).map(ringkasTiket),
    });
  } catch (e) {
    console.error('[Queue] kiosk/state error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/queue/kiosk/claim — pengunjung mengetik 4 digit di kiosk.
//
// Verifikasi ini terasa mengganggu tapi wajib: tanpa kode, siapa pun yang
// kebetulan berdiri di depan booth bisa memakai sesi yang sudah DIBAYAR
// orang lain dari HP-nya.
router.post('/kiosk/claim', validateDevice, async (req, res) => {
  const kode = String(req.body.claim_code || '').trim();
  if (!/^\d{4}$/.test(kode)) {
    return res.status(400).json({ success: false, message: 'Kode antrean harus 4 angka.', code: 'INVALID_CLAIM_CODE' });
  }

  try {
    const { data: tiket } = await supabase
      .from('queue_tickets')
      .select('id, ticket_no, claim_code, status, display_name, selected_frame_id, session_id, sessions(transaction_code, payment_status)')
      .eq('device_id', req.device.id)
      .eq('claim_code', kode)
      .in('status', AKTIF)
      .maybeSingle();

    if (!tiket) {
      return res.status(404).json({ success: false, message: 'Kode tidak ditemukan atau sudah dipakai.', code: 'TICKET_NOT_FOUND' });
    }
    if (tiket.status === 'serving') {
      return res.status(409).json({ success: false, message: 'Kode ini sedang dipakai.', code: 'TICKET_IN_USE' });
    }

    await supabase
      .from('queue_tickets')
      .update({ status: 'serving', served_at: new Date().toISOString() })
      .eq('id', tiket.id);

    const sesi = tiket.sessions || null;
    return res.json({
      success: true,
      ticket_id: tiket.id,
      nomor: tiket.ticket_no,
      nama: tiket.display_name,
      frame_id: tiket.selected_frame_id,
      // Kalau sesi sudah lunas dari HP, kiosk melewati halaman pembayaran.
      // Kalau null, alur pembayaran di kiosk berjalan seperti biasa.
      session: sesi && ['paid', 'free'].includes(sesi.payment_status)
        ? { transaction_code: sesi.transaction_code, payment_status: sesi.payment_status }
        : null,
    });
  } catch (e) {
    console.error('[Queue] kiosk/claim error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/queue/kiosk/precall — kiosk memberi tahu bahwa sesi berjalan sudah
// masuk tahap preview/cetak, jadi kameranya sebentar lagi bebas.
//
// Ini yang menghapus waktu mati. Kalau orang berikutnya baru dikabari saat
// gilirannya benar-benar tiba, booth menganggur selama dia berjalan kembali
// dari lantai lain.
router.post('/kiosk/precall', validateDevice, async (req, res) => {
  try {
    const state = await ambilStateByDevice(req.device.id);
    if (!state || state.mode === 'off') return res.json({ success: true, dikabari: null });

    const papan = await ambilPapan(state.device_id);
    const berikut = papan.find((t) => t.status === 'waiting');
    if (!berikut || berikut.notified_turn_at) return res.json({ success: true, dikabari: null });

    await pushKeTiket(berikut, {
      judul: 'Giliranmu berikutnya',
      isi: `Nomor ${berikut.ticket_no} — sesi di depanmu hampir selesai. Sudah di dekat booth?`,
      nomor: berikut.ticket_no,
    });
    await supabase
      .from('queue_tickets')
      .update({ notified_turn_at: new Date().toISOString() })
      .eq('id', berikut.id);

    return res.json({ success: true, dikabari: berikut.ticket_no });
  } catch (e) {
    console.error('[Queue] kiosk/precall error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/queue/kiosk/done — sesi selesai di kiosk.
//
// Sengaja langsung memanggil orang berikutnya. Operator memang selalu ada,
// tapi antrean tidak boleh berhenti hanya karena dia sedang membantu
// pengunjung lain; tugas operator adalah menangani pengecualian (melewati
// yang tidak muncul), bukan menjadi roda penggerak tiap giliran.
router.post('/kiosk/done', validateDevice, async (req, res) => {
  const { ticket_id, session_uuid } = req.body;

  try {
    const state = await ambilStateByDevice(req.device.id);
    if (!state) return res.json({ success: true, ditutup: null, dipanggil: null });

    let query = supabase
      .from('queue_tickets')
      .select('id')
      .eq('device_id', req.device.id)
      .eq('status', 'serving');

    if (ticket_id) query = query.eq('id', ticket_id);

    const { data: tiket } = await query.order('ticket_no', { ascending: true }).limit(1).maybeSingle();

    if (tiket) {
      const patch = { status: 'done', closed_at: new Date().toISOString() };

      // Ikat sesi ke tiket kalau kiosk baru tahu transaction_code-nya di akhir
      // (jalur pembayaran di kiosk, bukan dari HP).
      if (session_uuid) {
        const { data: sesi } = await supabase
          .from('sessions')
          .select('id')
          .eq('transaction_code', session_uuid)
          .eq('device_id', req.device.id)
          .maybeSingle();
        if (sesi) patch.session_id = sesi.id;
      }

      await supabase.from('queue_tickets').update(patch).eq('id', tiket.id);
    }

    const { dipanggil } = await panggilBerikutnya(state);
    return res.json({
      success: true,
      ditutup: tiket?.id || null,
      dipanggil: dipanggil ? ringkasTiket(dipanggil) : null,
    });
  } catch (e) {
    console.error('[Queue] kiosk/done error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================================
// OPERATOR — PIN dikirim di header X-Queue-Pin
// ============================================================

async function pinOperator(req, res, next) {
  const state = await ambilState(req.params.slug);
  if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

  if (!state.operator_pin || !samaAman(req.get('x-queue-pin'), state.operator_pin)) {
    return res.status(401).json({ success: false, message: 'PIN operator salah.' });
  }
  req.state = state;
  next();
}

router.post('/:slug/op/verify', pinOperator, (req, res) => {
  res.json({ success: true, booth: req.state.devices?.device_name || null, mode: req.state.mode });
});

router.get('/:slug/op/board', pinOperator, async (req, res) => {
  try {
    await tutupTiketBasi(req.state.device_id);
    const papan = await ambilPapan(req.state.device_id);
    const rata  = await estimasiDetik(req.state.device_id, req.state);
    const didepan = papan.filter((t) => t.status === 'called' || t.status === 'serving').length;

    let i = 0;
    const daftar = papan.map((t) => {
      const posisi = t.status === 'waiting' ? didepan + ++i : null;
      return {
        ...ringkasTiket(t),
        // Nomor HP hanya dibuka di panel operator — ini yang menutup pengguna
        // iPhone, yang tidak bisa menerima Web Push tanpa Add to Home Screen.
        telepon: t.phone || null,
        posisi,
        menunggu_sejak: t.created_at,
      };
    });

    res.json({
      success: true,
      mode: req.state.mode,
      notify_lead: req.state.notify_lead,
      max_queue_length: req.state.max_queue_length,
      estimasi_per_sesi: rata,
      push_aktif: pushAktif(),
      tiket: daftar,
    });
  } catch (e) {
    console.error('[Queue] op/board error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/queue/:slug/op/mode — { mode: 'on' | 'closing' | 'off' }
//
// Menutup antrean saat masih ada yang memegang nomor TIDAK boleh langsung
// mematikannya — orang-orang itu akan terlantar. Karena itu 'off' saat antrean
// belum kosong otomatis diturunkan menjadi 'closing': berhenti menerima
// pendatang baru, sisa tiket tetap dilayani, lalu mati sendiri saat bersih.
router.post('/:slug/op/mode', pinOperator, async (req, res) => {
  const diminta = String(req.body.mode || '');
  if (!['on', 'closing', 'off'].includes(diminta)) {
    return res.status(400).json({ success: false, message: 'Mode tidak dikenal.' });
  }

  try {
    let mode = diminta;
    if (diminta === 'off') {
      const papan = await ambilPapan(req.state.device_id);
      if (papan.length > 0) mode = 'closing';
    }

    await supabase
      .from('device_queue_state')
      .update({ mode, updated_at: new Date().toISOString() })
      .eq('device_id', req.state.device_id);

    res.json({ success: true, mode, diminta });
  } catch (e) {
    console.error('[Queue] op/mode error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:slug/op/settings', pinOperator, async (req, res) => {
  const patch = { updated_at: new Date().toISOString() };
  const lead = parseInt(req.body.notify_lead, 10);
  const maks = parseInt(req.body.max_queue_length, 10);

  if (Number.isInteger(lead) && lead >= 1 && lead <= 10) patch.notify_lead = lead;
  if (Number.isInteger(maks) && maks >= 1 && maks <= 99) patch.max_queue_length = maks;

  if (Object.keys(patch).length === 1) {
    return res.status(400).json({ success: false, message: 'Tidak ada setelan yang berubah.' });
  }

  await supabase.from('device_queue_state').update(patch).eq('device_id', req.state.device_id);
  res.json({ success: true, ...patch });
});

router.post('/:slug/op/call-next', pinOperator, async (req, res) => {
  try {
    const { dipanggil, alasan } = await panggilBerikutnya(req.state);
    res.json({ success: true, dipanggil: dipanggil ? ringkasTiket(dipanggil) : null, alasan });
  } catch (e) {
    console.error('[Queue] op/call-next error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Tiket manual untuk orang yang sudah terlanjur berdiri antre saat mode
// antrean baru dinyalakan — urutan fisik mereka tidak boleh hilang, dan
// menyuruh mereka rebutan scan hanya akan memicu perdebatan.
router.post('/:slug/op/issue', pinOperator, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('queue_take_ticket', {
      p_slug: req.state.queue_slug,
      p_name: req.body.display_name || null,
      p_phone: req.body.phone || null,
      p_fingerprint: null,
      p_source: 'operator',
    });
    if (error) throw error;
    res.status(201).json({ success: true, tiket: ringkasTiket(satuBaris(data)) });
  } catch (e) {
    console.error('[Queue] op/issue error:', e);
    res.status(500).json({ success: false, message: e.message || 'Gagal menerbitkan tiket.' });
  }
});

// Melewati orang yang tidak muncul. Tidak ada auto-skip berbasis timer:
// operator selalu ada di booth dan jauh lebih akurat menilai ini daripada
// hitungan mundur — dia bisa melihat orangnya sedang berjalan mendekat.
router.post('/:slug/op/t/:ticketId/skip', pinOperator, async (req, res) => {
  try {
    const { data: tiket } = await supabase
      .from('queue_tickets')
      .select('id, status')
      .eq('id', req.params.ticketId)
      .eq('device_id', req.state.device_id)
      .maybeSingle();

    if (!tiket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });
    if (!AKTIF.includes(tiket.status)) {
      return res.status(409).json({ success: false, message: 'Tiket sudah tidak aktif.' });
    }

    await supabase
      .from('queue_tickets')
      .update({ status: 'skipped', closed_at: new Date().toISOString() })
      .eq('id', tiket.id);

    const { dipanggil } = await panggilBerikutnya(req.state);
    res.json({ success: true, dipanggil: dipanggil ? ringkasTiket(dipanggil) : null });
  } catch (e) {
    console.error('[Queue] op/skip error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================================
// PENGUNJUNG — publik, dibuka dari QR di standee
// ============================================================

// Pembatas kasar per IP. Cukup untuk mencegah satu orang memborong nomor;
// bukan pertahanan serius, dan memang tidak perlu — operator berdiri di sana
// dan tiket tanpa orangnya akan dilewati dalam hitungan detik.
const jejakIp = new Map();

// Backend berjalan di belakang nginx, jadi req.ip selalu 127.0.0.1 dan
// pembatas ini akan memblokir SEMUA orang setelah 5 tiket kalau dipakai
// mentah-mentah. X-Forwarded-For dibaca di sini saja alih-alih menyalakan
// 'trust proxy' global, supaya tidak ada route lain yang ikut berubah
// perilakunya menjelang acara.
function alamatAsal(req) {
  const maju = req.get('x-forwarded-for');
  if (maju) return maju.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'x';
}

function bolehAmbil(ip) {
  const sekarang = Date.now();
  const jendela = 10 * 60 * 1000;
  const cap = jejakIp.get(ip)?.filter((t) => sekarang - t < jendela) || [];
  if (cap.length >= 5) return false;
  cap.push(sekarang);
  jejakIp.set(ip, cap);
  return true;
}

// GET /api/queue/:slug — keadaan booth untuk halaman pengunjung.
router.get('/:slug', async (req, res) => {
  try {
    const state = await ambilState(req.params.slug);
    if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

    await tutupTiketBasi(state.device_id);
    const papan = await ambilPapan(state.device_id);
    const rata  = await estimasiDetik(state.device_id, state);
    const menunggu = papan.filter((t) => t.status === 'waiting').length;

    res.json({
      success: true,
      booth: state.devices?.device_name || 'Photobooth',
      // 'off' bukan error — standee itu tercetak dan selalu ada, jadi orang
      // tetap memindainya saat booth sepi. Halaman harus menjawab jujur
      // "langsung datang saja", bukan menampilkan galat atau memberi nomor palsu.
      mode: state.mode,
      menerima_tiket: state.mode === 'on' && menunggu < state.max_queue_length,
      menunggu,
      estimasi_per_sesi: rata,
      estimasi_tunggu: Math.round(menunggu * rata + sisaDetikSesiBerjalan(papan, rata)),
      push_aktif: pushAktif(),
      vapid_public_key: kunciPublik(),
    });
  } catch (e) {
    console.error('[Queue] publik state error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.get('/:slug/frames', async (req, res) => {
  try {
    const state = await ambilState(req.params.slug);
    if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

    const { data } = await supabase
      .from('frames')
      .select('id, name, thumbnail_url, image_url, photo_count, orientation, sort_order')
      .eq('client_id', state.devices.client_id)
      .eq('is_active', true)
      .eq('type', 'static')
      .order('sort_order', { ascending: true });

    res.json({ success: true, frames: data || [] });
  } catch (e) {
    console.error('[Queue] frames error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/queue/:slug/join
router.post('/:slug/join', async (req, res) => {
  if (!bolehAmbil(alamatAsal(req))) {
    return res.status(429).json({ success: false, message: 'Terlalu sering mengambil nomor. Coba sebentar lagi.', code: 'RATE_LIMITED' });
  }

  try {
    const { data, error } = await supabase.rpc('queue_take_ticket', {
      p_slug: String(req.params.slug || '').toLowerCase(),
      p_name: req.body.display_name || null,
      p_phone: req.body.phone || null,
      p_fingerprint: req.body.fingerprint || null,
      p_source: 'qr',
    });

    if (error) {
      const pesan = {
        QUEUE_NOT_FOUND: ['Booth tidak ditemukan.', 404],
        DEVICE_INACTIVE: ['Booth sedang tidak aktif.', 403],
        QUEUE_CLOSED:    ['Antrean sedang ditutup. Datang langsung ke booth ya.', 409],
        QUEUE_FULL:      ['Antrean sedang penuh. Coba lagi sekitar 45 menit.', 409],
      };
      const cocok = Object.keys(pesan).find((k) => (error.message || '').includes(k));
      if (cocok) {
        return res.status(pesan[cocok][1]).json({ success: false, message: pesan[cocok][0], code: cocok });
      }
      throw error;
    }

    const tiket = satuBaris(data);
    const state = await ambilState(req.params.slug);
    const papan = await ambilPapan(state.device_id);
    const rata  = await estimasiDetik(state.device_id, state);
    const posisi = hitungPosisi(papan, tiket.id);

    res.status(201).json({
      success: true,
      ticket_id: tiket.id,
      nomor: tiket.ticket_no,
      kode: tiket.claim_code,
      posisi,
      estimasi_tunggu: hitungEta(papan, posisi, rata),
    });
  } catch (e) {
    console.error('[Queue] join error:', e);
    res.status(500).json({ success: false, message: 'Gagal mengambil nomor antrean.' });
  }
});

// GET /api/queue/:slug/t/:ticketId — di-poll halaman pengunjung tiap ~4 detik.
router.get('/:slug/t/:ticketId', async (req, res) => {
  try {
    const state = await ambilState(req.params.slug);
    if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

    // WAJIB sebelum membaca barisnya: kalau tidak, tiket kemarin terbaca
    // masih 'waiting' dan halaman pengunjung menampilkannya sebagai antrean
    // aktif yang sebenarnya tidak akan pernah dipanggil.
    await tutupTiketBasi(state.device_id);

    const { data: tiket } = await supabase
      .from('queue_tickets')
      .select('id, ticket_no, claim_code, status, display_name, selected_frame_id, session_id, push_subscription, sessions(transaction_code, payment_status)')
      .eq('id', req.params.ticketId)
      .eq('device_id', state.device_id)
      .maybeSingle();

    if (!tiket) return res.status(404).json({ success: false, message: 'Tiket tidak ditemukan.' });

    const papan = await ambilPapan(state.device_id);
    const rata  = await estimasiDetik(state.device_id, state);
    const posisi = hitungPosisi(papan, tiket.id);

    res.json({
      success: true,
      ticket_id: tiket.id,
      nomor: tiket.ticket_no,
      kode: tiket.claim_code,
      nama: tiket.display_name,
      status: tiket.status,
      posisi,
      estimasi_tunggu: hitungEta(papan, posisi, rata),
      frame_id: tiket.selected_frame_id,
      // Halaman memakai ini untuk berkata jujur soal notifikasi. Skenario
      // terburuk fitur ini bukan push yang gagal, tapi orang yang menjauh
      // dari tenant karena mengira akan dikabari padahal izinnya tidak aktif.
      dikabari: !!tiket.push_subscription,
      sesi: tiket.sessions
        ? { transaction_code: tiket.sessions.transaction_code, payment_status: tiket.sessions.payment_status }
        : null,
    });
  } catch (e) {
    console.error('[Queue] status tiket error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:slug/t/:ticketId/push', async (req, res) => {
  const langganan = req.body.subscription;
  if (!langganan?.endpoint) {
    return res.status(400).json({ success: false, message: 'Langganan push tidak valid.' });
  }

  try {
    const state = await ambilState(req.params.slug);
    if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

    const { data } = await supabase
      .from('queue_tickets')
      .update({ push_subscription: langganan })
      .eq('id', req.params.ticketId)
      .eq('device_id', state.device_id)
      .in('status', AKTIF)
      .select('id')
      .maybeSingle();

    if (!data) return res.status(404).json({ success: false, message: 'Tiket tidak aktif.' });
    res.json({ success: true });
  } catch (e) {
    console.error('[Queue] simpan push error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// Frame dipilih dari HP sambil mengantre. Tidak menyentuh pembayaran sama
// sekali, tapi memotong satu langkah penuh dari waktu pemakaian booth.
router.post('/:slug/t/:ticketId/frame', async (req, res) => {
  const { frame_id } = req.body;
  if (!frame_id) return res.status(400).json({ success: false, message: 'frame_id wajib diisi.' });

  try {
    const state = await ambilState(req.params.slug);
    if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

    // Frame harus milik klien booth ini — jangan percaya id dari peramban.
    const { data: frame } = await supabase
      .from('frames')
      .select('id')
      .eq('id', frame_id)
      .eq('client_id', state.devices.client_id)
      .eq('is_active', true)
      .maybeSingle();

    if (!frame) return res.status(404).json({ success: false, message: 'Frame tidak ditemukan.' });

    const { data } = await supabase
      .from('queue_tickets')
      .update({ selected_frame_id: frame_id })
      .eq('id', req.params.ticketId)
      .eq('device_id', state.device_id)
      .in('status', AKTIF)
      .select('id')
      .maybeSingle();

    if (!data) return res.status(404).json({ success: false, message: 'Tiket tidak aktif.' });
    res.json({ success: true, frame_id });
  } catch (e) {
    console.error('[Queue] pilih frame error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:slug/t/:ticketId/leave', async (req, res) => {
  try {
    const state = await ambilState(req.params.slug);
    if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });

    const { data } = await supabase
      .from('queue_tickets')
      .update({ status: 'left', closed_at: new Date().toISOString() })
      .eq('id', req.params.ticketId)
      .eq('device_id', state.device_id)
      .in('status', ['waiting', 'called'])
      .select('id, status')
      .maybeSingle();

    if (!data) return res.status(404).json({ success: false, message: 'Tiket tidak aktif.' });

    // Orang yang mundur saat sudah dipanggil membuat booth menganggur —
    // langsung panggil penggantinya.
    await panggilBerikutnya(state);
    res.json({ success: true });
  } catch (e) {
    console.error('[Queue] leave error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
