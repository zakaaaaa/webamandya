const express = require('express');
const router  = express.Router();

// GET /download/:uuid — redirect ke Next.js customer page
router.get('/:uuid', (req, res) => {
  const { uuid } = req.params;
  const frontendUrl = process.env.FRONTEND_URL || 'https://www.pabrikenangan.my.id';
  res.redirect(302, `${frontendUrl}/download/${uuid}`);
});

module.exports = router;
