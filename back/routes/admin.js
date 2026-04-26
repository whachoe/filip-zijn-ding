const express = require('express');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();

// All admin routes require admin role
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Update user role
router.put('/users/:id/role', async (req, res) => {
  try {
    const { role } = req.body;

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
    }

    const result = await db.query(
      'UPDATE users SET role = $1 WHERE id = $2 RETURNING id, username, email, role',
      [role, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User role updated', user: result.rows[0] });
  } catch (error) {
    console.error('Update user role error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// Get all question sets
router.get('/questions', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, version, categories, indicators, created_at FROM question_sets ORDER BY version DESC'
    );

    res.json({ questionSets: result.rows });
  } catch (error) {
    console.error('Get question sets error:', error);
    res.status(500).json({ error: 'Failed to get question sets' });
  }
});

// Create new question set
router.post('/questions', async (req, res) => {
  try {
    const { categories, indicators } = req.body;

    if (!Array.isArray(categories) || !Array.isArray(indicators) || categories.length === 0 || categories.length !== indicators.length) {
      return res.status(400).json({ error: 'Categories and indicators must be non-empty arrays of matching length' });
    }

    // Get latest version
    const versionResult = await db.query(
      'SELECT MAX(version) as max_version FROM question_sets'
    );
    const newVersion = (versionResult.rows[0].max_version || 0) + 1;

    // Insert new question set
    const result = await db.query(
      'INSERT INTO question_sets (version, categories, indicators) VALUES ($1, $2, $3) RETURNING *',
      [newVersion, JSON.stringify(categories), JSON.stringify(indicators)]
    );

    res.status(201).json({
      message: 'Question set created',
      questionSet: result.rows[0]
    });
  } catch (error) {
    console.error('Create question set error:', error);
    res.status(500).json({ error: 'Failed to create question set' });
  }
});

// Update question set by creating a new immutable version
router.put('/questions/:id', async (req, res) => {
  try {
    const { categories, indicators } = req.body;

    if (!Array.isArray(categories) || !Array.isArray(indicators) || categories.length === 0 || categories.length !== indicators.length) {
      return res.status(400).json({ error: 'Categories and indicators must be non-empty arrays of matching length' });
    }

    const existing = await db.query(
      'SELECT id FROM question_sets WHERE id = $1',
      [req.params.id]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'Question set not found' });
    }

    const versionResult = await db.query(
      'SELECT MAX(version) as max_version FROM question_sets'
    );
    const newVersion = (versionResult.rows[0].max_version || 0) + 1;

    const result = await db.query(
      'INSERT INTO question_sets (version, categories, indicators) VALUES ($1, $2, $3) RETURNING *',
      [newVersion, JSON.stringify(categories), JSON.stringify(indicators)]
    );

    res.json({
      message: 'New question set version created',
      questionSet: result.rows[0]
    });
  } catch (error) {
    console.error('Update question set error:', error);
    res.status(500).json({ error: 'Failed to update question set' });
  }
});

// Get all assessments (for all users)
router.get('/assessments', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id, a.user_id, u.username, a.question_set_version, a.created_at, a.synced_at 
       FROM assessments a 
       JOIN users u ON a.user_id = u.id 
       ORDER BY a.created_at DESC`
    );

    res.json({ assessments: result.rows });
  } catch (error) {
    console.error('Get all assessments error:', error);
    res.status(500).json({ error: 'Failed to get assessments' });
  }
});

module.exports = router;
