// Story IG dari halaman unduh: pelanggan memilih template, server merakit
// hasil sesinya ke template itu (utils/story-render.js), menyimpan hasilnya
// di R2, dan mencatatnya di story_renders. Render berikutnya untuk pasangan
// (sesi, template, versi template) yang sama langsung memakai cache itu.
//
// Endpoint publik (dipanggil halaman /download tanpa login), jadi:
//   * hanya sesi paid/free yang dilayani;
//   * render dibatasi per IP dan maksimal 2 berjalan bersamaan, supaya acara
//     ramai tidak mencekik VPS yang juga melayani pembayaran.

const express = require('express');
const os = require('os');
const path = require('path');
const fs = require('fs/promises');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');
const { putObject } = require('../utils/storage');
const { rakitStory, frameStrip2, bersihkan } = require('../utils/story-render');

const MAKS_BERSAMAAN = 2;
let berjalan = 0;
const antre = [];
const sedangDirender = new Map(); // kunci cache -> Promise (cegah render dobel)

function giliran() {
  return new Promise((resolve) => {
    if (berjalan < MAKS_BERSAMAAN) { berjalan += 1; resolve(); } else antre.push(resolve);
  });
}
function selesaiGiliran() {
  const berikut = antre.shift();
  if (berikut) berikut(); else berjalan -= 1;
}

// Sama dengan routes/queue.js: di belakang nginx req.ip selalu 127.0.0.1.
function alamatAsal(req) {
  const maju = req.get('x-forwarded-for');
  if (maju) return maju.split(',')[0].trim();
  return req.ip || req.socket?.remoteAddress || 'x';
}
const jejakIp = new Map();
function bolehRender(ip) {
  const sekarang = Date.now();
  const jendela = 10 * 60 * 1000;
  const cap = jejakIp.get(ip)?.filter((t) => sekarang - t < jendela) || [];
  if (cap.length >= 20) return false;
  cap.push(sekarang);
  jejakIp.set(ip, cap);
  return true;
}

async function ambilSesi(kode) {
  if (!kode) return null;
  const { data } = await supabase
    .from('sessions')
    .select('id, client_id, payment_status, result_url, gif_url, gif_status, frame_id, selected_frame_id')
    .eq('transaction_code', kode)
    .maybeSingle();
  if (!data || !['paid', 'free'].includes(data.payment_status) || !data.result_url) return null;
  return data;
}

async function apakahStrip2(sesi) {
  const id = sesi.frame_id || sesi.selected_frame_id;
  if (!id) return false;
  const { data } = await supabase
    .from('frames')
    .select('paper_size, output_width, photo_slots')
    .eq('id', id)
    .maybeSingle();
  return frameStrip2(data);
}

const versiTemplate = (t) => String(new Date(t.updated_at).getTime());

// GET /api/story/templates?sesi=<kode> — template yang cocok untuk sesi ini.
router.get('/templates', async (req, res) => {
  try {
    const sesi = await ambilSesi(req.query.sesi);
    if (!sesi) return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });

    const strip2 = await apakahStrip2(sesi);
    const { data, error } = await supabase
      .from('story_templates')
      .select('id, nama, jenis, latar_url, stiker_url, pratinjau_url, slots, updated_at')
      .eq('client_id', sesi.client_id)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error) throw error;

    const templates = (data || [])
      .filter((t) => strip2 || t.jenis !== 'strip2')
      .map((t) => ({
        id: t.id,
        nama: t.nama,
        thumb: t.pratinjau_url || t.latar_url,
        stiker: t.pratinjau_url ? null : t.stiker_url,
        video: Boolean(sesi.gif_url) && (t.slots || []).some((s) => s.isi === 'animasi'),
      }));
    return res.json({ success: true, templates });
  } catch (e) {
    console.error('[Story] templates:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal memuat template.' });
  }
});

async function unduh(url, tujuan) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`unduh ${url} -> ${r.status}`);
  await fs.writeFile(tujuan, Buffer.from(await r.arrayBuffer()));
  return tujuan;
}

const ekstensi = (url, cadangan) => {
  const m = /\.([a-z0-9]{3,4})(?:$|\?)/i.exec(url || '');
  return m ? m[1].toLowerCase() : cadangan;
};

