const assert = require('node:assert/strict');
const test = require('node:test');

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

test('market list scopes both ownership and assessment details to the user', async () => {
  const original = db.query;
  let query;
  db.query = async (sql, params) => {
    query = { sql, params };
    return { rows: [] };
  };
  try {
    const res = response();
    await listMarkets({ user: { id: 7 } }, res);
    assert.deepEqual(query.params, [7]);
    assert.match(query.sql, /WHERE m\.created_by = \$1/);
    assert.equal((query.sql.match(/a\.user_id = \$1/g) || []).length, 2);
    assert.deepEqual(res.body.markets, []);
  } finally {
    db.query = original;
  }
});

test('sync rejects a new assessment referencing another user’s market', async () => {
  const originalQuery = db.query;
  const originalConnect = db.pool.connect;
  const originalError = console.error;
  const queries = [];
  db.query = async () => ({ rows: [{ id: 7, email: 'user@example.com' }] });
  db.pool.connect = async () => ({
    async query(sql, params) {
      queries.push({ sql, params });
      return { rows: [] };
    },
    release() {}
  });
  console.error = () => {};
  try {
    const res = response();
    await syncAssessments({
      user: { id: 7 },
      body: { id: 'assessment', scores: {}, marketInfo: { marketId: 99, marketName: 'Market', setting: 'Small town' } }
    }, res);
    assert.deepEqual(res.body.uploaded, []);
    assert.match(res.body.errors[0].error, /does not belong to you/);
    const lookup = queries.find((entry) => entry.sql.includes('FROM markets WHERE'));
    assert.match(lookup.sql, /created_by = \$2/);
    assert.deepEqual(lookup.params, [99, 7]);
    assert.ok(queries.some((entry) => entry.sql === 'ROLLBACK'));
  } finally {
    db.query = originalQuery;
    db.pool.connect = originalConnect;
    console.error = originalError;
  }
});
