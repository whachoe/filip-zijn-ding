const assert = require('node:assert/strict');
const test = require('node:test');
const express = require('express');
const testModeRouter = require('../routes/test-mode');

for (const enabled of [false, true]) {
  test(`test-mode endpoint is ${enabled ? 'enabled' : 'disabled'}`, async () => {
    const app = express();
    app.use('/api/test-mode', testModeRouter(enabled));
    const server = app.listen(0, '127.0.0.1');
    await new Promise((resolve) => server.once('listening', resolve));
    try {
      const response = await fetch(`http://127.0.0.1:${server.address().port}/api/test-mode`);
      assert.equal(response.status, enabled ? 200 : 404);
      assert.equal(response.headers.get('cache-control'), 'no-store');
      if (enabled) assert.deepEqual(await response.json(), { enabled: true });
    } finally {
      await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    }
  });
}
