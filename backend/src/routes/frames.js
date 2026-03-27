const express = require('express');
const router  = express.Router();
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

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

    return res.json({
      success: true,
      client_id: device.client_id,
      frames: frames ?? [],
      session_duration_minutes: device.clients?.session_duration_minutes ?? 30,
    });

  } catch (e) {
    console.error('Error fetch frames:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
