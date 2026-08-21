const { supabase } = require('./validateDevice');

/**
 * Verifikasi pemanggil adalah admin dashboard yang sah.
 * Dashboard (Next.js) mengirim access token Supabase miliknya di header Authorization.
 */
const requireAdmin = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;

  if (!token) {
    return res.status(401).json({ success: false, message: 'Token tidak ada.' });
  }

  const { data: userData, error: authError } = await supabase.auth.getUser(token);
  if (authError || !userData?.user) {
    return res.status(401).json({ success: false, message: 'Sesi tidak valid.' });
  }

  const { data: admin } = await supabase
    .from('admin_users')
    .select('id, role, client_id, is_active')
    .eq('id', userData.user.id)
    .maybeSingle();

  if (!admin || !admin.is_active) {
    return res.status(403).json({ success: false, message: 'Akun bukan admin aktif.' });
  }

  req.admin = admin;
  next();
};

/** super_admin boleh lintas klien; admin biasa hanya kliennya sendiri. */
function canAccessClient(admin, clientId) {
  if (admin.role === 'super_admin') return true;
  return Boolean(clientId) && admin.client_id === clientId;
}

module.exports = { requireAdmin, canAccessClient };
