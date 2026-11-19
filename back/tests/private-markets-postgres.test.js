const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const { Client } = require('pg');
const db = require('../config/db');
const router = require('../routes/assessments');

const listMarkets = router.stack.find((layer) => layer.route && layer.route.path === '/markets').route.stack[0].handle;
const syncAssessments = router.stack.find((layer) => layer.route && layer.route.path === '/' && layer.route.methods.post).route.stack[0].handle;

function response() {
  return {
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; }
  };
}

test('private markets and legacy assessments with PostgreSQL', { skip: !process.env.MARKET_TEST_DATABASE }, async () => {
  const client = new Client({ database: process.env.MARKET_TEST_DATABASE });
  await client.connect();
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  const originalError = console.error;
  db.query = client.query.bind(client);
  db.pool.connect = async () => ({ query: client.query.bind(client), release() {} });
  console.error = () => {};
  try {
    await client.query(`
      CREATE TEMP TABLE users (id INTEGER PRIMARY KEY, email TEXT, first_name TEXT, last_name TEXT);
      CREATE TEMP TABLE markets (
        id BIGSERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, local_name VARCHAR(255),
        country VARCHAR(255), province_state VARCHAR(255), district VARCHAR(255),
        city_town_village VARCHAR(255), identity_key TEXT NOT NULL UNIQUE,
        created_by INTEGER REFERENCES users(id), created_at TIMESTAMP DEFAULT NOW()
      );
      CREATE TEMP TABLE assessments (
        id TEXT PRIMARY KEY, user_id INTEGER REFERENCES users(id), data JSONB,
        question_set_version INTEGER, created_at TIMESTAMP, synced_at TIMESTAMP
      );
      INSERT INTO users VALUES (1, 'one@example.com', 'One', 'User'), (2, 'two@example.com', 'Two', 'User');
    `);
    for (const migration of ['006_market_records.sql', '007_private_markets.sql', '007_private_markets.sql']) {
      await client.query(fs.readFileSync(path.join(__dirname, '../migrations', migration), 'utf8'));
    }

    async function sync(userId, id, info) {
      const res = response();
      await syncAssessments({ user: { id: userId }, body: { id, scores: {}, marketInfo: info } }, res);
      return res.body;
    }
    async function markets(userId) {
      const res = response();
      await listMarkets({ user: { id: userId } }, res);
      return res.body.markets;
    }
    const info = { marketName: 'Test market', country: 'Belgium', setting: 'Small town', generalNotes: 'Owner notes' };
    const first = await sync(1, 'first', info);
    const second = await sync(2, 'second', { ...info, generalNotes: 'Other user notes' });
    assert.deepEqual(first.uploaded, ['first']);
    assert.deepEqual(second.uploaded, ['second']);
    const firstId = first.marketAssignments[0].marketId;
    const secondId = second.marketAssignments[0].marketId;
    assert.notEqual(firstId, secondId);
    const repeat = await sync(1, 'repeat', info);
    assert.equal(repeat.marketAssignments[0].marketId, firstId);
    assert.equal(repeat.marketAssignments[0].assessmentSequence, 2);

    const rejected = await sync(2, 'forbidden', { ...info, marketId: firstId });
    assert.deepEqual(rejected.uploaded, []);
    assert.match(rejected.errors[0].error, /does not belong to you/);

    await client.query(
      'UPDATE assessments SET market_id = $1, market_sequence = 3 WHERE id = $2',
      [firstId, 'second']
    );
    const legacy = await sync(2, 'second', { ...info, marketId: firstId, marketName: 'Tampered name', generalNotes: 'Private legacy notes' });
    assert.deepEqual(legacy.uploaded, ['second']);
    assert.deepEqual(legacy.marketAssignments, []);
    const stored = await client.query('SELECT data FROM assessments WHERE id = $1', ['second']);
    assert.equal(stored.rows[0].data.marketInfo.marketName, 'Test market');
    assert.equal(stored.rows[0].data.marketInfo.generalNotes, 'Private legacy notes');

    const ownerMarkets = await markets(1);
    assert.equal(ownerMarkets.length, 1);
    assert.equal(ownerMarkets[0].assessmentCount, 2);
    assert.equal(ownerMarkets[0].generalNotes, 'Owner notes');
    const otherMarkets = await markets(2);
    assert.equal(otherMarkets.length, 1);
    assert.equal(otherMarkets[0].id, secondId);
    assert.equal(otherMarkets[0].assessmentCount, 0);
    assert.equal(otherMarkets[0].generalNotes, null);
  } finally {
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    console.error = originalError;
    await client.end();
  }
});
