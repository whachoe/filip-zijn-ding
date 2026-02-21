const express = require('express');
const db = require('../config/db');

const router = express.Router();

// Get latest question set
router.get('/latest', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, version, categories, indicators, created_at FROM question_sets ORDER BY version DESC LIMIT 1'
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No question sets found' });
    }

    res.json({ questionSet: result.rows[0] });
  } catch (error) {
    console.error('Get latest questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

// Get specific version
router.get('/:version', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, version, categories, indicators, created_at FROM question_sets WHERE version = $1',
      [parseInt(req.params.version)]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Question set version not found' });
    }

    res.json({ questionSet: result.rows[0] });
  } catch (error) {
    console.error('Get questions error:', error);
    res.status(500).json({ error: 'Failed to get questions' });
  }
});

module.exports = router;
