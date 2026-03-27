const express = require('express');
const router = express.Router();
const { supabase, validateDevice } = require('../middleware/validateDevice');

// GET /api/photobooth/photos/recent?hwid=XXXXX&limit=10
router.get('/recent', async (req, res) => {
  const { hwid, limit = 10 } = req.query;

  if (!hwid) {
    return res.status(400).json({ success: false, message: 'hwid wajib diisi.' });
  }

  try {
    // 1. Cari device berdasarkan HWID
    const { data: device, error: deviceErr } = await supabase
      .from('devices')
      .select('id, client_id')
      .eq('hwid', hwid)
      .eq('is_active', true)
      .single();

    if (deviceErr || !device) {
      return res.status(404).json({
        success: false,
        message: 'Device tidak ditemukan.',
        data: [],
      });
    }

    // 2. Ambil foto terakhir dari sessions milik device ini
    const { data: sessions, error: sessErr } = await supabase
      .from('sessions')
      .select('id, transaction_code')
      .eq('device_id', device.id)
      .eq('client_id', device.client_id)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (sessErr || !sessions || sessions.length === 0) {
      return res.json({
        success: true,
        data: [],
      });
    }

    const sessionIds = sessions.map(s => s.id);

    // 3. Ambil foto dari sessions tersebut
    const { data: photos, error: photoErr } = await supabase
      .from('photos')
      .select('id, photo_url, session_id, created_at')
      .in('session_id', sessionIds)
      .order('created_at', { ascending: false })
      .limit(parseInt(limit));

    if (photoErr) {
      console.error('Fetch photos error:', photoErr);
      return res.status(500).json({ success: false, message: 'Gagal mengambil foto.' });
    }

    // 4. Map session transaction_code ke photos
    const sessionMap = {};
    sessions.forEach(s => { sessionMap[s.id] = s.transaction_code; });

    const result = (photos || []).map(p => ({
      id: p.id,
      url: p.photo_url,
      photo_url: p.photo_url,
      transaction_code: sessionMap[p.session_id] || '',
      session_code: sessionMap[p.session_id] || '',
      created_at: p.created_at,
    }));

    return res.json({
      success: true,
      data: result,
    });

  } catch (e) {
    console.error('Recent photos error:', e);
    return res.status(500).json({ success: false, message: 'Server error.' });
  }
});

module.exports = router;