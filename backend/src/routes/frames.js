const express = require('express');
const router  = express.Router();
const { supabase } = require('../middleware/validateDevice');
const { resolveSettings } = require('../utils/settings');

// GET /api/frames?hwid=xxx
router.get('/', async (req, res) => {
  const { hwid } = req.query;

  if (!hwid) {
    return res.status(400).json({ success: false, message: 'HWID diperlukan.' });
  }

  try {
    // 1. Cari device berdasarkan HWID
    const { data: device, error: deviceError } = await supabase
      .from('devices')
      .select('id, client_id, is_active, license_end, clients(is_active, session_duration_minutes)')
      .eq('hwid', hwid)
      .single();

    if (deviceError || !device) {
      return res.status(404).json({ success: false, message: 'Perangkat tidak ditemukan.' });
    }

    if (!device.is_active || !device.clients?.is_active) {
      return res.status(403).json({ success: false, message: 'Perangkat atau client tidak aktif.' });
    }

    if (device.license_end && new Date() > new Date(device.license_end)) {
      return res.status(403).json({ success: false, message: 'Lisensi sudah expired.' });
    }

    // 2. Fetch frames milik client ini
    const { data: frames, error: framesError } = await supabase
      .from('frames')
      .select('id, name, image_url, thumbnail_url, photo_count, output_width, output_height, sort_order, photo_slots')
      .eq('client_id', device.client_id)
      .eq('is_active', true)
      .eq('type', 'static')
      .order('sort_order', { ascending: true });

    if (framesError) {
      return res.status(500).json({ success: false, message: 'Gagal mengambil data frame.' });
    }

    // Durasi harus berasal dari sumber yang sama dengan /bootstrap,
    // kalau tidak nilai di Flutter akan tertimpa nilai lama dari tabel clients.
    const settings = await resolveSettings(device.client_id, device.id);

    return res.json({
      success: true,
      client_id: device.client_id,
      frames: frames ?? [],
      session_duration_minutes: settings.session_duration_minutes,
    });

  } catch (e) {
    console.error('Error fetch frames:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});


// ── Upload frame dari dashboard ────────────────────────────────────────────
// Browser tidak boleh memegang kredensial R2, jadi unggahan frame dialihkan
// lewat backend. Dashboard mengirim file asli + thumbnail yang sudah dikompres.
const multer = require('multer');
const { requireAdmin, canAccessClient } = require('../middleware/requireAdmin');
const { putObject, deleteObject } = require('../utils/storage');

const uploadFrame = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

// POST /api/frames/upload   (field: image, thumbnail, client_id, name)
router.post(
  '/upload',
  requireAdmin,
  uploadFrame.fields([{ name: 'image', maxCount: 1 }, { name: 'thumbnail', maxCount: 1 }]),
  async (req, res) => {
    const { client_id, name } = req.body;
    const image = req.files?.image?.[0];
    const thumbnail = req.files?.thumbnail?.[0];

    if (!client_id || !image) {
      return res.status(400).json({ success: false, message: 'client_id dan file image wajib ada.' });
    }
    if (!canAccessClient(req.admin, client_id)) {
      return res.status(403).json({ success: false, message: 'Tidak berhak mengunggah untuk klien ini.' });
    }

    const safeName = String(name || 'frame').replace(/[^\w.-]+/g, '_').slice(0, 60);
    const base = `frames/${client_id}/${Date.now()}_${safeName}`;

    try {
      // Frame bisa diganti/ditimpa, jadi cache-nya pendek (immutable: false).
      const orig = await putObject({
        key: `${base}.webp`, body: image.buffer,
        contentType: image.mimetype || 'image/webp', immutable: false,
      });

      let thumb = null;
      if (thumbnail) {
        thumb = await putObject({
          key: `${base}_thumb.webp`, body: thumbnail.buffer,
          contentType: thumbnail.mimetype || 'image/webp', immutable: false,
        });
      }

      return res.status(201).json({
        success: true,
        image_url: orig.url,
        thumbnail_url: thumb?.url ?? orig.url,
        storage_provider: orig.provider,
        bucket_name: orig.bucket,
        image_object_key: orig.key,
        thumbnail_object_key: thumb?.key ?? null,
      });
    } catch (e) {
      console.error('[Frames] upload gagal:', e.message);
      return res.status(500).json({ success: false, message: 'Gagal mengunggah frame.' });
    }
  }
);

// DELETE /api/frames/object   body: { client_id, object_keys: [...] }
router.delete('/object', requireAdmin, express.json(), async (req, res) => {
  const { client_id, object_keys } = req.body || {};

  if (!client_id || !Array.isArray(object_keys) || object_keys.length === 0) {
    return res.status(400).json({ success: false, message: 'client_id dan object_keys wajib ada.' });
  }
  if (!canAccessClient(req.admin, client_id)) {
    return res.status(403).json({ success: false, message: 'Tidak berhak menghapus milik klien ini.' });
  }
  // Cegah admin menghapus file di luar folder kliennya.
  const prefix = `frames/${client_id}/`;
  if (!object_keys.every((k) => typeof k === 'string' && k.startsWith(prefix))) {
    return res.status(403).json({ success: false, message: 'Object key di luar folder klien.' });
  }

  const failed = [];
  for (const key of object_keys) {
    try { await deleteObject(key); } catch (e) { failed.push(key); }
  }

  return res.json({ success: failed.length === 0, deleted: object_keys.length - failed.length, failed });
});

module.exports = router;
