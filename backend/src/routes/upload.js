const express = require('express');
const router = express.Router();
const multer = require('multer');
const { supabase } = require('../middleware/validateDevice');

const upload = multer({ storage: multer.memoryStorage() });

// POST /api/photobooth/upload  (foto individual)
router.post('/', upload.single('photo'), async (req, res) => {
  const { session_uuid } = req.body;
  if (!req.file || !session_uuid) {
    return res.status(400).json({ success: false, message: 'File dan session_uuid wajib ada.' });
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, client_id')
    .eq('transaction_code', session_uuid)
    .single();

  if (!session) return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });

  const fileName = `${session.client_id}/${session.id}/${Date.now()}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from('photos')
    .upload(fileName, req.file.buffer, { contentType: req.file.mimetype || 'image/png', upsert: true });

  if (uploadError) return res.status(500).json({ success: false, message: 'Gagal upload foto.' });

  const { data: { publicUrl } } = supabase.storage.from('photos').getPublicUrl(fileName);

  // Simpan ke tabel photos
  await supabase.from('photos').insert({ session_id: session.id, photo_url: publicUrl });

  return res.status(201).json({ success: true, url: publicUrl });
});

// POST /api/photobooth/upload-final  (hasil akhir gabungan)
router.post('/final', upload.single('photo'), async (req, res) => {
  const { session_uuid } = req.body;
  if (!req.file || !session_uuid) {
    return res.status(400).json({ success: false, message: 'File dan session_uuid wajib ada.' });
  }

  const { data: session } = await supabase
    .from('sessions')
    .select('id, client_id')
    .eq('transaction_code', session_uuid)
    .single();

  if (!session) return res.status(404).json({ success: false, message: 'Session tidak ditemukan.' });

  const fileName = `${session.client_id}/${session.id}/final.png`;

  const { error: uploadError } = await supabase.storage
    .from('results')
    .upload(fileName, req.file.buffer, { contentType: req.file.mimetype || 'image/png', upsert: true });

  if (uploadError) return res.status(500).json({ success: false, message: 'Gagal upload final.' });

  const { data: { publicUrl } } = supabase.storage.from('results').getPublicUrl(fileName);

  // Update result_url di sessions
  await supabase.from('sessions').update({ result_url: publicUrl }).eq('id', session.id);

  return res.status(200).json({ success: true, url: publicUrl });
});

module.exports = router;