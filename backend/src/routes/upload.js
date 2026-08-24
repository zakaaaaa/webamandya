const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../middleware/validateDevice');
const { putObject } = require('../utils/storage');

const uploadImage = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 }, // 25 MB
});
const uploadVideo = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 * 1024 }, // 200 MB
});

async function findSession(session_uuid) {
  const { data } = await supabase
    .from('sessions')
    .select('id, client_id')
    .eq('transaction_code', session_uuid)
    .maybeSingle();
  return data;
}

// POST /api/photobooth/upload  (foto individual)
router.post('/', uploadImage.single('photo'), async (req, res) => {
  const { session_uuid, photo_order } = req.body;
  if (!req.file || !session_uuid) {
    return res.status(400).json({ success: false, message: 'File dan session_uuid wajib ada.' });
  }

  const session = await findSession(session_uuid);
  if (!session) return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });

  const order = parseInt(photo_order, 10);
  const hasOrder = Number.isInteger(order) && order > 0;
  // Prefix "photos/" dipertahankan agar sejalan dengan file hasil migrasi dari Supabase.
  const key = `photos/${session.client_id}/${session.id}/${hasOrder ? `photo-${order}` : Date.now()}.jpg`;

  let stored;
  try {
    stored = await putObject({ key, body: req.file.buffer, contentType: req.file.mimetype || 'image/jpeg' });
  } catch (e) {
    console.error('[Upload] photo -> R2 gagal:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal upload foto.' });
  }

  // Mesin photobooth mengulang unggahan yang gagal lewat antrean lokal, dan
  // sebuah percobaan bisa saja sebenarnya sudah sampai di sini sebelum
  // jawabannya hilang di jalan. Kunci objek R2-nya deterministik (tertimpa,
  // aman), tapi baris database-nya tidak — tanpa ini foto yang sama bisa
  // muncul dua kali di galeri dan halaman unduh.
  if (hasOrder) {
    await supabase
      .from('photos')
      .delete()
      .eq('session_id', session.id)
      .eq('photo_order', order);
  }

  await supabase.from('photos').insert({
    session_id: session.id,
    photo_url: stored.url,
    photo_order: hasOrder ? order : null,
    storage_provider: stored.provider,
    bucket_name: stored.bucket,
    object_key: stored.key,
  });

  return res.status(201).json({ success: true, url: stored.url });
});

// POST /api/photobooth/upload/final  (hasil akhir gabungan)
router.post('/final', uploadImage.single('photo'), async (req, res) => {
  const { session_uuid } = req.body;
  if (!req.file || !session_uuid) {
    return res.status(400).json({ success: false, message: 'File dan session_uuid wajib ada.' });
  }

  const session = await findSession(session_uuid);
  if (!session) return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });

  const key = `results/${session.client_id}/${session.id}/final.png`;

  let stored;
  try {
    stored = await putObject({ key, body: req.file.buffer, contentType: req.file.mimetype || 'image/png' });
  } catch (e) {
    console.error('[Upload] final -> R2 gagal:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal upload final.' });
  }

  await supabase.from('sessions').update({
    result_url: stored.url,
    result_storage_provider: stored.provider,
    result_bucket_name: stored.bucket,
    result_object_key: stored.key,
  }).eq('id', session.id);

  return res.status(200).json({ success: true, url: stored.url });
});

// POST /api/photobooth/upload/video  (rekaman video hasil sesi)
router.post('/video', uploadVideo.single('video'), async (req, res) => {
  const { session_uuid } = req.body;
  if (!req.file || !session_uuid) {
    return res.status(400).json({ success: false, message: 'File dan session_uuid wajib ada.' });
  }

  const session = await findSession(session_uuid);
  if (!session) return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });

  const key = `results/${session.client_id}/${session.id}/video.mp4`;

  let stored;
  try {
    stored = await putObject({ key, body: req.file.buffer, contentType: req.file.mimetype || 'video/mp4' });
  } catch (e) {
    console.error('[Upload] video -> R2 gagal:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal upload video.' });
  }

  await supabase.from('sessions').update({
    video_url: stored.url,
    video_object_key: stored.key,
    video_status: 'ready',
  }).eq('id', session.id);

  return res.status(201).json({ success: true, url: stored.url });
});

// POST /api/photobooth/upload/gif  (GIF animasi hasil sesi)
router.post('/gif', uploadImage.single('gif'), async (req, res) => {
  const { session_uuid } = req.body;
  if (!req.file || !session_uuid) {
    return res.status(400).json({ success: false, message: 'File dan session_uuid wajib ada.' });
  }

  const session = await findSession(session_uuid);
  if (!session) return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });

  const key = `results/${session.client_id}/${session.id}/animation.gif`;

  let stored;
  try {
    stored = await putObject({ key, body: req.file.buffer, contentType: req.file.mimetype || 'image/gif' });
  } catch (e) {
    console.error('[Upload] gif -> R2 gagal:', e.message);
    return res.status(500).json({ success: false, message: 'Gagal upload GIF.' });
  }

  await supabase.from('sessions').update({
    gif_url: stored.url,
    gif_object_key: stored.key,
    gif_status: 'ready',
  }).eq('id', session.id);

  return res.status(201).json({ success: true, url: stored.url });
});

module.exports = router;
