const express = require('express');
const bcrypt = require('bcrypt');
const db = require('../config/db');
const { requireAdmin } = require('../middleware/auth');

const router = express.Router();
const SALT_ROUNDS = 10;

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function generateInternalUsername() {
  return `user_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
}

function normalizeText(value) {
  const text = String(value || '').trim();
  return text === '' ? null : text;
}

// All admin routes require admin role
router.use(requireAdmin);

// Get all users
router.get('/users', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, first_name, last_name, location, role, created_at FROM users ORDER BY created_at DESC'
    );

    res.json({ users: result.rows });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ error: 'Failed to get users' });
  }
});

// Get user by id
router.get('/users/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, username, email, first_name, last_name, location, role, created_at FROM users WHERE id = $1',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Get user by id error:', error);
    res.status(500).json({ error: 'Failed to get user' });
  }
});

// Create user
router.post('/users', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password, role } = req.body;
    const firstName = normalizeText(req.body.firstName);
    const lastName = normalizeText(req.body.lastName);
    const location = normalizeText(req.body.location);

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
    }

    const existing = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1)',
      [email]
    );

    if (existing.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const internalUsername = generateInternalUsername();

    const result = await db.query(
      'INSERT INTO users (username, password_hash, email, first_name, last_name, location, role) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id, username, email, first_name, last_name, location, role, created_at',
      [internalUsername, passwordHash, email, firstName, lastName, location, role || 'user']
    );

    res.status(201).json({ message: 'User created', user: result.rows[0] });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

// Update user
router.put('/users/:id', async (req, res) => {
  try {
    const userId = req.params.id;
    const email = normalizeEmail(req.body.email);
    const password = req.body.password ? String(req.body.password) : '';
    const role = req.body.role;
    const firstName = normalizeText(req.body.firstName);
    const lastName = normalizeText(req.body.lastName);
    const location = normalizeText(req.body.location);

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: 'Valid email required' });
    }

    if (role && !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be user or admin' });
    }

    if (password && password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existing = await db.query(
      'SELECT id, role FROM users WHERE id = $1',
      [userId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const emailConflict = await db.query(
      'SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND id <> $2',
      [email, userId]
    );

    if (emailConflict.rows.length > 0) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    if (req.user.id === Number(userId) && role && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin role' });
    }

    let result;
    if (password) {
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
      result = await db.query(
        'UPDATE users SET email = $1, first_name = $2, last_name = $3, location = $4, role = $5, password_hash = $6 WHERE id = $7 RETURNING id, username, email, first_name, last_name, location, role, created_at',
        [email, firstName, lastName, location, role || existing.rows[0].role, passwordHash, userId]
      );
    } else {
      result = await db.query(
        'UPDATE users SET email = $1, first_name = $2, last_name = $3, location = $4, role = $5 WHERE id = $6 RETURNING id, username, email, first_name, last_name, location, role, created_at',
        [email, firstName, lastName, location, role || existing.rows[0].role, userId]
      );
    }

    res.json({ message: 'User updated', user: result.rows[0] });
  } catch (error) {
    console.error('Update user error:', error);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

// Delete user
router.delete('/users/:id', async (req, res) => {
  try {
    const userId = Number(req.params.id);

    if (req.user.id === userId) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }

    const result = await db.query(
      'DELETE FROM users WHERE id = $1 RETURNING id, email',
      [userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted', user: result.rows[0] });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ error: 'Failed to delete user' });
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
// Add ?full=true to include data JSONB and joined question-set categories/indicators
router.get('/assessments', async (req, res) => {
  try {
    const full = req.query.full === 'true';
    const query = full
      ? `SELECT a.id, a.user_id, u.username, u.email, a.data, a.question_set_version,
                a.created_at, a.synced_at, q.categories, q.indicators
         FROM assessments a
         JOIN users u ON a.user_id = u.id
         LEFT JOIN question_sets q ON q.version = a.question_set_version
         ORDER BY a.created_at DESC`
      : `SELECT a.id, a.user_id, u.username, u.email, a.question_set_version, a.created_at, a.synced_at
         FROM assessments a
         JOIN users u ON a.user_id = u.id
         ORDER BY a.created_at DESC`;

    const result = await db.query(query);
    res.json({ assessments: result.rows });
  } catch (error) {
    console.error('Get all assessments error:', error);
    res.status(500).json({ error: 'Failed to get assessments' });
  }
});

// Get specific assessment with question-set details
router.get('/assessments/:id', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT a.id,
              a.user_id,
              u.username,
              u.email,
              a.data,
              a.question_set_version,
              a.created_at,
              a.synced_at,
              q.categories,
              q.indicators,
              (
                SELECT COALESCE(
                  json_agg(
                    json_build_object(
                      'id', m.id,
                      'filename', m.filename,
                      'fileType', m.file_type,
                      'fileSize', m.file_size,
                      'uploadedAt', m.uploaded_at,
                      'url', '/api/media/' || m.id
                    )
                    ORDER BY m.uploaded_at DESC
                  ),
                  '[]'::json
                )
                FROM media m
                WHERE m.assessment_id = a.id
              ) AS media
       FROM assessments a
       JOIN users u ON a.user_id = u.id
       LEFT JOIN question_sets q ON q.version = a.question_set_version
       WHERE a.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({ assessment: result.rows[0] });
  } catch (error) {
    console.error('Get admin assessment error:', error);
    res.status(500).json({ error: 'Failed to get assessment' });
  }
});

// Delete any assessment (admin)
router.delete('/assessments/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM assessments WHERE id = $1 RETURNING id',
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({ message: 'Assessment deleted', id: req.params.id });
  } catch (error) {
    console.error('Delete admin assessment error:', error);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

module.exports = router;
