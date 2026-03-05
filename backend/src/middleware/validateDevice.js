const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Middleware: cek HWID valid sebelum proses request apapun
const validateDevice = async (req, res, next) => {
  const hwid = req.body.hwid || req.body.device_id;

  if (!hwid) {
    return res.status(400).json({ success: false, message: 'HWID tidak ditemukan di request.' });
  }

  const { data: device, error } = await supabase
    .from('devices')
    .select('id, client_id, is_active, license_end, clients(is_active)')
    .eq('hwid', hwid)
    .single();

  if (error || !device) {
    return res.status(403).json({ success: false, message: 'Perangkat tidak terdaftar.' });
  }
  if (!device.is_active) {
    return res.status(403).json({ success: false, message: 'Lisensi perangkat dinonaktifkan.' });
  }
  if (!device.clients?.is_active) {
    return res.status(403).json({ success: false, message: 'Akun bisnis tidak aktif.' });
  }
  if (device.license_end && new Date() > new Date(device.license_end)) {
    return res.status(403).json({ success: false, message: `Lisensi expired sejak ${new Date(device.license_end).toLocaleDateString('id-ID')}.` });
  }

  // Simpan data device ke req agar bisa dipakai di route
  req.device = device;
  next();
};

module.exports = { supabase, validateDevice };