const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const adminSource = fs.readFileSync(path.join(__dirname, '../admin/admin.js'), 'utf8');

function renderAdminLists() {
  const elements = {
    'admin-users-list': { innerHTML: '', querySelectorAll: () => [] },
    'admin-assessment-summary': { innerHTML: '', querySelectorAll: () => [] }
  };
  const context = vm.createContext({
    document: {
      readyState: 'loading',
      addEventListener() {},
      getElementById: (id) => elements[id] || null
    },
    window: { location: {} },
    URLSearchParams
  });
  vm.runInContext(adminSource, context);

  context.renderUsers([{ id: 12, email: "x');window.__xss=true;//@example.test", role: 'user' }]);
  context.renderAssessmentSummary([
    { id: "assessment');window.__xss=true;//", email: 'user@example.test', created_at: '2026-01-01T00:00:00Z' }
  ], { page: 1, total: 1, totalPages: 1 });

  return {
    users: elements['admin-users-list'].innerHTML,
    assessments: elements['admin-assessment-summary'].innerHTML
  };
}

test('admin list rows never compile user-controlled email or assessment IDs as inline JavaScript', () => {
  const rendered = renderAdminLists();
  for (const html of Object.values(rendered)) {
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
  }
  assert.match(rendered.users, /data-admin-action=/);
  assert.match(rendered.assessments, /data-admin-action=/);
});
