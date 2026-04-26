const path = require('path');
const express = require('express');

function createPagesRouter(publicDir) {
  const router = express.Router();

  router.get('/', (req, res) => {
    res.redirect('/admin');
  });

  router.get('/admin', (req, res) => {
    res.sendFile(path.join(publicDir, 'admin/index.html'));
  });

  router.get('/overlay', (req, res) => {
    res.sendFile(path.join(publicDir, 'overlay/index.html'));
  });

  router.get('/health', (req, res) => {
    res.json({
      ok: true,
      service: 'wc3-map-ban',
      uptime: process.uptime(),
    });
  });

  return router;
}

module.exports = { createPagesRouter };
