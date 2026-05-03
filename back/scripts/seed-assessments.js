require('dotenv').config();

const db = require('../config/db');

function createAssessmentId(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');
  return `assessment_${year}${month}${day}_${hours}${minutes}${seconds}`;
}

function parseArgs(argv) {
  const args = argv.slice(2);
  const options = {
    count: Number.parseInt(args[0], 10),
    userId: null,
    dryRun: false
  };

  args.slice(1).forEach((arg) => {
    if (arg === '--dry-run') {
      options.dryRun = true;
      return;
    }

    if (arg.indexOf('--userId=') === 0) {
      options.userId = Number.parseInt(arg.split('=')[1], 10);
    }
  });

  return options;
}

function validateOptions(options) {
  if (!Number.isInteger(options.count) || options.count <= 0) {
    throw new Error('Usage: npm run seed:assessments -- <count> [--userId=<id>] [--dry-run]');
  }

  if (options.userId != null && (!Number.isInteger(options.userId) || options.userId <= 0)) {
    throw new Error('The --userId value must be a positive integer.');
  }
}

async function getTargetUser(userId) {
  if (userId != null) {
    const result = await db.query(
      'SELECT id, username, email, first_name, last_name, location, role FROM users WHERE id = $1',
      [userId]
    );

    if (!result.rows.length) {
      throw new Error(`User ${userId} not found.`);
    }

    return result.rows[0];
  }

  const result = await db.query(
    `SELECT id, username, email, first_name, last_name, location, role
     FROM users
     ORDER BY CASE WHEN role = 'admin' THEN 1 ELSE 0 END, id ASC
     LIMIT 1`
  );

  if (!result.rows.length) {
    throw new Error('No users found. Create a user first or pass --userId=<id>.');
  }

  return result.rows[0];
}

async function getLatestQuestionSet() {
  const result = await db.query(
    'SELECT version, categories, indicators FROM question_sets ORDER BY version DESC LIMIT 1'
  );

  if (!result.rows.length) {
    throw new Error('No question sets found. Run migrations first.');
  }

  return result.rows[0];
}

function randomScore() {
  return String(1 + Math.floor(Math.random() * 4));
}

function buildScores(indicators) {
  const scores = {};

  indicators.forEach((categoryIndicators, categoryIndex) => {
    categoryIndicators.forEach((indicator, indicatorIndex) => {
      scores[`indicator[${categoryIndex}][${indicatorIndex}]`] = randomScore();
    });
  });

  return scores;
}

function buildContactInfo(user, sequence) {
  const firstName = String(user.first_name || '').trim();
  const lastName = String(user.last_name || '').trim();
  const fullName = `${firstName} ${lastName}`.trim() || user.username || `Demo User ${sequence}`;

  return {
    fullName,
    email: String(user.email || `${String(user.username || 'user').toLowerCase()}@example.com`).trim(),
    location: String(user.location || 'Demo Market').trim()
  };
}

function buildAssessment(user, questionSet, createdAt, sequence) {
  const id = createAssessmentId(createdAt);
  const indicators = Array.isArray(questionSet.indicators) ? questionSet.indicators : JSON.parse(questionSet.indicators || '[]');
  const scores = buildScores(indicators);

  return {
    id,
    contactInfo: buildContactInfo(user, sequence),
    scores,
    progress: {
      currentQuestionIndex: Math.max(0, Object.keys(scores).length - 1),
      totalQuestions: Object.keys(scores).length,
      lastUpdated: createdAt.toISOString(),
      completed: true,
      completedAt: createdAt.toISOString()
    },
    mediaAttachments: [],
    notes: `Generated fake assessment ${sequence}`,
    synced: true,
    version: questionSet.version,
    created: createdAt.toISOString()
  };
}

async function insertAssessment(userId, assessment, questionSetVersion) {
  await db.query(
    `INSERT INTO assessments (id, user_id, data, question_set_version, created_at, synced_at)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      assessment.id,
      userId,
      JSON.stringify(assessment),
      questionSetVersion,
      assessment.created,
      assessment.created
    ]
  );
}

async function main() {
  try {
    const options = parseArgs(process.argv);
    validateOptions(options);

    console.log('Preparing fake assessment seed...');

    const user = await getTargetUser(options.userId);
    const questionSet = await getLatestQuestionSet();
    const createdAssessments = [];
    const baseTime = new Date(Date.now() - (options.count * 1000));

    for (let index = 0; index < options.count; index++) {
      const createdAt = new Date(baseTime.getTime() + (index * 1000));
      const assessment = buildAssessment(user, questionSet, createdAt, index + 1);
      createdAssessments.push(assessment);

      if (!options.dryRun) {
        await insertAssessment(user.id, assessment, questionSet.version);
      }
    }

    console.log(`${options.dryRun ? 'Would create' : 'Created'} ${createdAssessments.length} assessment(s) for user ${user.id} (${user.email || user.username || 'unknown'}).`);
    console.log(`Question set version: ${questionSet.version}`);
    console.log(`First generated ID: ${createdAssessments[0].id}`);
    console.log(`Last generated ID: ${createdAssessments[createdAssessments.length - 1].id}`);

    process.exit(0);
  } catch (error) {
    console.error('Fake assessment seed failed:', error.message || error);
    process.exit(1);
  }
}

main();