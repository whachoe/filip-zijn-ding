const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

for (const [file, render] of [['admin.js', 'renderAssessmentDetail'], ['assessment-view.js', 'renderAssessment']]) {
  test(`${file} displays and escapes assessment and question notes`, () => {
    const elements = {
      'assessment-meta': { innerHTML: '', querySelectorAll: () => [] },
      'assessment-answer-groups': { innerHTML: '' },
      'assessment-detail-status': {},
      'assessment-status': {}
    };
    const document = {
      readyState: 'loading',
      addEventListener: () => {},
      getElementById: (id) => elements[id]
    };
    const context = vm.createContext({ document, window: { location: { origin: '' } } });
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin', file), 'utf8'), context);
    context[render]({
      id: 'assessment',
      categories: ['First'],
      indicators: [[{ name: 'Question', scores: ['One', 'Two', 'Three', 'Four'] }]],
      data: {
        scores: { 'indicator[0][0]': 1 },
        notes: '<script>bad()</script>\nAssessment note',
        questionNotes: { 'indicator[0][0]': '<b>Question note</b>' }
      }
    });
    assert.match(elements['assessment-meta'].innerHTML, /&lt;script&gt;bad\(\)&lt;\/script&gt;\nAssessment note/);
    assert.match(elements['assessment-answer-groups'].innerHTML, /&lt;b&gt;Question note&lt;\/b&gt;/);
    assert.doesNotMatch(elements['assessment-meta'].innerHTML, /<script>/);
  });
}
