// Perakit "Story IG" dari hasil sesi + template (latar, slot, stiker).
//
// Satu template = latar 1080x1920, daftar slot, dan stiker opsional di depan.
// Slot: { isi, x, y, w, h, rot, bingkai, warna_bingkai }
//   isi  : 'strip_kiri' | 'strip_kanan' | 'hasil' | 'animasi' | 'foto_strip'
//          foto_strip = foto mentah sesi (tanpa frame) ditumpuk vertikal
//   x,y  : pojok kiri-atas kotak SEBELUM diputar (piksel kanvas 1080x1920)
//   w,h  : ukuran kotak; isi diisi "cover" (dipotong, tidak gepeng)
//   rot  : derajat, searah jarum jam, berporos di tengah kotak — SAMA dengan
//          CSS rotate() di editor dasbor (arah ffmpeg rotate sudah diuji sama)
//   bingkai : tebal tepi polos (px) di DALAM kotak, warna_bingkai default putih
// Urutan slot = urutan tumpukan (yang belakangan di atas); stiker paling depan.
//
// Kenapa dua tahap: lapisan diam (latar + strip miring) dirakit SEKALI jadi PNG.
// Kalau semuanya ditaruh di satu graf video, strip diputar ulang tiap frame
// dan PNG latar didekode ulang 300x — terukur 10,3 dtk vs 2,5 dtk per Story.
//
// Pelat diam dikomposit di RGB (overlay format=rgb). Tahap video dikomposit di
// YUV, tapi setiap lapisan dikonversi SENDIRI ke BT.709 limited range sebelum
// overlay — jangan biarkan overlay yang mengonversi RGBA, karena ia memakai
// matriks BT.601 dan warna foto bergeser. Terukur di VPS (ffmpeg 4.4): rata-rata
// warna identik dengan jalur RGB, waktu 3,3 -> 2,7 dtk.

const { spawn } = require('child_process');
const fs = require('fs/promises');
const path = require('path');

const W = 1080;
const H = 1920;
// 15 fps: foto di slot animasi hanya berganti tiap 0,9 dtk, jadi 30 fps tidak
// menambah kehalusan tapi menggandakan kerja (VPS: 6,4 -> 2,7 dtk per Story).
const FPS = 15;
const DURASI_MIN = 8;   // detik; animasi pendek diulang sampai lewat ini
const DURASI_MAKS = 20;

const FFMPEG = process.env.FFMPEG_PATH || 'ffmpeg';
const KE_YUVA = 'scale=out_color_matrix=bt709:out_range=tv,format=yuva420p';
const FFPROBE = process.env.FFPROBE_PATH || 'ffprobe';

function jalankan(cmd, args, batasMs = 90_000) {
  return new Promise((resolve, reject) => {
    const p = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'] });
    let out = '';
    let err = '';
    p.stdout.on('data', (d) => { out += d; });
    p.stderr.on('data', (d) => { err += d; });
    const t = setTimeout(() => { p.kill('SIGKILL'); reject(new Error(`${cmd} melewati batas waktu`)); }, batasMs);
    p.on('error', (e) => { clearTimeout(t); reject(e); });
    p.on('close', (code) => {
      clearTimeout(t);
      if (code === 0) resolve(out);
      else reject(new Error(`${cmd} keluar ${code}: ${err.slice(-800)}`));
    });
  });
}

