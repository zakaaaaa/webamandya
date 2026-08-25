// Pengiriman hasil foto ke email pelanggan.
//
// Dipakai alur pengaduan: begitu laporan masuk, semua aset sesi dikumpulkan
// lalu dikirim. Kalau asetnya belum ada di server (kasus paling sering:
// mesin gagal mengunggah), pekerja latar akan mencoba lagi berkala sampai
// berkasnya muncul — lihat src/workers/pengirim.js.

const fs = require('fs');
const path = require('path');
const { supabase } = require('../middleware/validateDevice');
const { sendMessage, esc } = require('./telegram');

// Gambar di email TIDAK diambil dari jarak jauh, melainkan ditempel inline
// (cid). Dua alasan yang sudah terbukti di Gmail:
//   1. Logo situs berformat WebP — Gmail tidak mendukungnya sama sekali.
//   2. Photo strip aslinya PNG ~9MB; proxy gambar Gmail menolak berkas
//      sebesar itu, jadi kotaknya kosong.
// Versi inline kebal proxy, kebal pemblokiran gambar, dan formatnya kita
// yang tentukan.
const LOGO_PATH = path.join(__dirname, '..', '..', 'assets', 'logo-pk.jpg');
const CID_LOGO = 'logo-pk@pabrikenangan';
const CID_STRIP = 'strip-preview@pabrikenangan';
const LEBAR_PRATINJAU = 600;

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;
const SENDER_NAME = 'Pabrik Kenangan';

const smtpSiap = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

// Gmail menolak email di atas 25MB dan Resend di atas 40MB. Sisakan ruang
// untuk overhead base64 (~33%) — di atas ambang ini aset hanya dikirim
// sebagai tautan, bukan lampiran.
const BUDGET_LAMPIRAN = 12 * 1024 * 1024;

// Batas per berkas. Upstream VPS ini hanya ~28 KB/detik saat mengirim SMTP:
// satu strip PNG 8,55MB pernah membuat emailnya baru sampai setelah 6 menit,
// sementara kelima fotonya cuma 0,28MB masing-masing. Berkas gemuk lebih baik
// jadi tautan — pratinjaunya toh sudah tampil di badan email.
const BATAS_PER_BERKAS = 4 * 1024 * 1024;

// Video sengaja tidak pernah dilampirkan: ukurannya paling besar dan hampir
// selalu membuat email ditolak. Tautannya tetap disertakan.
const UNDUH_TIMEOUT_MS = 60000;

let transporter = null;
function getTransporter() {
  if (!smtpSiap) return null;
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
      // Tanpa batas waktu, koneksi yang menggantung menyandera pengaduan
      // sampai pemulihan klaim basi 10 menit menyapunya.
      connectionTimeout: 20000,
      greetingTimeout: 20000,
      socketTimeout: 5 * 60 * 1000,
    });
  }
  return transporter;
}

/** Semua berkas milik satu sesi, apa adanya menurut database. */
async function kumpulkanAset(session) {
  const { data: photos } = await supabase
    .from('photos')
    .select('photo_url, photo_order')
    .eq('session_id', session.id)
    .order('photo_order', { ascending: true });

  return {
    strip: session.result_url || null,
    foto: (photos || []).map((p) => p.photo_url).filter(Boolean),
    gif: session.gif_status === 'ready' ? session.gif_url : null,
    video: session.video_status === 'ready' ? session.video_url : null,
  };
}

function adaSesuatuUntukDikirim(aset) {
  return Boolean(aset.strip || aset.foto.length || aset.gif || aset.video);
}

