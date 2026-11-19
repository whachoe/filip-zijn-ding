const express = require('express');
const db = require('../config/db');
const { normalizeMarketInfo, buildMarketIdentityKey } = require('../market-utils');

const router = express.Router();

function normalizeAssessmentPayload(assessment) {
  const normalized = { ...assessment };
  if (normalized.contactInfo && typeof normalized.contactInfo === 'object') {
    normalized.contactInfo = { ...normalized.contactInfo };
    normalized.contactInfo.fullName = String(normalized.contactInfo.fullName || normalized.contactInfo.fullname || '').trim();
    delete normalized.contactInfo.fullname;
  }
  return normalized;
}

// List markets created by the current user.
router.get('/markets', async (req, res) => {
  try {
    const result = await db.query(
      `SELECT m.id, m.name AS "marketName", m.local_name AS "localName",
              m.country, m.province_state AS "provinceState", m.district,
              m.city_town_village AS "cityTownVillage",
              history."assessmentCount",
              latest.data->'marketInfo'->>'setting' AS setting,
              latest.data->'marketInfo'->>'settingOther' AS "settingOther",
              latest.data->'marketInfo'->>'latitude' AS latitude,
              latest.data->'marketInfo'->>'longitude' AS longitude,
              latest.data->'marketInfo'->'otherAssessors' AS "otherAssessors",
              latest.data->'marketInfo'->>'generalNotes' AS "generalNotes"
       FROM markets m
       CROSS JOIN LATERAL (
         SELECT COUNT(*)::int AS "assessmentCount"
         FROM assessments a WHERE a.market_id = m.id AND a.user_id = $1
       ) history
       LEFT JOIN LATERAL (
         SELECT a.data FROM assessments a
         WHERE a.market_id = m.id AND a.user_id = $1
           AND jsonb_typeof(a.data->'marketInfo') = 'object'
         ORDER BY a.market_sequence DESC NULLS LAST, a.created_at DESC, a.id DESC
         LIMIT 1
       ) latest ON true
       WHERE m.created_by = $1
       ORDER BY m.name, m.country, m.province_state, m.district, m.city_town_village`,
      [req.user.id]
    );

    res.json({ markets: result.rows });
  } catch (error) {
    console.error('Get markets error:', error);
    const migrationMissing = error.code === '42P01' && /markets/i.test(error.message || '');
    res.status(500).json({
      error: migrationMissing
        ? 'Market database migration is missing. Run `npm run migrate` from the back directory.'
        : 'Failed to get markets'
    });
  }
});

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
    const marketAssignments = [];
    const errors = [];
    const userResult = await db.query(
      'SELECT id, email, first_name, last_name FROM users WHERE id = $1',
      [req.user.id]
    );
    if (!userResult.rows.length) {
      return res.status(401).json({ error: 'Authenticated user no longer exists' });
    }

    const user = userResult.rows[0];
    const leadAssessor = {
      userId: user.id,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email || '',
      email: user.email || ''
    };

    for (const assessment of assessments) {
      let client;
      try {
        const normalizedAssessment = normalizeAssessmentPayload(assessment);
        const { id, scores, created, version } = normalizedAssessment;

        if (!id || !scores || typeof scores !== 'object') {
          errors.push({ id, error: 'Missing required fields' });
          continue;
        }

        client = await db.pool.connect();
        await client.query('BEGIN');
        const existingResult = await client.query(
          'SELECT id, user_id, market_id, market_sequence, data FROM assessments WHERE id = $1 FOR UPDATE',
          [id]
        );
        const existing = existingResult.rows[0] || null;

        if (existing && existing.user_id !== req.user.id) {
          throw new Error('Assessment belongs to another user');
        }

        let marketId = existing && existing.market_id;
        let marketSequence = existing && existing.market_sequence;
        let resolvedMarket = null;
        if (normalizedAssessment.marketInfo) {
          const marketInfo = normalizeMarketInfo(normalizedAssessment.marketInfo);
          let marketResult;

          if (marketInfo.marketId) {
            marketResult = await client.query(
              `SELECT id, name, local_name, country, province_state, district, city_town_village
               FROM markets WHERE id = $1 AND created_by = $2 FOR UPDATE`,
              [marketInfo.marketId, req.user.id]
            );
            if (!marketResult.rows.length) {
              if (!existing || String(existing.market_id) !== String(marketInfo.marketId)
                  || !existing.data || !existing.data.marketInfo) {
                throw new Error('Selected market was not found or does not belong to you.');
              }
              const previous = existing.data.marketInfo;
              normalizedAssessment.marketInfo = {
                ...marketInfo,
                marketId: existing.market_id,
                marketName: previous.marketName,
                localName: previous.localName || '',
                country: previous.country || '',
                provinceState: previous.provinceState || '',
                district: previous.district || '',
                cityTownVillage: previous.cityTownVillage || '',
                assessmentSequence: existing.market_sequence,
                leadAssessor
              };
            }
          } else {
            marketResult = await client.query(
              `INSERT INTO markets
                 (name, local_name, country, province_state, district, city_town_village, identity_key, created_by)
               VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
               ON CONFLICT (created_by, identity_key) DO UPDATE SET identity_key = EXCLUDED.identity_key
               RETURNING id, name, local_name, country, province_state, district, city_town_village`,
              [
                marketInfo.marketName,
                marketInfo.localName || null,
                marketInfo.country || null,
                marketInfo.provinceState || null,
                marketInfo.district || null,
                marketInfo.cityTownVillage || null,
                buildMarketIdentityKey(marketInfo),
                req.user.id
              ]
            );
          }

          resolvedMarket = marketResult.rows[0] || null;
          if (resolvedMarket) {
            marketId = resolvedMarket.id;
            if (existing && existing.market_id === marketId && existing.market_sequence) {
              marketSequence = existing.market_sequence;
            } else {
              const sequenceResult = await client.query(
                'SELECT COALESCE(MAX(market_sequence), 0)::int + 1 AS sequence FROM assessments WHERE market_id = $1',
                [marketId]
              );
              marketSequence = sequenceResult.rows[0].sequence;
            }

            normalizedAssessment.marketInfo = {
              ...marketInfo,
              marketId,
              marketName: resolvedMarket.name,
              localName: resolvedMarket.local_name || '',
              country: resolvedMarket.country || '',
              provinceState: resolvedMarket.province_state || '',
              district: resolvedMarket.district || '',
              cityTownVillage: resolvedMarket.city_town_village || '',
              assessmentSequence: marketSequence,
              leadAssessor
            };
          }
        } else if (existing && existing.data && existing.data.marketInfo) {
          normalizedAssessment.marketInfo = existing.data.marketInfo;
        }

        if (existing) {
          await client.query(
            `UPDATE assessments
             SET data = $1, question_set_version = $2, synced_at = NOW(),
                 market_id = $3, market_sequence = $4
             WHERE id = $5 AND user_id = $6`,
            [JSON.stringify(normalizedAssessment), version || 1, marketId, marketSequence, id, req.user.id]
          );
        } else {
          await client.query(
            `INSERT INTO assessments
               (id, user_id, data, question_set_version, created_at, synced_at, market_id, market_sequence)
             VALUES ($1, $2, $3, $4, $5, NOW(), $6, $7)`,
            [
              id,
              req.user.id,
              JSON.stringify(normalizedAssessment),
              version || 1,
              created || new Date().toISOString(),
              marketId,
              marketSequence
            ]
          );
        }

        await client.query('COMMIT');
        uploaded.push(id);
        if (resolvedMarket) {
          marketAssignments.push({
            assessmentId: id,
            marketId,
            assessmentSequence: marketSequence,
            market: {
              id: resolvedMarket.id,
              marketName: resolvedMarket.name,
              localName: resolvedMarket.local_name,
              country: resolvedMarket.country,
              provinceState: resolvedMarket.province_state,
              district: resolvedMarket.district,
              cityTownVillage: resolvedMarket.city_town_village
            }
          });
        }
      } catch (err) {
        if (client) {
          try {
            await client.query('ROLLBACK');
          } catch (rollbackError) {
            console.error('Failed to roll back assessment sync:', rollbackError);
          }
        }
        console.error('Error syncing assessment:', err);
        errors.push({ id: assessment.id, error: err.message });
      } finally {
        if (client) client.release();
      }
    }

    res.json({
      message: `Synced ${uploaded.length} assessment(s)`,
      uploaded,
      marketAssignments,
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