async function durasiMedia(file) {
  try {
    const out = await jalankan(FFPROBE, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', file], 20_000);
    const d = parseFloat(out);
    return Number.isFinite(d) && d > 0 ? d : null;
  } catch {
    return null;
  }
}

const bulat = (v) => Math.round(Number(v) || 0);

/** Ukuran kotak setelah diputar — dihitung sendiri agar posisi tengahnya pasti. */
function ukuranPutar(w, h, deg) {
  const a = (deg * Math.PI) / 180;
  const c = Math.abs(Math.cos(a));
  const s = Math.abs(Math.sin(a));
  return { ow: Math.ceil(w * c + h * s), oh: Math.ceil(w * s + h * c) };
}

/**
 * Rantai filter untuk satu slot: [sumber] -> potong/skala/bingkai/putar -> [label].
 * Mengembalikan { filter, x, y } — posisi overlay supaya titik tengahnya tetap.
 */
function filterSlot(slot, sumber, label, { video = false } = {}) {
  const w = Math.max(8, bulat(slot.w));
  const h = Math.max(8, bulat(slot.h));
  const rot = Number(slot.rot) || 0;
  const b = Math.max(0, Math.min(bulat(slot.bingkai), Math.floor(Math.min(w, h) / 3)));
  const iw = w - 2 * b;
  const ih = h - 2 * b;
  const warna = /^#[0-9a-f]{6}$/i.test(slot.warna_bingkai || '') ? slot.warna_bingkai : '#ffffff';

  const rantai = [];
  if (slot.isi === 'strip_kiri') rantai.push('crop=iw/2:ih:0:0');
  if (slot.isi === 'strip_kanan') rantai.push('crop=iw/2:ih:iw/2:0');
  if (video) rantai.push(`fps=${FPS}`);
  // in_color_matrix hanya berpengaruh pada sumber YUV (MP4 animasi); PNG/GIF
  // sudah RGB dan melewatinya begitu saja.
  rantai.push(`scale=${iw}:${ih}:force_original_aspect_ratio=increase:in_color_matrix=bt709:in_range=tv`);
  rantai.push(`crop=${iw}:${ih}`, 'format=rgba');
  if (b > 0) rantai.push(`pad=${w}:${h}:${b}:${b}:color=${warna}`);

  let ow = w;
  let oh = h;
  if (rot % 360 !== 0) {
    ({ ow, oh } = ukuranPutar(w, h, rot));
    rantai.push(`rotate=${rot}*PI/180:c=none:ow=${ow}:oh=${oh}`);
  }
  if (video) rantai.push(KE_YUVA);
  return {
    filter: `${sumber}${rantai.join(',')}[${label}]`,
    x: bulat(slot.x + w / 2 - ow / 2),
    y: bulat(slot.y + h / 2 - oh / 2),
  };
}

/**
 * Rakit satu Story.
 * @param {object} o
 * @param {object[]} o.slots
 * @param {string} o.latar        PNG/JPG latar
 * @param {string|null} o.stiker  PNG transparan di depan (opsional)
 * @param {string} o.hasil        hasil cetak (final.png)
 * @param {string|null} o.fotoStrip strip foto mentah untuk slot foto_strip (opsional)
 * @param {string|null} o.animasi MP4/GIF animasi sesi (opsional)
 * @param {string} o.kerja        folder kerja sementara
 * @returns {Promise<{file: string, jenis: 'video'|'gambar'}>}
 */
async function rakitStory({ slots, latar, stiker, hasil, fotoStrip = null, animasi, kerja }) {
  // Tanpa animasi di sesi ini, slot animasi diisi hasil cetak (tetap diam).
  const pakaiAnimasi = Boolean(animasi) && slots.some((s) => s.isi === 'animasi');
  const statis = (s) => !(pakaiAnimasi && s.isi === 'animasi');

  // ── Tahap 1: kelompokkan slot diam berurutan menjadi pelat PNG ──────────
  const kelompok = []; // [{ jenis:'pelat', slots:[] } | { jenis:'animasi', slot }]
  for (const s of slots) {
    if (statis(s)) {
      const akhir = kelompok[kelompok.length - 1];
      if (akhir && akhir.jenis === 'pelat') akhir.slots.push(s);
      else kelompok.push({ jenis: 'pelat', slots: [s] });
    } else {
      kelompok.push({ jenis: 'animasi', slot: s });
    }
  }
  if (!kelompok.length || kelompok[0].jenis !== 'pelat') kelompok.unshift({ jenis: 'pelat', slots: [] });
  kelompok[0].pertama = true;
  // Stiker selalu paling depan: menumpang pelat terakhir kalau pelat itu sudah
  // di atas semua animasi, selain itu jadi pelat sendiri.
  if (stiker) {
    const akhir = kelompok[kelompok.length - 1];
    if (akhir.jenis === 'pelat' && (!akhir.pertama || !pakaiAnimasi)) akhir.stiker = true;
    else kelompok.push({ jenis: 'pelat', slots: [], stiker: true });
  }

  const pelat = [];
  for (let i = 0; i < kelompok.length; i++) {
    const k = kelompok[i];
    if (k.jenis !== 'pelat') continue;
    const file = path.join(kerja, `pelat${i}.png`);
    await rakitPelat({ ...k, latar, stiker, hasil, fotoStrip, file });
    k.file = file;
    pelat.push(file);
  }

  // ── Tanpa animasi: semua sudah jadi satu pelat → JPEG ──────────────────
  if (!pakaiAnimasi) {
    const out = path.join(kerja, 'story.jpg');
    const masukan = [];
    const graf = [];
    kelompok.forEach((k, i) => { masukan.push('-i', k.file); if (i > 0) graf.push(i); });
    let akhir = '[0:v]format=rgba[b0]';
    let label = 'b0';
    graf.forEach((idx, n) => {
      akhir += `;[${label}][${idx}:v]overlay=0:0:format=rgb[b${n + 1}]`;
      label = `b${n + 1}`;
    });
    await jalankan(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...masukan,
      '-filter_complex', akhir, '-map', `[${label}]`, '-frames:v', '1', '-q:v', '2', out]);
    return { file: out, jenis: 'gambar' };
  }

  // ── Tahap 2: video = pelat dasar + animasi berputar + pelat atas ───────
  const d = await durasiMedia(animasi);
  const durasi = d ? Math.min(DURASI_MAKS, d * Math.max(1, Math.ceil(DURASI_MIN / d))) : DURASI_MIN;
  const gif = /\.gif$/i.test(animasi);

  const masukan = [];
  const idxPelat = new Map();
  kelompok.forEach((k, i) => {
    if (k.jenis === 'pelat') { idxPelat.set(i, masukan.length / 2); masukan.push('-i', k.file); }
  });
  const idxAnim = masukan.length / 2;
  masukan.push(...(gif ? ['-ignore_loop', '0'] : ['-stream_loop', '-1']), '-i', animasi);

  const nAnim = kelompok.filter((k) => k.jenis === 'animasi').length;
  const graf = [];
  graf.push(`[${idxPelat.get(0)}:v]scale=out_color_matrix=bt709:out_range=tv,format=yuv420p,loop=loop=-1:size=1:start=0,fps=${FPS}[b0]`);
  if (nAnim > 1) {
    graf.push(`[${idxAnim}:v]split=${nAnim}${Array.from({ length: nAnim }, (_, i) => `[a${i}]`).join('')}`);
  }
  let label = 'b0';
  let nA = 0;
  let n = 0;
  kelompok.forEach((k, i) => {
    if (i === 0) return;
    n += 1;
    if (k.jenis === 'animasi') {
      const sumber = nAnim > 1 ? `[a${nA}]` : `[${idxAnim}:v]`;
      const f = filterSlot(k.slot, sumber, `v${nA}`, { video: true });
      graf.push(f.filter);
      graf.push(`[${label}][v${nA}]overlay=${f.x}:${f.y}:format=yuv420[b${n}]`);
      nA += 1;
    } else {
      graf.push(`[${idxPelat.get(i)}:v]${KE_YUVA},loop=loop=-1:size=1:start=0,fps=${FPS}[p${n}]`);
      graf.push(`[${label}][p${n}]overlay=0:0:format=yuv420[b${n}]`);
    }
    label = `b${n}`;
  });
  graf.push(`[${label}]format=yuv420p[out]`);

  const out = path.join(kerja, 'story.mp4');
  await jalankan(FFMPEG, [
    '-y', '-hide_banner', '-loglevel', 'error',
    ...masukan,
    '-filter_complex', graf.join(';'),
    '-map', '[out]', '-t', durasi.toFixed(2), '-r', String(FPS),
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '21', '-threads', '2',
    '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-color_range', 'tv',
    '-movflags', '+faststart', '-an', out,
  ], 120_000);
  return { file: out, jenis: 'video' };
}