async function unduh(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(UNDUH_TIMEOUT_MS) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

/**
 * Lampirkan sebanyak yang muat dalam anggaran, mulai dari yang paling
 * berharga: strip dulu, baru foto satuan, terakhir GIF.
 */
async function siapkanLampiran(aset, kodeSesi) {
  const pendek = kodeSesi.slice(0, 8);
  const antre = [];
  if (aset.strip) antre.push({ url: aset.strip, filename: `photostrip_${pendek}.png` });
  aset.foto.forEach((u, i) => antre.push({ url: u, filename: `foto_${i + 1}_${pendek}.jpg` }));
  if (aset.gif) antre.push({ url: aset.gif, filename: `animasi_${pendek}.gif` });

  const lampiran = [];
  const gagal = [];
  let total = 0;
  let stripBuf = null; // disimpan untuk pratinjau, walau terlalu besar dilampirkan

  for (const item of antre) {
    try {
      const buf = await unduh(item.url);
      if (item.url === aset.strip) stripBuf = buf;
      if (buf.length > BATAS_PER_BERKAS || total + buf.length > BUDGET_LAMPIRAN) {
        gagal.push(item.filename);
        continue;
      }
      total += buf.length;
      lampiran.push({ filename: item.filename, content: buf });
    } catch (e) {
      console.error(`[Kirim] Gagal mengunduh ${item.filename}: ${e.message}`);
      gagal.push(item.filename);
    }
  }
  return { lampiran, total, gagal, stripBuf };
}

/** Kecilkan strip jadi pratinjau ringan yang aman ditempel di email. */
async function buatPratinjau(stripBuf) {
  if (!stripBuf) return null;
  try {
    const sharp = require('sharp');
    return await sharp(stripBuf)
      .resize({ width: LEBAR_PRATINJAU, withoutEnlargement: true })
      .jpeg({ quality: 80 })
      .toBuffer();
  } catch (e) {
    console.error('[Kirim] Gagal membuat pratinjau strip:', e.message);
    return null;
  }
}

const tombol = (href, teks) =>
  `<a href="${href}" style="display:inline-block;padding:11px 20px;border-radius:10px;` +
  `background:#D42B22;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px">${teks}</a>`;

const tautan = (href, teks) =>
  `<a href="${href}" style="color:#C02018;text-decoration:underline">${teks}</a>`;

function susunEmail({ aset, kodeSesi, waktuSesi, halamanUnduh, adaLampiran, adaPratinjau }) {
  const daftar = [];
  if (aset.strip) daftar.push(`<li style="margin-bottom:6px">Photo strip — ${tautan(aset.strip, 'unduh')}</li>`);
  if (aset.foto.length) {
    const per = aset.foto.map((u, i) => tautan(u, `${i + 1}`)).join(' · ');
    daftar.push(`<li style="margin-bottom:6px">${aset.foto.length} foto asli — ${per}</li>`);
  }
  if (aset.gif) daftar.push(`<li style="margin-bottom:6px">GIF animasi — ${tautan(aset.gif, 'unduh')}</li>`);
  if (aset.video) daftar.push(`<li style="margin-bottom:6px">Video — ${tautan(aset.video, 'unduh')}</li>`);

  const html = `
<div style="margin:0;padding:24px 12px;background:#FAF7F5;font-family:'Helvetica Neue',Arial,sans-serif">
  <div style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid rgba(212,43,34,0.12);border-radius:18px;padding:28px 24px">
    <img src="cid:${CID_LOGO}" alt="Pabrik Kenangan" width="150"
         style="display:block;margin:0 auto 22px;max-width:150px;height:auto">

    <h1 style="margin:0 0 8px;font-size:20px;font-weight:800;color:#150C09;text-align:center">
      Hasil foto kamu sudah siap
    </h1>
    <p style="margin:0 0 22px;font-size:13px;color:#9E8880;text-align:center">
      Sesi ${esc(waktuSesi)}
    </p>

    ${adaPratinjau ? `<div style="text-align:center;margin-bottom:22px">
      <img src="cid:${CID_STRIP}" alt="Photo strip" width="220"
           style="max-width:220px;height:auto;border-radius:12px;border:1px solid rgba(212,43,34,0.12)">
    </div>` : ''}

    ${adaLampiran ? `<p style="margin:0 0 16px;font-size:14px;color:#4A2E22;line-height:1.6">
      Berkasnya kami lampirkan langsung di email ini. Semuanya juga bisa diunduh lewat tautan di bawah:
    </p>` : `<p style="margin:0 0 16px;font-size:14px;color:#4A2E22;line-height:1.6">
      Berikut hasil sesi fotomu:
    </p>`}

    <ul style="margin:0 0 24px;padding-left:20px;font-size:14px;color:#4A2E22">
      ${daftar.join('\n      ')}
    </ul>

    <div style="text-align:center;margin-bottom:24px">
      ${tombol(halamanUnduh, 'Buka halaman hasil')}
    </div>

    <div style="height:1px;background:rgba(212,43,34,0.12);margin-bottom:16px"></div>
    <p style="margin:0;font-size:11.5px;color:#B0A09A;text-align:center;line-height:1.6">
      Email ini dikirim karena kamu melaporkan hasil fotomu belum diterima.<br>
      Kode sesi: ${esc(kodeSesi)}
    </p>
  </div>
</div>`;

  const teks = [
    'Hasil foto kamu sudah siap.',
    `Sesi ${waktuSesi}`,
    '',
    aset.strip ? `Photo strip: ${aset.strip}` : null,
    ...aset.foto.map((u, i) => `Foto ${i + 1}: ${u}`),
    aset.gif ? `GIF: ${aset.gif}` : null,
    aset.video ? `Video: ${aset.video}` : null,
    '',
    `Halaman hasil: ${halamanUnduh}`,
    `Kode sesi: ${kodeSesi}`,
  ].filter(Boolean).join('\n');

  return { html, teks };
}

/**
 * Kirim seluruh aset sesi ke satu alamat email.
 * @returns {Promise<{ok:boolean, alasan?:string, jumlahLampiran?:number}>}
 */
async function kirimHasilSesi({ session, tujuan, kodeSesi }) {
  if (!smtpSiap) return { ok: false, alasan: 'SMTP belum dikonfigurasi' };

  const aset = await kumpulkanAset(session);
  if (!adaSesuatuUntukDikirim(aset)) {
    return { ok: false, alasan: 'belum ada aset' };
  }

  const frontend = (process.env.FRONTEND_URL || 'https://www.pabrikenangan.my.id').replace(/\/$/, '');
  const halamanUnduh = `${frontend}/download/${encodeURIComponent(kodeSesi)}`;
  const waktuSesi = new Date(session.created_at).toLocaleString('id-ID', {
    dateStyle: 'long', timeStyle: 'short', timeZone: 'Asia/Jakarta',
  });

  const { lampiran, total, gagal, stripBuf } = await siapkanLampiran(aset, kodeSesi);

  // Gambar yang tampil di badan email: logo + pratinjau strip, keduanya
  // ditempel inline supaya tidak bergantung pada proxy gambar klien email.
  const inline = [];
  if (fs.existsSync(LOGO_PATH)) {
    inline.push({ filename: 'logo-pk.jpg', path: LOGO_PATH, cid: CID_LOGO });
  }
  const pratinjau = await buatPratinjau(stripBuf);
  if (pratinjau) {
    inline.push({ filename: 'photostrip-preview.jpg', content: pratinjau, cid: CID_STRIP });
  }

  const { html, teks } = susunEmail({
    aset, kodeSesi, waktuSesi, halamanUnduh,
    adaLampiran: lampiran.length > 0,
    adaPratinjau: Boolean(pratinjau),
  });

  try {
    await getTransporter().sendMail({
      from: `"${SENDER_NAME}" <${SMTP_FROM}>`,
      to: tujuan,
      subject: 'Hasil foto kamu — Pabrik Kenangan',
      text: teks,
      html,
      attachments: [...inline, ...lampiran],
    });
  } catch (e) {
    console.error(`[Kirim] Gagal mengirim ke ${tujuan}: ${e.message}`);
    await catatPengiriman({ session, tujuan, aset, halamanUnduh, status: 'failed' });
    return { ok: false, alasan: e.message };
  }

  await catatPengiriman({ session, tujuan, aset, halamanUnduh, status: 'sent' });
  console.log(
    `[Kirim] Terkirim ke ${tujuan} — ${lampiran.length} lampiran ` +
    `(${(total / 1024 / 1024).toFixed(1)}MB)${gagal.length ? `, ${gagal.length} hanya tautan` : ''}`
  );
  return { ok: true, jumlahLampiran: lampiran.length };
}

async function catatPengiriman({ session, tujuan, aset, halamanUnduh, status }) {
  try {
    await supabase.from('email_deliveries').insert({
      client_id: session.client_id || null,
      recipient_email: tujuan,
      result_url: aset.strip || halamanUnduh,
      status,
    });
  } catch (e) {
    console.error('[Kirim] Gagal mencatat pengiriman:', e.message);
  }
}

/** Beri tahu operator bahwa satu pengaduan sudah tertangani sendiri. */
async function kabariOperator({ kodeSesi, tujuan, jumlahLampiran }) {
  await sendMessage([
    '🟢 <b>Pengaduan tertangani otomatis</b>',
    '',
    `<b>Kode sesi:</b> <code>${esc(kodeSesi)}</code>`,
    `<b>Dikirim ke:</b> ${esc(tujuan)}`,
    `<b>Lampiran:</b> ${jumlahLampiran} berkas`,
    '',
    '<i>Hasilnya sudah sampai ke pelanggan — tidak perlu tindakan.</i>',
  ].join('\n'));
}

module.exports = { kumpulkanAset, adaSesuatuUntukDikirim, kirimHasilSesi, kabariOperator, smtpSiap };
