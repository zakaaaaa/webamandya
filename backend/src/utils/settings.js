const { supabase } = require('../middleware/validateDevice');

// Default harus mengikuti AppConfigProvider di Flutter (lib/providers/app_config_provider.dart)
const DEFAULT_SETTINGS = {
  session_price: 30000,
  extra_print_enabled: true,
  extra_print_price: 10000,
  session_duration_minutes: 5,
  payment_methods_enabled: ['qris', 'voucher'],
  voucher_enabled: true,
  download_qr_enabled: true,
  email_delivery_enabled: false,
  email_sender_name: 'Pabrik Kenangan',
  email_subject_template: 'Terima kasih sudah berfoto bersama kami',
  email_body_template: 'Berikut hasil photobooth Anda.',
  preferred_printer_keyword: 'epson',
  paper_size: '4R',
  auto_print_copies: 1,
  camera_mode: 'webcam',
};

const SETTING_KEYS = Object.keys(DEFAULT_SETTINGS);

// Ambil hanya kolom setting yang bernilai (bukan null/undefined) supaya
// layer di bawahnya tidak tertimpa null dari database.
function pickDefined(row) {
  const out = {};
  if (!row) return out;
  for (const key of SETTING_KEYS) {
    if (row[key] !== null && row[key] !== undefined) out[key] = row[key];
  }
  return out;
}

/**
 * Setting efektif untuk sebuah device:
 *   DEFAULT  <-  client_settings  <-  device_settings (override per unit)
 */
async function resolveSettings(clientId, deviceId) {
  const [clientRes, deviceRes] = await Promise.all([
    supabase.from('client_settings').select('*').eq('client_id', clientId).maybeSingle(),
    supabase.from('device_settings').select('*').eq('device_id', deviceId).maybeSingle(),
  ]);

  return {
    ...DEFAULT_SETTINGS,
    ...pickDefined(clientRes.data),
    ...pickDefined(deviceRes.data),
  };
}

module.exports = { DEFAULT_SETTINGS, SETTING_KEYS, resolveSettings };
