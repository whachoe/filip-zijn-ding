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
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/market-map.js'), 'utf8'), context);
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
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/market-map.js'), 'utf8'), context);
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

  test(`${file} displays escaped market information and repeat sequence above answers`, () => {
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
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/market-map.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin', file), 'utf8'), context);
    context[render]({
      id: 'assessment',
      email: 'account@example.com',
      categories: ['First'],
      indicators: [[{ name: 'Question' }]],
      data: {
        scores: {},
        marketInfo: {
          marketId: 23,
          marketName: '<img src=x onerror=alert(1)>',
          localName: 'Local Market',
          country: 'Uganda',
          provinceState: 'Central',
          district: 'Kampala',
          cityTownVillage: 'Kampala',
          setting: 'Other',
          settingOther: 'Urban edge',
          latitude: 0.3,
          longitude: 32.5,
          assessmentSequence: 3,
          leadAssessor: { userId: 7, name: 'Lead Assessor', email: 'lead@example.com' },
          otherAssessors: [{ name: 'Second Assessor', organization: 'Health Unit' }],
          generalNotes: '<script>market note</script>'
        }
      }
    });

    const meta = elements['assessment-meta'].innerHTML;
    assert.ok(meta.indexOf('Market name:') !== -1);
    assert.match(meta, /&lt;img src=x onerror=alert\(1\)&gt;/);
    assert.match(meta, /Assessment sequence:<\/strong> <span>Repeat 2<\/span>/);
    assert.match(meta, /Other assessors present:<\/strong> <span>Second Assessor — Health Unit<\/span>/);
    assert.match(meta, /&lt;script&gt;market note&lt;\/script&gt;/);
    assert.doesNotMatch(meta, /<img src=x/);
    assert.doesNotMatch(meta, /<script>market note/);
    assert.match(meta, /User:<\/strong> account@example.com/);
    assert.match(meta, /<iframe title="Market location map"[^>]+marker=0\.3,32\.5/);
  });

  test(`${file} only displays a map for valid GPS coordinates`, () => {
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
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin/market-map.js'), 'utf8'), context);
    vm.runInContext(fs.readFileSync(path.join(__dirname, '../admin', file), 'utf8'), context);
    function renderCoordinates(latitude, longitude) {
      context[render]({ id: 'assessment', data: { scores: {}, marketInfo: { latitude, longitude } } });
      return elements['assessment-meta'].innerHTML;
    }

    assert.match(renderCoordinates(0, 0), /marker=0,0/);
    assert.match(renderCoordinates('51.236', '-4.42'), /marker=51\.236,-4\.42/);
    for (const [latitude, longitude] of [[null, 1], ['', 1], [1, undefined], [91, 1], [1, 181], ['1" onload="bad()', 1]]) {
      assert.doesNotMatch(renderCoordinates(latitude, longitude), /<iframe/);
    }
    assert.match(renderCoordinates(90, 0), /Map unavailable for these coordinates/);
  });
}
