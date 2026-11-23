const assert = require('node:assert/strict');
const test = require('node:test');
const db = require('../config/db');
const bcryptPath = require.resolve('bcrypt');
const cachedBcrypt = require.cache[bcryptPath];
require.cache[bcryptPath] = {
  id: bcryptPath,
  filename: bcryptPath,
  loaded: true,
  exports: { hash: async (password) => `hash:${password}`, compare: async () => true }
};
const auth = require('../routes/auth');
const admin = require('../routes/admin');
if (cachedBcrypt) require.cache[bcryptPath] = cachedBcrypt;
else delete require.cache[bcryptPath];

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

test('registration and admin creation retain validation and normalization', async () => {
  const original = db.query;
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.startsWith('SELECT')) return { rows: [] };
    return { rows: [{ id: 1, username: params[0], email: params[2], role: 'user' }] };
  };
  try {
    for (const [router, route] of [[auth, '/register'], [admin, '/users']]) {
      const create = handler(router, route, 'post');
      for (const [body, message] of [
        [{ email: ' ', password: 'abcdef' }, 'Email and password required'],
        [{ email: 'invalid', password: 'abcdef' }, 'Valid email required'],
        [{ email: 'a@example.com', password: '123' }, 'Password must be at least 6 characters']
      ]) {
        const res = response();
        await create({ body }, res);
        assert.equal(res.statusCode, 400);
        assert.equal(res.body.error, message);
      }
      const res = response();
      await create({ body: { email: '  USER@Example.COM ', password: 'abcdef' } }, res);
      assert.equal(res.statusCode, 201);
      const lookup = queries[queries.length - 2];
      const insert = queries[queries.length - 1];
      assert.equal(lookup.params[0], 'user@example.com');
      assert.equal(insert.params[2], 'user@example.com');
      assert.match(insert.params[0], /^user_\d+_\d+$/);
      assert.equal(insert.params[1], 'hash:abcdef');
    }
  } finally {
    db.query = original;
  }
});

test('login and admin update use the same normalized email with their existing behavior', async () => {
  const original = db.query;
  const queries = [];
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    if (sql.includes('password_hash, email')) {
      return { rows: [{ id: 1, email: params[0], password_hash: 'hash', role: 'user' }] };
    }
    if (sql.startsWith('SELECT id, role')) return { rows: [{ id: 1, role: 'user' }] };
    if (sql.startsWith('SELECT id FROM users')) return { rows: [] };
    return { rows: [{ id: 1, email: params[0] }] };
  };
  try {
    const login = response();
    await handler(auth, '/login', 'post')({ body: { email: ' USER@Example.com ', password: 'abcdef' } }, login);
    assert.equal(login.body.user.email, 'user@example.com');
    assert.equal(queries[0].params[0], 'user@example.com');

    const update = handler(admin, '/users/:id', 'put');
    const invalid = response();
    await update({ params: { id: '1' }, user: { id: 2 }, body: { email: 'bad' } }, invalid);
    assert.equal(invalid.statusCode, 400);
    assert.equal(invalid.body.error, 'Valid email required');
    const updated = response();
    await update({ params: { id: '1' }, user: { id: 2 }, body: { email: ' UPDATED@Example.com ' } }, updated);
    assert.equal(updated.body.user.email, 'updated@example.com');
    assert.equal(queries[queries.length - 1].params[0], 'updated@example.com');
  } finally {
    db.query = original;
  }
});
