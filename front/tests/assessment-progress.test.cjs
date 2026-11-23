const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '../js/global_functions.js'), 'utf8');

test('shared progress builder preserves existing assessment data and removes legacy contact info', () => {
  const existing = {
    id: 'old', marketInfo: { marketName: 'Saved' }, scores: { old: '1' },
    progress: { completed: true, completedAt: 'previous' }, created: 'original',
    synced: true, version: 1, mediaAttachments: [{ filename: 'file' }],
    notes: 'notes', questionNotes: { old: 'note' }, contactInfo: { email: 'legacy' }, extra: 'preserved'
  };
  const context = vm.createContext({ window: { getCurrentMarketInfo: () => { throw new Error('must not fetch market'); } } });
  vm.runInContext(source, context);
  const result = context.buildAssessmentProgress(existing, {
    id: 'assessment', scores: { updated: 'na' }, questionNotes: { updated: 'note' },
    currentQuestionIndex: 2, totalQuestions: 5, getCurrentQuestionVersion: () => 3
  });
  assert.equal(result.id, 'assessment');
  assert.equal(result.marketInfo.marketName, 'Saved');
  assert.deepEqual(result.scores, { updated: 'na' });
  assert.deepEqual(result.questionNotes, { updated: 'note' });
  assert.equal(result.progress.completed, true);
  assert.equal(result.progress.completedAt, 'previous');
  assert.equal(result.progress.currentQuestionIndex, 2);
  assert.equal(result.progress.totalQuestions, 5);
  assert.ok(!Number.isNaN(Date.parse(result.progress.lastUpdated)));
  assert.equal(result.created, 'original');
  assert.equal(result.synced, false);
  assert.equal(result.version, 3);
  assert.equal(result.notes, 'notes');
  assert.equal(result.mediaAttachments[0].filename, 'file');
  assert.equal(result.extra, 'preserved');
  assert.equal('contactInfo' in result, false);
});

test('new progress uses the current offline market and defaults', () => {
  const context = vm.createContext({ window: { getCurrentMarketInfo: () => ({ marketName: 'Offline' }) } });
  vm.runInContext(source, context);
  const result = context.buildAssessmentProgress(null, {
    id: 'assessment', scores: {}, questionNotes: {}, currentQuestionIndex: 0,
    totalQuestions: 5, getCurrentQuestionVersion: () => 2
  });
  assert.equal(result.marketInfo.marketName, 'Offline');
  assert.ok(!Number.isNaN(Date.parse(result.created)));
  assert.equal(result.notes, '');
  assert.equal(result.mediaAttachments.length, 0);
  assert.equal(result.synced, false);
  assert.equal(result.version, 2);
});
