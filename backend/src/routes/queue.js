const express = require('express');
const router  = express.Router();
const { supabase, validateDevice } = require('../middleware/validateDevice');
const { kirimPush, pushAktif, kunciPublik } = require('../utils/webpush');
const { resolveSettings } = require('../utils/settings');
const { hitungPosisi, sisaSesiBerjalan, etaDetik, hitungEta } = require('../utils/queue-eta');
const { saringKategoriMati } = require('../utils/frame-categories');

// Antrean pelanggan photobooth.
//
// Tiga pemakai, satu sumber kebenaran di server:
//   - halaman pengunjung  : publik, dibuka dari QR di standee (slug pendek)
//   - panel operator      : publik tanpa kredensial, dibuka dari dashboard
//   - aplikasi kiosk      : validateDevice (hwid), hanya membaca & mengklaim
//
// Kiosk sengaja dibuat sebagai PEMBACA, bukan pemilik antrean. Kalau aplikasi
// kiosk crash di tengah acara, antrean tetap hidup dan operator tetap bisa
// memanggil orang dari HP-nya.

const AKTIF = ['waiting', 'called', 'serving'];


// ============================================================
// Bantu-bantu
// ============================================================

// Tanggal WIB, bukan UTC. Tengah malam UTC = 07.00 WIB, jadi memakai tanggal
// UTC akan me-reset nomor antrean persis saat booth mulai ramai.
function tanggalJakarta() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Jakarta' });
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
    .select('*, devices(id, hwid, device_name, client_id, is_active)')
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

