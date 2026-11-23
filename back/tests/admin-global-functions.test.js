const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adminDir = path.join(__dirname, '../admin');
const sharedSource = fs.readFileSync(path.join(adminDir, 'global_functions.js'), 'utf8');

function createContext(fetch) {
  const storage = new Map();
  const localStorage = {
    getItem: (key) => storage.has(key) ? storage.get(key) : null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: (key) => storage.delete(key)
  };
  const context = vm.createContext({ window: { location: { origin: 'https://example.test' } }, localStorage, fetch });
  vm.runInContext(sharedSource, context);
  return { context, storage };
}

function run(context, expression) {
  return vm.runInContext(expression, context);
}

test('all admin pages load shared functions before their page script', () => {
  for (const [htmlFile, jsFile] of [
    ['index.html', 'admin.js'],
    ['assessment-view.html', 'assessment-view.js'],
    ['user-form.html', 'user-form.js']
  ]) {
    const html = fs.readFileSync(path.join(adminDir, htmlFile), 'utf8');
    const shared = html.indexOf('<script src="/admin-assets/global_functions.js" defer></script>');
    const page = html.indexOf(`<script src="/admin-assets/${jsFile}" defer></script>`);
    assert.ok(shared !== -1 && page > shared, htmlFile);
  }
});

test('API requests preserve custom headers, authorization, options and errors', async () => {
  const requests = [];
  let response = { ok: true, json: async () => ({ success: true }) };
  const { context, storage } = createContext(async (url, options) => {
    requests.push({ url, options });
    return response;
  });

  await run(context, "apiRequest('/first', { method: 'POST', headers: { 'X-Test': 'value' }, body: 'payload' })");
  assert.equal(requests[0].url, 'https://example.test/first');
  assert.equal(requests[0].options.method, 'POST');
  assert.equal(requests[0].options.body, 'payload');
  assert.equal(requests[0].options.headers['Content-Type'], 'application/json');
  assert.equal(requests[0].options.headers['X-Test'], 'value');
  assert.equal(requests[0].options.headers.Authorization, undefined);

  storage.set('jwt_token', 'test-token');
  await run(context, "apiRequest('/second', { headers: { Authorization: 'other' } })");
  assert.equal(requests[1].options.headers.Authorization, 'Bearer test-token');

  response = { ok: false, status: 403, json: async () => ({ error: 'Forbidden' }) };
  await assert.rejects(run(context, "apiRequest('/error')"), /Forbidden/);
  response = { ok: false, status: 502, json: async () => { throw new Error('not JSON'); } };
  await assert.rejects(run(context, "apiRequest('/error')"), /Request failed: 502/);
});

test('login stores credentials and getMe only updates the main admin cache when requested', async () => {
  let response = { token: 'new-token', user: { id: 1, role: 'admin' } };
  const requests = [];
  const { context, storage } = createContext(async (url, options) => {
    requests.push({ url, options });
    return { ok: true, json: async () => response };
  });
  await run(context, "AuthAPI.login('admin@example.test', 'password')");
  assert.equal(requests[0].url, 'https://example.test/api/auth/login');
  assert.deepEqual(JSON.parse(requests[0].options.body), { email: 'admin@example.test', password: 'password' });
  assert.equal(storage.get('jwt_token'), 'new-token');
  assert.deepEqual(JSON.parse(storage.get('current_user')), { id: 1, role: 'admin' });

  response = { user: { id: 2, role: 'admin' } };
  await run(context, 'AuthAPI.getMe()');
  assert.equal(JSON.parse(storage.get('current_user')).id, 1);
  await run(context, 'AuthAPI.getMe(true)');
  assert.equal(JSON.parse(storage.get('current_user')).id, 2);
  response = {};
  await run(context, 'AuthAPI.getMe(true)');
  assert.equal(JSON.parse(storage.get('current_user')).id, 2);
});

test('logout clears the session even when the request fails', async () => {
  const { context, storage } = createContext(async () => { throw new Error('offline'); });
  storage.set('jwt_token', 'test-token');
  storage.set('current_user', '{}');
  await assert.rejects(run(context, 'AuthAPI.logout()'), /offline/);
  assert.equal(storage.has('jwt_token'), false);
  assert.equal(storage.has('current_user'), false);
});

test('user form bootstraps and uses shared authenticated requests', async () => {
  const requests = [];
  const { context, storage } = createContext(async (url, options) => {
    requests.push({ url, authorization: options.headers.Authorization });
    return { ok: true, json: async () => ({ user: { role: 'admin' } }) };
  });
  storage.set('jwt_token', 'test-token');
  const elements = {};
  context.window.location.pathname = '/admin/users/new';
  context.document = {
    readyState: 'loading',
    addEventListener: () => {},
    getElementById: (id) => {
      if (!elements[id]) elements[id] = { addEventListener: () => {} };
      return elements[id];
    }
  };
  vm.runInContext(fs.readFileSync(path.join(adminDir, 'user-form.js'), 'utf8'), context);
  await run(context, 'bootstrap()');
  assert.equal(elements['page-title'].textContent, 'Create User');
  assert.equal(elements['user-password'].required, true);
  assert.equal(elements['form-status'].textContent, 'Enter details for the new user.');
  assert.deepEqual(requests, [{ url: 'https://example.test/api/auth/me', authorization: 'Bearer test-token' }]);
});
