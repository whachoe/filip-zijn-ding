const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

function renderAssessment(row) {
  const elements = {
    'assessment-meta': { innerHTML: '', querySelectorAll: () => [] },
    'assessment-answer-groups': { innerHTML: '' },
    'assessment-detail-status': {}
  };
  const document = {
    readyState: 'loading',
    addEventListener: () => {},
    getElementById: (id) => elements[id]
  };
  const context = vm.createContext({ document, window: { location: { origin: '' } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/market-map.js'), 'utf8'), context);
  const source = fs.readFileSync(path.join(__dirname, '../admin/admin.js'), 'utf8');
  vm.runInContext(source, context);
  context.renderAssessmentDetail(row);
  return elements['assessment-answer-groups'].innerHTML;
}

test('category scores use only the displayed answered indicators', () => {
  const html = renderAssessment({
    id: 'assessment',
    categories: ['First', 'Second', 'Empty'],
    indicators: [
      [{ name: 'A' }, { name: 'B' }, { name: 'Unanswered' }, { name: 'N/A' }, { name: 'Also unanswered' }],
      [{ name: 'C' }],
      [{ name: 'D' }]
    ],
    data: {
      scores: {
        'indicator[0][0]': '4',
        'indicator[0][1]': 2,
        'indicator[0][2]': '',
        'indicator[0][3]': 'na',
        'indicator[1][0]': 1,
        'indicator[2][0]': null,
        'indicator[2][99]': 4
      }
    }
  });

  const sections = [...html.matchAll(/<section class="category-box">([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, 3);
  assert.match(sections[0][1], /<td class="score-cell score-na">N\/A<\/td><td>Not applicable<\/td>/);
  assert.match(sections[0][1], /<td><strong>Category Score\(Confidence Score\)<\/strong><\/td><td class="score-cell">3 \(50%\)<\/td><td><\/td>/);
  assert.match(sections[1][1], /<td><strong>Category Score\(Confidence Score\)<\/strong><\/td><td class="score-cell">1 \(100%\)<\/td><td><\/td>/);
  assert.match(sections[2][1], /<td><strong>Category Score\(Confidence Score\)<\/strong><\/td><td class="score-cell">— \(0%\)<\/td><td><\/td>/);
  assert.match(html, /<td><strong>Overall Score<\/strong><\/td><td class="score-cell">2 \(50%\)<\/td><td><\/td>/);
  assert.ok(html.indexOf('Category Score') < html.indexOf('Overall Score'));
  assert.equal((html.match(/<col class="assessment-answer-col-score">/g) || []).length, 4);
});

test('missing question-set data retains the answer fallback and overall score', () => {
  const html = renderAssessment({
    id: 'assessment',
    data: { scores: { 'indicator[0][0]': 3 } }
  });

  assert.match(html, /<h3>Answers<\/h3>/);
  assert.doesNotMatch(html, /Category Score/);
  assert.match(html, /<td><strong>Overall Score<\/strong><\/td><td class="score-cell">3 \(—\)<\/td><td><\/td>/);
});

test('empty question sets do not report a misleading average or confidence', () => {
  const html = renderAssessment({
    id: 'assessment',
    categories: ['Empty'],
    indicators: [[]],
    data: { scores: {} }
  });

  assert.match(html, /Category Score\(Confidence Score\)<\/strong><\/td><td class="score-cell">— \(—\)/);
  assert.match(html, /Overall Score<\/strong><\/td><td class="score-cell">— \(—\)/);
});

test('missing category definitions make overall confidence unavailable', () => {
  const html = renderAssessment({
    id: 'assessment',
    categories: ['Known', 'Missing'],
    indicators: [[{ name: 'A' }]],
    data: { scores: { 'indicator[0][0]': 4 } }
  });

  assert.match(html, /Category Score\(Confidence Score\)<\/strong><\/td><td class="score-cell">4 \(100%\)/);
  assert.match(html, /Overall Score<\/strong><\/td><td class="score-cell">4 \(—\)/);
});