// Durasi satu sesi menurut setelan yang berlaku di booth ini
// (DEFAULT <- client_settings <- device_settings).
//
// Sengaja BUKAN rata-rata sesi yang sudah lewat. Angka ini harus sama persis
// dengan yang dilihat pemilik di halaman Settings: estimasi yang meleset
// masih bisa diperbaiki kalau sumbernya satu angka yang bisa diubah, tapi
// tidak bisa diapa-apakan kalau sumbernya rata-rata yang bergerak sendiri.
async function durasiSesiDetik(state) {
  const clientId = state?.devices?.client_id;
  if (!clientId) return 300;
  try {
    const setelan = await resolveSettings(clientId, state.device_id);
    const menit = Number(setelan.session_duration_minutes);
    if (!Number.isFinite(menit) || menit <= 0) return 300;
    return Math.round(menit * 60);
  } catch (e) {
    console.error('[Queue] durasiSesiDetik error:', e);
    return 300;
  }
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
async function sinkronSiapSiap(state, papan, durasi) {
  const ambang = state.notify_lead ?? 2;
  const menunggu = papan.filter((t) => t.status === 'waiting');
  const didepan  = Math.max(0, state.walkin_ahead || 0)
    + papan.filter((t) => t.status === 'called' || t.status === 'serving').length;

  for (let i = 0; i < menunggu.length; i++) {
    const tiket = menunggu[i];
    const posisi = didepan + i + 1;
    if (posisi > ambang) break;
    if (tiket.notified_soon_at || !tiket.push_subscription) continue;

    const menit = Math.max(1, Math.round(hitungEta(state, papan, tiket.id, durasi) / 60));
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

  // Orang yang sudah berdiri antre sebelum mode antrean dinyalakan tidak
  // punya tiket, tapi gilirannya jelas lebih dulu. Selama barisan itu belum
  // habis, pemegang tiket tidak boleh dipanggil — memanggil mereka lebih dulu
  // adalah persis perselisihan yang seluruh fitur antrean ini hindari.
  if ((state.walkin_ahead || 0) > 0) {
    return { dipanggil: null, alasan: 'BARISAN_FISIK_BELUM_HABIS' };
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

  const durasi = await durasiSesiDetik(state);
  await sinkronSiapSiap(state, await ambilPapan(state.device_id), durasi);

  return { dipanggil: berikut, alasan: null };
}

// PostgREST mengembalikan fungsi bertipe komposit sebagai objek tunggal, tapi
// bentuknya bisa berubah jadi array satu elemen tergantung versi. Normalkan di
// satu tempat supaya pemanggilnya tidak perlu menebak.
// Nomor disimpan dalam bentuk internasional tanpa tanda baca supaya panel
// operator bisa langsung membuka wa.me tanpa menebak format tiap kali.
// '08...' adalah bentuk yang hampir selalu diketik orang di Indonesia, jadi
// itu yang diterjemahkan; '+62' dan '62' diterima apa adanya.
function normalHp(mentah) {
  const digit = String(mentah || '').replace(/\D/g, '');
  if (!digit) return null;
  if (digit.startsWith('62')) return digit;
  if (digit.startsWith('0'))  return '62' + digit.slice(1);
  if (digit.startsWith('8'))  return '62' + digit;
  return digit;
}

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
      // Barisan fisik yang belum bertiket. Selama masih ada, kiosk WAJIB
      // tetap menampilkan tombol MULAI biasa: orang-orang ini sudah berdiri
      // di depan booth sebelum mode antrean dinyalakan dan tidak punya kode
      // apa pun untuk diketik.
      walkin_ahead: state.walkin_ahead || 0,
      boleh_mulai: (state.walkin_ahead || 0) > 0,
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

    // Sesi yang selesai TANPA tiket berarti yang baru saja berfoto adalah
    // orang dari barisan fisik. Inilah satu-satunya titik yang tahu barisan
    // itu maju satu langkah — mereka tidak punya baris tiket yang statusnya
    // bisa berubah. Laporan sisa waktu ikut dikosongkan supaya estimasi tidak
    // menahan angka sesi yang sudah berakhir.
    const patchState = {
      sesi_sisa_detik: null,
      sesi_sisa_at: null,
      updated_at: new Date().toISOString(),
    };
    if (!tiket && (state.walkin_ahead || 0) > 0) {
      state.walkin_ahead = state.walkin_ahead - 1;
      patchState.walkin_ahead = state.walkin_ahead;
    }
    await supabase
      .from('device_queue_state')
      .update(patchState)
      .eq('device_id', state.device_id);

    const { dipanggil } = await panggilBerikutnya(state);
    return res.json({
      success: true,
      ditutup: tiket?.id || null,
      dipanggil: dipanggil ? ringkasTiket(dipanggil) : null,
      walkin_ahead: state.walkin_ahead || 0,
    });
  } catch (e) {
    console.error('[Queue] kiosk/done error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// POST /api/queue/kiosk/heartbeat — { hwid, sisa_detik }
//
// Satu-satunya sumber sisa waktu sesi yang sedang berjalan. Server sengaja
// tidak menghitungnya sendiri dari waktu mulai: timernya ada di aplikasi
// kiosk, bisa dijeda, dan sesi nyata sering berjalan lebih lama daripada
// durasi setelan. Menebaknya berarti setiap orang di antrean menerima
// estimasi yang meleset dengan arah yang sama.
router.post('/kiosk/heartbeat', validateDevice, async (req, res) => {
  const sisa = parseInt(req.body.sisa_detik, 10);
  if (!Number.isInteger(sisa) || sisa < 0 || sisa > 7200) {
    return res.status(400).json({ success: false, message: 'sisa_detik tidak valid.' });
  }

  try {
    await supabase
      .from('device_queue_state')
      .update({ sesi_sisa_detik: sisa, sesi_sisa_at: new Date().toISOString() })
      .eq('device_id', req.device.id);
    return res.json({ success: true });
  } catch (e) {
    console.error('[Queue] kiosk/heartbeat error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

// ============================================================
// OPERATOR — terbuka, tanpa kredensial
//
// PIN dihapus atas keputusan pemilik: panel ini hanya memanggil dan melewati
// antrean satu booth, dan satu layar PIN di HP operator saat antrean panjang
// lebih sering menghambat daripada melindungi. Konsekuensinya diterima —
// siapa pun yang tahu URL-nya bisa membuka panel ini.
// ============================================================

async function bukaState(req, res, next) {
  const state = await ambilState(req.params.slug);
  if (!state) return res.status(404).json({ success: false, message: 'Booth tidak ditemukan.' });
  req.state = state;
  next();
}

router.post('/:slug/op/verify', bukaState, (req, res) => {
  res.json({ success: true, booth: req.state.devices?.device_name || null, mode: req.state.mode });
});

router.get('/:slug/op/board', bukaState, async (req, res) => {
  try {
    await tutupTiketBasi(req.state.device_id);
    const papan = await ambilPapan(req.state.device_id);
    const durasi = await durasiSesiDetik(req.state);
    const didepan = Math.max(0, req.state.walkin_ahead || 0)
      + papan.filter((t) => t.status === 'called' || t.status === 'serving').length;

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
      estimasi_per_sesi: durasi,
      walkin_ahead: req.state.walkin_ahead || 0,
      sisa_sesi_berjalan: sisaSesiBerjalan(req.state),
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
router.post('/:slug/op/mode', bukaState, async (req, res) => {
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

    const patch = { mode, updated_at: new Date().toISOString() };

    // Saat antrean dinyalakan, operator memasukkan berapa orang yang sudah
    // berdiri antre tanpa scan QR — TERMASUK yang sedang berfoto. Orang-orang
    // itu tidak punya baris di queue_tickets, jadi ini satu-satunya kesempatan
    // sistem mengetahui mereka ada. Tanpa angka ini pemegang tiket pertama
    // melihat estimasi yang jauh terlalu pendek, datang ke booth, lalu
    // menemukan masih ada orang di depannya.
    if (diminta === 'on') {
      const walkin = parseInt(req.body.walkin_ahead, 10);
      patch.walkin_ahead = Number.isInteger(walkin) && walkin >= 0 && walkin <= 30 ? walkin : 0;
    }

    // Antrean benar-benar mati: barisan fisik ikut dilupakan, kalau tidak
    // hitungannya akan menghantui sesi berikutnya berhari-hari kemudian.
    if (mode === 'off') patch.walkin_ahead = 0;

    await supabase
      .from('device_queue_state')
      .update(patch)
      .eq('device_id', req.state.device_id);

    // Menyalakan antrean saat booth menganggur harus langsung memanggil orang
    // pertama. Tanpa ini tidak ada pemicu apa pun sampai ada sesi selesai —
    // dan kalau tidak ada yang dipanggil, tidak akan pernah ada sesi selesai.
    if (mode !== 'off') {
      await panggilBerikutnya({ ...req.state, ...patch });
    }

    res.json({ success: true, mode, diminta, walkin_ahead: patch.walkin_ahead });
  } catch (e) {
    console.error('[Queue] op/mode error:', e);
    res.status(500).json({ success: false, message: 'Server error.' });
  }
});

router.post('/:slug/op/settings', bukaState, async (req, res) => {
  const patch = { updated_at: new Date().toISOString() };
  const lead = parseInt(req.body.notify_lead, 10);
  const maks = parseInt(req.body.max_queue_length, 10);

  const walkin = parseInt(req.body.walkin_ahead, 10);

  if (Number.isInteger(lead) && lead >= 1 && lead <= 10) patch.notify_lead = lead;
  if (Number.isInteger(maks) && maks >= 1 && maks <= 99) patch.max_queue_length = maks;
  // Salah hitung barisan fisik itu wajar saat booth ramai; harus bisa
  // dikoreksi tanpa mematikan lalu menyalakan ulang antrean.
  if (Number.isInteger(walkin) && walkin >= 0 && walkin <= 30) patch.walkin_ahead = walkin;

  if (Object.keys(patch).length === 1) {
    return res.status(400).json({ success: false, message: 'Tidak ada setelan yang berubah.' });
  }

  await supabase.from('device_queue_state').update(patch).eq('device_id', req.state.device_id);

  // Operator baru saja mengoreksi barisan fisik menjadi nol saat booth
  // menganggur: tidak ada sesi yang akan selesai untuk memicu panggilan, jadi
  // pemegang nomor pertama harus dipanggil dari sini.
  if (patch.walkin_ahead === 0) {
    await panggilBerikutnya({ ...req.state, walkin_ahead: 0 });
  }

  // Kebalikannya: menaikkan hitungan berarti operator menyatakan ada orang
  // yang gilirannya lebih dulu daripada pemegang nomor yang barusan
  // dipanggil. Panggilan itu harus ditarik kembali — membiarkannya berarti
  // dua orang berdiri di depan booth sama-sama merasa sedang dipanggil.
  //
  // Hanya yang berstatus 'called'. Yang sudah 'serving' sedang berfoto dan
  // tidak boleh diusik apa pun alasannya.
  if (patch.walkin_ahead > 0) {
    await supabase
      .from('queue_tickets')
      .update({ status: 'waiting', called_at: null })
      .eq('device_id', req.state.device_id)
      .eq('status', 'called');
  }

  res.json({ success: true, ...patch });
});

router.post('/:slug/op/call-next', bukaState, async (req, res) => {
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
router.post('/:slug/op/issue', bukaState, async (req, res) => {
  try {
    const { data, error } = await supabase.rpc('queue_take_ticket', {
      p_slug: req.state.queue_slug,
      p_name: String(req.body.display_name || '').trim() || null,
      p_phone: normalHp(req.body.phone),
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
router.post('/:slug/op/t/:ticketId/skip', bukaState, async (req, res) => {
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
    const durasi = await durasiSesiDetik(state);
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
      estimasi_per_sesi: durasi,
      // Estimasi untuk orang yang BELUM bertiket: seolah dia mengambil nomor
      // sekarang juga, jadi semua yang menunggu dihitung ada di depannya.
      estimasi_tunggu: etaDetik(state, papan, menunggu, durasi),
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
      .select('id, name, thumbnail_url, image_url, photo_count, orientation, sort_order, category_id')
      .eq('client_id', state.devices.client_id)
      .eq('is_active', true)
      .eq('type', 'static')
      .order('sort_order', { ascending: true });

    // Kategori harus sama persis dengan yang dilihat kios, kalau tidak orang
    // yang memilih dari HP melihat daftar yang berbeda dari layar booth.
    const { data: kategori } = await supabase
      .from('frame_categories')
      .select('id, name, sort_order')
      .eq('client_id', state.devices.client_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    res.json({
      success: true,
      frames: saringKategoriMati(data, kategori),
      categories: kategori || [],
    });
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

  // Nama dan nomor HP WAJIB. Notifikasi push gagal diam-diam terlalu sering
  // (izin ditolak, iPhone tanpa Add to Home Screen, HP mati), dan satu-satunya
  // jaring pengaman yang tersisa adalah operator menghubungi orangnya lewat
  // WhatsApp. Tanpa nomor, orang yang menjauh dari tenant hilang begitu saja.
  const nama    = String(req.body.display_name || '').trim();
  const telepon = normalHp(req.body.phone);

  if (nama.length < 2) {
    return res.status(400).json({ success: false, message: 'Nama wajib diisi.', code: 'NAMA_WAJIB' });
  }
  if (!telepon || telepon.length < 11 || telepon.length > 15) {
    return res.status(400).json({ success: false, message: 'Nomor HP wajib diisi dengan benar, contoh 0812xxxxxxx.', code: 'HP_WAJIB' });
  }

  try {
    const { data, error } = await supabase.rpc('queue_take_ticket', {
      p_slug: String(req.params.slug || '').toLowerCase(),
      p_name: nama,
      p_phone: telepon,
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

    // Booth yang sedang menganggur saat tiket ini masuk tidak akan pernah
    // memicu kiosk/done, jadi tanpa panggilan di sini orang pertama hari itu
    // menunggu selamanya tanpa pernah melihat kodenya. panggilBerikutnya
    // menolak sendiri kalau booth sibuk atau barisan fisik belum habis, jadi
    // aman dipanggil tanpa syarat tambahan.
    await panggilBerikutnya(state);

    const papan = await ambilPapan(state.device_id);
    const durasi = await durasiSesiDetik(state);
    const posisi = hitungPosisi(papan, tiket.id, state.walkin_ahead);

    res.status(201).json({
      success: true,
      ticket_id: tiket.id,
      nomor: tiket.ticket_no,
      kode: tiket.claim_code,
      posisi,
      estimasi_tunggu: hitungEta(state, papan, tiket.id, durasi),
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
    const durasi = await durasiSesiDetik(state);
    const posisi = hitungPosisi(papan, tiket.id, state.walkin_ahead);

    res.json({
      success: true,
      ticket_id: tiket.id,
      nomor: tiket.ticket_no,
      kode: tiket.claim_code,
      nama: tiket.display_name,
      status: tiket.status,
      posisi,
      estimasi_tunggu: hitungEta(state, papan, tiket.id, durasi),
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