/**
 * Strip dari foto mentah sesi: tiap foto dipotong "cover" ke sel w x (h/n),
 * ditumpuk vertikal dengan garis pemisah tipis, hasil persis w x h.
 * Dibuat pada ukuran slot terbesar supaya tidak diskalakan ulang.
 */
async function rakitStripFoto(foto, w, h, file, { garis = 4, warnaGaris = '#1a1410' } = {}) {
  const n = foto.length;
  w = Math.max(8, bulat(w)); h = Math.max(8, bulat(h));
  const sel = Math.ceil((h - garis * (n - 1)) / n);
  const masukan = [];
  const graf = [];
  foto.forEach((f, i) => {
    masukan.push('-i', f);
    const pad = i < n - 1 ? `,pad=${w}:${sel + garis}:0:0:color=${warnaGaris}` : '';
    graf.push(`[${i}:v]scale=${w}:${sel}:force_original_aspect_ratio=increase,crop=${w}:${sel},setsar=1,format=rgba${pad}[f${i}]`);
  });
  graf.push(n > 1 ? `${foto.map((_, i) => `[f${i}]`).join('')}vstack=inputs=${n},crop=${w}:${h}:0:0[out]` : `[f0]crop=${w}:${h}:0:0[out]`);
  await jalankan(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...masukan,
    '-filter_complex', graf.join(';'), '-map', '[out]', '-frames:v', '1', file]);
  return file;
}

