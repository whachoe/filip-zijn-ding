const assert = require('node:assert/strict');
const os = require('node:os');
const path = require('node:path');
const { spawn } = require('node:child_process');
const test = require('node:test');

const lanAddress = Object.values(os.networkInterfaces()).flat()
  .find((address) => address.family === 'IPv4' && !address.internal)?.address;

async function startServer(testMode) {
  const script = `
    const bcrypt = require.resolve('bcrypt');
    require.cache[bcrypt] = { id: bcrypt, filename: bcrypt, loaded: true, exports: {} };
    require('./server');
  `;
  const child = spawn(process.execPath, ['-e', script], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, PORT: '0', MMT_TEST_MODE: testMode ? '1' : '' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  let output = '';
  try {
    const port = await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`Server did not start: ${output}`)), 10000);
      child.stdout.on('data', (data) => {
        output += data;
        const match = output.match(/listening on (?:all interfaces|127\.0\.0\.1) port (\d+)/);
        if (match) {
          clearTimeout(timer);
          resolve(Number(match[1]));
        }
      });
      child.stderr.on('data', (data) => { output += data; });
      child.once('error', (error) => { clearTimeout(timer); reject(error); });
      child.once('exit', (code) => { clearTimeout(timer); reject(new Error(`Server exited (${code}): ${output}`)); });
    });
    return { child, port };
  } catch (error) {
    child.kill();
    throw error;
  }
}

for (const enabled of [false, true]) {
  test(`server ${enabled ? 'accepts LAN connections in test mode' : 'binds only to loopback by default'}`, {
    skip: !lanAddress && 'No non-loopback IPv4 interface is available'
  }, async () => {
    const { child, port } = await startServer(enabled);
    try {
      const local = await fetch(`http://127.0.0.1:${port}/api/health`);
      assert.equal(local.status, 200);
      const capability = await fetch(`http://127.0.0.1:${port}/api/test-mode`);
      assert.equal(capability.status, enabled ? 200 : 404);
      if (enabled) {
        const lan = await fetch(`http://${lanAddress}:${port}/api/health`);
        assert.equal(lan.status, 200);
      } else {
        await assert.rejects(fetch(`http://${lanAddress}:${port}/api/health`));
      }
    } finally {
      child.kill();
      await new Promise((resolve) => child.once('exit', resolve));
    }
  });
}
