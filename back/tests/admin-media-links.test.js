const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

for (const [htmlFile, scriptFile, render] of [
  ['index.html', 'admin.js', 'renderAssessmentDetail'],
  ['assessment-view.html', 'assessment-view.js', 'renderAssessment']
]) {
  test(`${htmlFile} loads the shared renderer before its page script`, () => {
    const html = fs.readFileSync(path.join(__dirname, '../admin', htmlFile), 'utf8');
    const shared = html.indexOf('<script src="/admin-assets/global_functions.js" defer></script>');
    const page = html.indexOf(`<script src="/admin-assets/${scriptFile}" defer></script>`);
    assert.ok(shared !== -1 && page > shared);
  });

  test(`${scriptFile} renders escaped media and binds protected downloads`, async () => {
    let clickHandler;
    let prevented = false;
    let request;
    let downloaded;
    const mediaLink = {
      dataset: { mediaUrl: '/api/media/1', mediaFilename: 'photo.jpg' },
      addEventListener: (type, handler) => {
        assert.equal(type, 'click');
        clickHandler = handler;
      }
    };
    const elements = {
      'assessment-meta': {
        innerHTML: '',
        querySelectorAll: (selector) => {
          assert.equal(selector, '[data-media-download="true"]');
          return [mediaLink];
        }
      },
      'assessment-answer-groups': { innerHTML: '' },
      'assessment-detail-status': { classList: { remove: () => {} } },
      'assessment-status': {}
    };
    const document = {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: (id) => elements[id],
      createElement: () => ({
        click() { downloaded = { href: this.href, filename: this.download }; }
      }),
      body: { appendChild: () => {}, removeChild: () => {} }
    };
    const context = vm.createContext({
      document,
      window: { location: { origin: 'https://example.test' } },
      localStorage: { getItem: () => 'test-token' },
      fetch: async (url, options) => {
        request = { url, authorization: options.headers.Authorization };
        return { ok: true, blob: async () => ({}) };
      },
      URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} }
    });
    for (const file of ['market-map.js', 'global_functions.js', scriptFile]) {
      vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin', file), 'utf8'), context);
    }

    context[render]({
      id: 'assessment',
      media: [
        { id: 1, filename: '<photo "one">.jpg', url: '/api/media/1?x="&y=1', uploadedAt: '2025-01-01T00:00:00Z' },
        { id: 2 }
      ],
      data: {}
    });
    const html = elements['assessment-meta'].innerHTML;
    assert.match(html, /data-media-url="\/api\/media\/1\?x=&quot;&amp;y=1"/);
    assert.match(html, /data-media-filename="&lt;photo &quot;one&quot;&gt;\.jpg">&lt;photo &quot;one&quot;&gt;\.jpg<\/a>/);
    assert.match(html, /<small>\(.+?\)<\/small>/);
    assert.match(html, /data-media-url="#" data-media-filename="File 2">File 2<\/a>/);
    assert.equal(typeof clickHandler, 'function');
    await clickHandler({ preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.deepEqual(request, { url: 'https://example.test/api/media/1', authorization: 'Bearer test-token' });
    assert.deepEqual(downloaded, { href: 'blob:test', filename: 'photo.jpg' });

    context[render]({ id: 'assessment', data: {} });
    assert.match(elements['assessment-meta'].innerHTML, /<strong>Uploaded Media:<\/strong> —/);
  });
}
