const express = require('express');

function testModeRouter(enabled) {
  const router = express.Router();
  router.get('/', (req, res) => {
    res.set('Cache-Control', 'no-store');
    if (!enabled) return res.status(404).json({ error: 'Test mode is disabled' });
    res.json({ enabled: true });
  });
  return router;
}

module.exports = testModeRouter;
