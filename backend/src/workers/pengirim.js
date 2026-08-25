// Pekerja latar: mengantar hasil foto ke pelanggan yang sudah melapor.
//
// Sebagian besar pengaduan datang justru karena berkasnya BELUM sampai
// server — jadi tidak cukup mencoba sekali saat laporan masuk. Pekerja ini
// memeriksa ulang berkala, dan begitu mesin photobooth berhasil mengunggah
// (lewat antrean lokalnya), hasilnya langsung dikirim tanpa perlu ada yang
// menekan tombol.

const { supabase } = require('../middleware/validateDevice');
const { kirimHasilSesi, kabariOperator, smtpSiap } = require('../utils/deliver');

const JEDA_MS = 60 * 1000;      // sekali semenit sudah lebih dari cukup
const SEKALI_ANGKUT = 5;        // batasi supaya satu putaran tidak berlarut
const MENYERAH_SETELAH_HARI = 7;

let berjalan = false;

/**
 * Proses satu pengaduan. Mengembalikan true kalau berhasil dikirim.
 *
 * Barisnya "diklaim" lebih dulu lewat update bersyarat (hanya kena kalau
 * statusnya masih 'baru'). Tanpa ini, pemicu langsung saat laporan masuk dan
 * putaran berkala bisa menyambar baris yang sama — mengunggah lampiran
 * makan puluhan detik, dan selama itu statusnya belum berubah. Akibatnya
 * pelanggan menerima email kembar; sudah terbukti terjadi saat uji coba.
 */
async function tangani(pengaduan) {
  const { data: klaim } = await supabase
    .from('complaints')
    .update({ status: 'proses', updated_at: new Date().toISOString() })
    .eq('id', pengaduan.id)
    .eq('status', 'baru')
    .select('id')
    .maybeSingle();

  if (!klaim) return false; // sudah dikerjakan proses lain

  const lepasKlaim = async (extra = {}) => {
    await supabase
      .from('complaints')
      .update({ status: 'baru', updated_at: new Date().toISOString(), ...extra })
      .eq('id', pengaduan.id);
  };

  const { data: session } = await supabase
    .from('sessions')
    .select('id, client_id, created_at, result_url, gif_url, gif_status, video_url, video_status')
    .eq('id', pengaduan.session_id)
    .maybeSingle();

  if (!session) {
    await supabase
      .from('complaints')
      .update({ status: 'selesai', delivery_error: 'sesi tidak ditemukan', updated_at: new Date().toISOString() })
      .eq('id', pengaduan.id);
    return false;
  }

  const hasil = await kirimHasilSesi({
    session,
    tujuan: pengaduan.email,
    kodeSesi: pengaduan.transaction_code,
  });

  if (hasil.ok) {
    // Bukan lepasKlaim: statusnya maju ke 'terkirim', bukan kembali ke antrean.
    await supabase
      .from('complaints')
      .update({
        status: 'terkirim',
        delivered_at: new Date().toISOString(),
        delivery_error: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', pengaduan.id);

    try {
      await kabariOperator({
        kodeSesi: pengaduan.transaction_code,
        tujuan: pengaduan.email,
        jumlahLampiran: hasil.jumlahLampiran ?? 0,
      });
    } catch { /* notifikasi bukan alasan menggagalkan pengiriman */ }
    return true;
  }

  // Gagal — kembalikan ke antrean supaya dicoba lagi putaran berikutnya.
  // "belum ada aset" itu keadaan normal, bukan kegagalan: jangan dicatat
  // sebagai error supaya operator tidak dibanjiri alarm palsu.
  await lepasKlaim(
    hasil.alasan === 'belum ada aset'
      ? {}
      : { delivery_error: String(hasil.alasan).slice(0, 300) }
  );
  return false;
}

// Berapa lama sebuah klaim dianggap basi. Pengiriman terberat yang pernah
// terukur (5 lampiran, 3,6MB) selesai di bawah semenit; sepuluh menit sudah
// sangat longgar.
const KLAIM_BASI_MS = 10 * 60 * 1000;

async function putaran() {
  if (berjalan) return;
  berjalan = true;
  try {
    // Pulihkan baris yang tertinggal di 'proses' karena proses mati di tengah
    // pengiriman — tanpa ini pengaduan tersebut tidak akan pernah dicoba lagi.
    await supabase
      .from('complaints')
      .update({ status: 'baru', updated_at: new Date().toISOString() })
      .eq('status', 'proses')
      .lt('updated_at', new Date(Date.now() - KLAIM_BASI_MS).toISOString());

    const { data: antrean, error } = await supabase
      .from('complaints')
      .select('id, session_id, transaction_code, email, created_at')
      .eq('status', 'baru')
      .order('created_at', { ascending: true })
      .limit(SEKALI_ANGKUT);

    if (error) {
      console.error('[Pengirim] Gagal membaca antrean:', error.message);
      return;
    }
    if (!antrean || !antrean.length) return;

    const batasMenyerah = Date.now() - MENYERAH_SETELAH_HARI * 24 * 60 * 60 * 1000;

    for (const pengaduan of antrean) {
      // Sudah lewat seminggu dan berkasnya tak kunjung ada: berhenti mencoba,
      // biar operator yang menutup lewat jalur manual.
      if (new Date(pengaduan.created_at).getTime() < batasMenyerah) {
        await supabase
          .from('complaints')
          .update({
            delivery_error: `menyerah setelah ${MENYERAH_SETELAH_HARI} hari, berkas tidak pernah sampai server`,
            updated_at: new Date().toISOString(),
            status: 'selesai',
          })
          .eq('id', pengaduan.id);
        console.warn(`[Pengirim] Menyerah untuk ${pengaduan.transaction_code}`);
        continue;
      }
      await tangani(pengaduan);
    }
  } catch (e) {
    console.error('[Pengirim] Kesalahan putaran:', e.message);
  } finally {
    berjalan = false;
  }
}

/** Coba satu pengaduan segera, tanpa menunggu putaran berikutnya. */
async function cobaSegera(complaintId) {
  try {
    const { data } = await supabase
      .from('complaints')
      .select('id, session_id, transaction_code, email, created_at, status')
      .eq('id', complaintId)
      .maybeSingle();
    if (data && data.status === 'baru') await tangani(data);
  } catch (e) {
    console.error('[Pengirim] cobaSegera gagal:', e.message);
  }
}

function mulai() {
  if (!smtpSiap) {
    console.warn('[Pengirim] Tidak dijalankan: SMTP belum dikonfigurasi.');
    return;
  }
  setInterval(putaran, JEDA_MS).unref();
  console.log(`[Pengirim] Aktif — memeriksa pengaduan setiap ${JEDA_MS / 1000} detik.`);
  putaran();
}

module.exports = { mulai, cobaSegera, putaran };