/** Satu pelat PNG: (latar | transparan) + slot diam + (stiker). */
async function rakitPelat({ slots, pertama, stiker: pakaiStiker, latar, stiker, hasil, fotoStrip, file }) {
  const masukan = [];
  const graf = [];
  let nMasukan = 1; // indeks input ffmpeg; '-f lavfi' membuat panjang argumen tak bisa dipakai
  let label;
  if (pertama) {
    masukan.push('-i', latar);
    graf.push(`[0:v]scale=${W}:${H},format=rgba[b0]`);
  } else {
    masukan.push('-f', 'lavfi', '-i', `color=c=black@0.0:s=${W}x${H},format=rgba`);
    graf.push('[0:v]format=rgba[b0]');
  }
  label = 'b0';

  if (slots.length) {
    slots.forEach((s, i) => {
      const idx = nMasukan++;
      masukan.push('-i', s.isi === 'foto_strip' && fotoStrip ? fotoStrip : hasil);
      const f = filterSlot(s, `[${idx}:v]`, `s${i}`);
      graf.push(f.filter);
      graf.push(`[${label}][s${i}]overlay=${f.x}:${f.y}:format=rgb[c${i}]`);
      label = `c${i}`;
    });
  }
  if (pakaiStiker && stiker) {
    const idx = nMasukan++;
    masukan.push('-i', stiker);
    graf.push(`[${idx}:v]scale=${W}:${H},format=rgba[stk]`);
    graf.push(`[${label}][stk]overlay=0:0:format=rgb[akhir]`);
    label = 'akhir';
  }
  graf.push(`[${label}]format=rgba[keluar]`);
  await jalankan(FFMPEG, ['-y', '-hide_banner', '-loglevel', 'error', ...masukan,
    '-filter_complex', graf.join(';'), '-map', '[keluar]', '-frames:v', '1', file]);
}

/**
 * Frame strip 2 kolom (4R berisi dua strip) — hanya ini yang boleh dibelah.
 * Tiap separuh harus berisi jumlah slot yang sama dengan ukuran serupa.
 * Posisinya boleh tidak kembar (banyak desain menggeser satu kolom), tapi
 * frame seperti Playlist 7 slot (satu strip besar + 4 cetakan mini di kanan)
 * harus ditolak: separuh kanannya bukan strip.
 */
function frameStrip2(frame) {
  if (!frame || String(frame.paper_size || '').toUpperCase() !== '4R') return false;
  const W0 = Number(frame.output_width) || 0;
  const slots = Array.isArray(frame.photo_slots) ? frame.photo_slots : [];
  if (!W0 || slots.length < 4 || !slots.every((s) => s.width < W0 / 2)) return false;
  const kiri = slots.filter((s) => s.x + s.width / 2 < W0 / 2);
  const kanan = slots.filter((s) => s.x + s.width / 2 >= W0 / 2);
  if (kiri.length < 2 || kiri.length !== kanan.length) return false;
  const median = (a) => { const b = [...a].sort((p, q) => p - q); return b[Math.floor(b.length / 2)]; };
  const mirip = (k) => {
    const r = median(kanan.map((s) => s[k])) / median(kiri.map((s) => s[k]));
    return r > 0.75 && r < 1.33;
  };
  return mirip('width') && mirip('height');
}

async function bersihkan(dir) {
  try { await fs.rm(dir, { recursive: true, force: true }); } catch { /* biarkan */ }
}

module.exports = { rakitStory, rakitStripFoto, frameStrip2, bersihkan, ukuranPutar, W, H };
