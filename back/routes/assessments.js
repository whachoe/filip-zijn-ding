const express = require('express');
const db = require('../config/db');

const router = express.Router();

function normalizeAssessmentPayload(assessment) {
  const normalized = { ...assessment };
  const contactInfo = (normalized.contactInfo && typeof normalized.contactInfo === 'object')
    ? { ...normalized.contactInfo }
    : {};

  contactInfo.fullName = String(contactInfo.fullName || contactInfo.fullname || '').trim();
  delete contactInfo.fullname;

  normalized.contactInfo = contactInfo;
  return normalized;
}

// Get all assessments for current user
router.get('/', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, data, question_set_version, created_at, synced_at FROM assessments WHERE user_id = $1 ORDER BY created_at DESC',
      [req.user.id]
    );

    res.json({ assessments: result.rows });
  } catch (error) {
    console.error('Get assessments error:', error);
    res.status(500).json({ error: 'Failed to get assessments' });
  }
});

// Get specific assessment
router.get('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'SELECT id, data, question_set_version, created_at, synced_at FROM assessments WHERE id = $1 AND user_id = $2',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({ assessment: result.rows[0] });
  } catch (error) {
    console.error('Get assessment error:', error);
    res.status(500).json({ error: 'Failed to get assessment' });
  }
});

// Upload/sync assessment(s)
router.post('/', async (req, res) => {
  try {
    const assessments = Array.isArray(req.body) ? req.body : [req.body];
    const uploaded = [];
    const errors = [];

    for (const assessment of assessments) {
      try {
        const normalizedAssessment = normalizeAssessmentPayload(assessment);
        const { id, contactInfo, scores, progress, mediaAttachments, notes, created, version } = normalizedAssessment;

        if (!id || !contactInfo || !scores) {
          errors.push({ id, error: 'Missing required fields' });
          continue;
        }

        // Check if assessment already exists
        const existing = await db.query('SELECT id FROM assessments WHERE id = $1', [id]);

        if (existing.rows.length > 0) {
          // Update existing assessment
          await db.query(
            'UPDATE assessments SET data = $1, question_set_version = $2, synced_at = NOW() WHERE id = $3',
            [JSON.stringify(normalizedAssessment), version || 1, id]
          );
        } else {
          // Insert new assessment
          await db.query(
            'INSERT INTO assessments (id, user_id, data, question_set_version, created_at, synced_at) VALUES ($1, $2, $3, $4, $5, NOW())',
            [id, req.user.id, JSON.stringify(normalizedAssessment), version || 1, created || new Date().toISOString()]
          );
        }

        uploaded.push(id);
      } catch (err) {
        console.error('Error syncing assessment:', err);
        errors.push({ id: assessment.id, error: err.message });
      }
    }

    res.json({
      message: `Synced ${uploaded.length} assessment(s)`,
      uploaded,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Sync assessments error:', error);
    res.status(500).json({ error: 'Failed to sync assessments' });
  }
});

// Delete assessment
router.delete('/:id', async (req, res) => {
  try {
    const result = await db.query(
      'DELETE FROM assessments WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assessment not found' });
    }

    res.json({ message: 'Assessment deleted', id: req.params.id });
  } catch (error) {
    console.error('Delete assessment error:', error);
    res.status(500).json({ error: 'Failed to delete assessment' });
  }
});

module.exports = router;
