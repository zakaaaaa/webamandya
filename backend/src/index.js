const express = require('express');
const cors = require('cors');
const multer = require('multer');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json({ limit: '2mb' }));

// Routes
app.use('/api/photobooth/bootstrap', require('./routes/bootstrap'));
app.use('/api/photobooth/license', require('./routes/license'));
app.use('/api/photobooth/session', require('./routes/session'));
app.use('/api/photobooth/upload',  require('./routes/upload'));
app.use('/api/photobooth/photos',  require('./routes/photos'));
app.use('/api/photobooth/consumables', require('./routes/consumables'));
app.use('/api/photobooth/email',   require('./routes/email'));
app.use('/api/complaints',         require('./routes/complaints'));

// Pekerja latar: mengantar hasil ke pelanggan yang sudah melapor, dan
// mencoba lagi berkala selama berkasnya belum sampai server.
require('./workers/pengirim').mulai();
app.use('/api/payment',            require('./routes/payment'));
app.use('/api/frames',             require('./routes/frames'));
app.use('/download', require('./routes/download'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 404 JSON (bukan HTML) supaya klien Flutter selalu dapat bentuk respons yang sama
app.use((req, res) => {
  res.status(404).json({ success: false, message: `Endpoint tidak ditemukan: ${req.method} ${req.originalUrl}` });
});

// Error handler — terutama untuk limit ukuran file dari multer
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'Ukuran file melebihi batas.' : `Upload gagal: ${err.code}`;
    return res.status(413).json({ success: false, message });
  }
  console.error('[Unhandled]', err);
  return res.status(500).json({ success: false, message: 'Server error.' });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Photobooth Backend running on port ${PORT}`);
});
