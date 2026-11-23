const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../config/db');
const bcryptPath = require.resolve('bcrypt');
const cachedBcrypt = require.cache[bcryptPath];
require.cache[bcryptPath] = { id: bcryptPath, filename: bcryptPath, loaded: true, exports: {} };
const admin = require('../routes/admin');
if (cachedBcrypt) require.cache[bcryptPath] = cachedBcrypt;
else delete require.cache[bcryptPath];
const questions = require('../routes/questions');

function handler(router, routePath, method) {
  return router.stack.find((layer) => layer.route && layer.route.path === routePath && layer.route.methods[method])
    .route.stack[0].handle;
}

function response() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('published notes labels persist in question sets and are returned by latest endpoint', async () => {
  const originalQuery = db.query;
  let saved;
  db.query = async (sql, params) => {
    if (sql.includes('MAX(version)')) return { rows: [{ max_version: 1 }] };
    if (sql.includes('INSERT INTO question_sets')) {
      saved = { version: params[0], categories: JSON.parse(params[1]), indicators: JSON.parse(params[2]) };
      return { rows: [saved] };
    }
    if (sql.includes('FROM question_sets ORDER BY version DESC LIMIT 1')) return { rows: [saved] };
    throw new Error(`Unexpected query: ${sql}`);
  };
  try {
    const indicator = { name: 'Question', scores: ['1', '2', '3', '4'], notesLabel: 'Describe your observations' };
    const published = response();
    await handler(admin, '/questions', 'post')({ body: { categories: ['Category'], indicators: [[indicator]] } }, published);
    assert.equal(published.statusCode, 201);
    const latest = response();
    await handler(questions, '/latest', 'get')({}, latest);
    assert.equal(latest.body.questionSet.version, 2);
    assert.deepEqual(latest.body.questionSet.indicators[0][0], indicator);
  } finally {
    db.query = originalQuery;
  }
});
