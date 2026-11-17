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
      indicators: [[{ name: 'Question', scores: ['One', 'Two', 'Three', 'Four'] }, { name: 'Unanswered' }, { name: 'No note' }, { name: 'N/A' }]],
      data: {
        scores: { 'indicator[0][0]': 1, 'indicator[0][2]': 2, 'indicator[0][3]': 'na' },
        notes: '<script>bad()</script>\nAssessment note',
        questionNotes: { 'indicator[0][0]': '<b>Question note</b>', 'indicator[0][1]': 'Unanswered note' }
      }
    });
    assert.match(elements['assessment-meta'].innerHTML, /&lt;script&gt;bad\(\)&lt;\/script&gt;\nAssessment note/);
    assert.match(elements['assessment-answer-groups'].innerHTML, /<th>Answer<\/th><th>Notes<\/th>/);
    assert.match(elements['assessment-answer-groups'].innerHTML, /<td>One<\/td>\s*<td class="assessment-notes">&lt;b&gt;Question note&lt;\/b&gt;<\/td>/);
    assert.match(elements['assessment-answer-groups'].innerHTML, /<td>Not answered<\/td>\s*<td class="assessment-notes">Unanswered note<\/td>/);
    assert.match(elements['assessment-answer-groups'].innerHTML, /<td class="assessment-notes">—<\/td>/);
    assert.match(elements['assessment-answer-groups'].innerHTML, /<td class="score-cell score-na">N\/A<\/td>\s*<td>Not applicable<\/td>/);
    assert.doesNotMatch(elements['assessment-meta'].innerHTML, /<script>/);
  });

  test(`${file} displays notes without question-set details or an answer`, () => {
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
      data: { scores: { 'indicator[1][2]': 'na' }, questionNotes: { 'indicator[1][2]': '<img src=x>' } }
    });
    const html = elements['assessment-answer-groups'].innerHTML;
    assert.match(html, /<th>Notes<\/th>/);
    assert.match(html, /Category 2/);
    assert.match(html, /Indicator 3/);
    assert.match(html, /<td class="score-cell score-na">N\/A<\/td><td>Not applicable<\/td><td class="assessment-notes">&lt;img src=x&gt;<\/td>/);
  });
}
