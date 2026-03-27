const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');

// POST /api/photobooth/license/check
router.post('/check', async (req, res) => {
  const { hwid } = req.body;

  if (!hwid) {
    return res.status(400).json({ success: false, message: 'HWID wajib diisi.' });
  }

  // ─── BARU: Catat HWID yang belum terdaftar ke tabel unregistered_devices ───
  // Ini berjalan di background, tidak memblokir response
  supabase
    .from('unregistered_devices')
    .upsert(
      { hwid, last_seen_at: new Date().toISOString() },
      { onConflict: 'hwid' }
    )
    .then(() => {}) // fire & forget
    .catch(() => {});
  // ─────────────────────────────────────────────────────────────────────────────

  const { data: device, error } = await supabase
    .from('devices')
    .select(`
      id, hwid, device_name, is_active, license_start, license_end, client_id,
      clients ( id, name, is_active )
    `)
    .eq('hwid', hwid)
    .single();

  if (error || !device) {
    return res.status(403).json({ success: false, message: 'Perangkat tidak terdaftar. Hubungi administrator.' });
  }
  if (!device.is_active) {
    return res.status(403).json({ success: false, message: 'Lisensi perangkat ini telah dinonaktifkan.' });
  }
  if (!device.clients?.is_active) {
    return res.status(403).json({ success: false, message: 'Akun bisnis tidak aktif. Hubungi administrator.' });
  }
  if (device.license_end && new Date() > new Date(device.license_end)) {
    return res.status(403).json({
      success: false,
      message: `Lisensi expired sejak ${new Date(device.license_end).toLocaleDateString('id-ID')}.`
    });
  }

  return res.status(200).json({
    success: true,
    message: 'Lisensi aktif',
    data: {
      device_id:   device.id,
      device_name: device.device_name ?? 'Photobooth Unit',
      client_id:   device.client_id,
      client_name: device.clients?.name,
      license_end: device.license_end ?? null,
    }
  });
});

module.exports = router;