const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/photobooth/license', require('./routes/license'));
app.use('/api/photobooth/session', require('./routes/session'));
app.use('/api/photobooth/upload',  require('./routes/upload'));
app.use('/api/photobooth/photos',  require('./routes/photos'));
app.use('/api/payment',            require('./routes/payment'));
app.use('/api/frames',             require('./routes/frames'));
app.use('/download', require('./routes/download'));

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`✅ Photobooth Backend running on port ${PORT}`);
});