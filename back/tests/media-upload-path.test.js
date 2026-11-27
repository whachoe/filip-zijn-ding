const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const express = require('express');
const db = require('../config/db');

test('multipart upload keeps files under the upload root for hostile assessment IDs', async (t) => {
  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mmt-media-path-'));
  const uploadRoot = path.join(tempRoot, 'uploads');
  const escapedPath = path.join(tempRoot, 'escaped', 'photo.jpg');
  const previousUploadDir = process.env.UPLOAD_DIR;
  const previousQuery = db.query;
  const previousConsoleError = console.error;
  const mediaModule = require.resolve('../routes/media');
  let server;

  process.env.UPLOAD_DIR = uploadRoot;
  delete require.cache[mediaModule];
  db.query = async () => { throw new Error('database unavailable'); };
  console.error = () => {};

  const mediaRouter = require('../routes/media');
  const app = express();
  app.use('/api/media', (req, res, next) => {
    req.user = { id: 7, role: 'user' };
    next();
  }, mediaRouter);
  server = app.listen(0, '127.0.0.1');

  t.after(async () => {
    await new Promise((resolve) => server.close(resolve));
    db.query = previousQuery;
    console.error = previousConsoleError;
    if (previousUploadDir === undefined) delete process.env.UPLOAD_DIR;
    else process.env.UPLOAD_DIR = previousUploadDir;
    delete require.cache[mediaModule];
    for (const file of [escapedPath, path.join(uploadRoot, '7', 'photo.jpg')]) {
      if (fs.existsSync(file)) fs.unlinkSync(file);
    }
    for (const directory of [path.join(tempRoot, 'escaped'), path.join(uploadRoot, '7'), uploadRoot, tempRoot]) {
      if (fs.existsSync(directory)) fs.rmdirSync(directory);
    }
  });

  await new Promise((resolve) => server.once('listening', resolve));
  const form = new FormData();
  form.append('assessmentId', '../../../escaped');
  form.append('file', new Blob(['test file'], { type: 'image/jpeg' }), 'photo.jpg');

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/media`, {
    method: 'POST',
    body: form
  });

  assert.equal(response.status, 500);
  assert.equal(fs.existsSync(escapedPath), false, 'assessment ID must not redirect storage outside the upload root');
  assert.equal(fs.existsSync(path.join(uploadRoot, '7', 'photo.jpg')), true, 'file should remain in the authenticated user directory');
});
