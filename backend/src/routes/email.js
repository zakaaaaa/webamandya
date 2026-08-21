const express = require('express');
const router = express.Router();
const { supabase, validateDevice } = require('../middleware/validateDevice');
const { resolveSettings } = require('../utils/settings');

const SMTP_HOST = process.env.SMTP_HOST;
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '587', 10);
const SMTP_USER = process.env.SMTP_USER;
const SMTP_PASS = process.env.SMTP_PASS;
const SMTP_FROM = process.env.SMTP_FROM || SMTP_USER;

const smtpConfigured = Boolean(SMTP_HOST && SMTP_USER && SMTP_PASS);

let transporter = null;
function getTransporter() {
  if (!smtpConfigured) return null;
  if (!transporter) {
    const nodemailer = require('nodemailer');
    transporter = nodemailer.createTransport({
      host: SMTP_HOST,
      port: SMTP_PORT,
      secure: SMTP_PORT === 465,
      auth: { user: SMTP_USER, pass: SMTP_PASS },
    });
  }
  return transporter;
}

function renderTemplate(text, vars) {
  return String(text ?? '').replace(/\{\{(\w+)\}\}/g, (_, key) => vars[key] ?? '');
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/photobooth/email/send-result
router.post('/send-result', validateDevice, async (req, res) => {
  const { recipient_email, result_url } = req.body;
  const { id: device_id, client_id } = req.device;

  if (!recipient_email || !EMAIL_RE.test(recipient_email)) {
    return res.status(400).json({ success: false, message: 'Alamat email tidak valid.' });
  }
  if (!result_url) {
    return res.status(400).json({ success: false, message: 'result_url wajib diisi.' });
  }

  const settings = await resolveSettings(client_id, device_id);
  if (!settings.email_delivery_enabled) {
    return res.status(400).json({ success: false, message: 'Pengiriman email tidak diaktifkan untuk unit ini.' });
  }

  const logDelivery = (status) =>
    supabase.from('email_deliveries').insert({
      client_id,
      device_id,
      recipient_email,
      result_url,
      status,
    });

  if (!smtpConfigured) {
    await logDelivery('failed');
    console.error('[Email] SMTP belum dikonfigurasi (SMTP_HOST/SMTP_USER/SMTP_PASS kosong).');
    return res.status(503).json({ success: false, message: 'Layanan email belum dikonfigurasi di server.' });
  }

  const vars = { url: result_url, link: result_url, email: recipient_email };
  const subject = renderTemplate(settings.email_subject_template, vars) || 'Hasil photobooth Anda';
  const bodyText = renderTemplate(settings.email_body_template, vars) || 'Berikut hasil photobooth Anda.';

  try {
    await getTransporter().sendMail({
      from: `"${settings.email_sender_name || 'Pabrik Kenangan'}" <${SMTP_FROM}>`,
      to: recipient_email,
      subject,
      text: `${bodyText}\n\n${result_url}`,
      html: `<p>${bodyText}</p><p><a href="${result_url}">Unduh hasil foto Anda</a></p>`,
    });

    await logDelivery('sent');
    return res.json({ success: true, message: 'Email terkirim.' });
  } catch (e) {
    console.error('[Email] Gagal kirim:', e.message);
    await logDelivery('failed');
    return res.status(500).json({ success: false, message: 'Gagal mengirim email.' });
  }
});

module.exports = router;
