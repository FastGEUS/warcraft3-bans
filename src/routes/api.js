const express = require('express');

function createApiRouter({ stateService, mediaQueue }) {
  const router = express.Router();

  router.get('/state', (req, res) => {
    res.json(stateService.getState());
  });

  router.get('/maps', (req, res) => {
    res.json(Object.values(stateService.getState().maps).sort((a, b) => a.order - b.order));
  });

  router.post('/ban/:id', (req, res) => {
    try {
      res.json({ map: stateService.banMap(req.params.id) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/unban/:id', (req, res) => {
    try {
      res.json({ map: stateService.unbanMap(req.params.id) });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/start-reveal', (req, res) => {
    try {
      const state = stateService.startReveal();
      mediaQueue.start(state.revealQueue);
      res.json(stateService.getState());
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  router.post('/reset', (req, res) => {
    mediaQueue.stop();
    res.json(stateService.resetAll());
  });

  return router;
}

module.exports = { createApiRouter };