async function renderBaru(sesi, template, versi) {
  const kerja = await fs.mkdtemp(path.join(os.tmpdir(), 'story-'));
  try {
    const slots = Array.isArray(template.slots) ? template.slots : [];
    const butuhAnimasi = slots.some((s) => s.isi === 'animasi');
    const animUrl = butuhAnimasi && sesi.gif_status === 'ready' ? sesi.gif_url : null;

    const [latar, hasil, stiker, animasi] = await Promise.all([
      unduh(template.latar_url, path.join(kerja, `latar.${ekstensi(template.latar_url, 'png')}`)),
      unduh(sesi.result_url, path.join(kerja, `hasil.${ekstensi(sesi.result_url, 'png')}`)),
      template.stiker_url ? unduh(template.stiker_url, path.join(kerja, `stiker.${ekstensi(template.stiker_url, 'png')}`)) : null,
      animUrl ? unduh(animUrl, path.join(kerja, `animasi.${ekstensi(animUrl, 'mp4')}`)) : null,
    ]);

    const t0 = Date.now();
    const keluar = await rakitStory({ slots, latar, stiker, hasil, animasi, kerja });
    const ms = Date.now() - t0;

    const ext = keluar.jenis === 'video' ? 'mp4' : 'jpg';
    const key = `results/${sesi.client_id}/${sesi.id}/story/${template.id}-${versi}.${ext}`;
    const stored = await putObject({
      key,
      body: await fs.readFile(keluar.file),
      contentType: keluar.jenis === 'video' ? 'video/mp4' : 'image/jpeg',
    });

    const { data: baris, error } = await supabase
      .from('story_renders')
      .insert({
        session_id: sesi.id,
        template_id: template.id,
        template_versi: versi,
        url: stored.url,
        jenis: keluar.jenis,
        render_ms: ms,
      })
      .select('id, url, jenis')
      .single();
    if (error) throw error;
    console.log(`[Story] ${template.id} sesi ${sesi.id}: ${keluar.jenis} ${ms} ms`);
    return baris;
  } finally {
    await bersihkan(kerja);
  }
}

// POST /api/story/render { sesi, template } -> { url, jenis, id }
router.post('/render', async (req, res) => {
  try {
    const { sesi: kode, template: templateId } = req.body || {};
    const sesi = await ambilSesi(kode);
    if (!sesi) return res.status(404).json({ success: false, message: 'Sesi tidak ditemukan.' });

    // Template nonaktif tetap boleh dirender lewat id-nya: dipakai tombol
    // "Uji render" di editor dasbor. Halaman unduh hanya menampilkan yang aktif.
    const { data: template } = await supabase
      .from('story_templates')
      .select('id, client_id, jenis, latar_url, stiker_url, slots, updated_at')
      .eq('id', templateId)
      .eq('client_id', sesi.client_id)
      .maybeSingle();
    if (!template) return res.status(404).json({ success: false, message: 'Template tidak ditemukan.' });
    if (template.jenis === 'strip2' && !(await apakahStrip2(sesi))) {
      return res.status(400).json({ success: false, message: 'Template ini hanya untuk frame strip.' });
    }

    const versi = versiTemplate(template);
    const { data: ada } = await supabase
      .from('story_renders')
      .select('id, url, jenis')
      .eq('session_id', sesi.id)
      .eq('template_id', template.id)
      .eq('template_versi', versi)
      .limit(1)
      .maybeSingle();
    if (ada) return res.json({ success: true, ...ada, cache: true });

    if (!bolehRender(alamatAsal(req))) {
      return res.status(429).json({ success: false, message: 'Terlalu sering. Coba lagi beberapa menit lagi.' });
    }

    const kunci = `${sesi.id}:${template.id}:${versi}`;
    let janji = sedangDirender.get(kunci);
    if (!janji) {
      janji = (async () => {
        await giliran();
        try { return await renderBaru(sesi, template, versi); } finally { selesaiGiliran(); }
      })();
      sedangDirender.set(kunci, janji);
      janji.finally(() => sedangDirender.delete(kunci)).catch(() => {});
    }
    const baris = await janji;
    return res.json({ success: true, ...baris, cache: false });
  } catch (e) {
    console.error('[Story] render:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal membuat Story.' });
  }
});

// POST /api/story/aksi { id, aksi: 'bagikan'|'simpan' } — hitungan pemakaian.
router.post('/aksi', async (req, res) => {
  const { id, aksi } = req.body || {};
  const kolom = aksi === 'bagikan' ? 'dibagikan' : aksi === 'simpan' ? 'disimpan' : null;
  if (!id || !kolom) return res.status(400).json({ success: false });
  try {
    const { data } = await supabase.from('story_renders').select(`id, ${kolom}`).eq('id', id).maybeSingle();
    if (data) await supabase.from('story_renders').update({ [kolom]: (data[kolom] || 0) + 1 }).eq('id', id);
    return res.json({ success: true });
  } catch {
    return res.json({ success: false });
  }
});

module.exports = router;
