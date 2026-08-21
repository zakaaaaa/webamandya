const express = require('express');
const router = express.Router();
const { supabase } = require('../middleware/validateDevice');
const { resolveSettings } = require('../utils/settings');

// GET /api/photobooth/bootstrap?hwid=xxx
// Dipanggil sekali saat splash screen Flutter, mengirim seluruh runtime config
// (harga, durasi, metode bayar, printer, kamera) agar app tidak hardcode apa pun.
router.get('/', async (req, res) => {
  const { hwid } = req.query;

  if (!hwid) {
    return res.status(400).json({ success: false, message: 'hwid wajib diisi.' });
  }

  try {
    const { data: device, error } = await supabase
      .from('devices')
      .select('id, client_id, device_name, is_active, license_start, license_end, billing_plan, token_available, clients(id, name, is_active)')
      .eq('hwid', hwid)
      .single();

    if (error || !device) {
      return res.status(404).json({ success: false, message: 'Perangkat tidak terdaftar.' });
    }
    if (!device.is_active || !device.clients?.is_active) {
      return res.status(403).json({ success: false, message: 'Perangkat atau akun bisnis tidak aktif.' });
    }
    if (device.license_end && new Date() > new Date(device.license_end)) {
      return res.status(403).json({ success: false, message: 'Lisensi sudah expired.' });
    }

    const settings = await resolveSettings(device.client_id, device.id);

    return res.json({
      success: true,
      settings,
      device: {
        id: device.id,
        name: device.device_name ?? 'Photobooth Unit',
        license_end: device.license_end ?? null,
        billing_plan: device.billing_plan ?? 'subscription',
        token_available: device.token_available ?? 0,
      },
      client: {
        id: device.client_id,
        name: device.clients?.name ?? null,
      },
    });
  } catch (e) {
    console.error('[Bootstrap] Error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;
