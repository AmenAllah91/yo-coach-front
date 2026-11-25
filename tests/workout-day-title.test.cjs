// Audit workouts 2026-11-23: M18 (titles of the days, duration cap), M14 (timer), M16 (draft kept on this device).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: () => ({}), JSON, Math, Number, String, Date });
  return exports;
}
const titles = load('src/app/shared/models/workout-day-title.ts');
const drafts = load('src/app/components/clients/client-workouts/workout-local-draft.ts');

test('M18: « Day N » follows the place of the day, a title of the coach stays', () => {
  const days = [{ title: 'Day 1' }, { title: 'Push' }, { title: 'Jour 7' }, { title: '' }, { title: 'Leg Day' }];
  days.forEach((day, index) => titles.renumberDayTitle(day, index + 6));
  assert.deepEqual(days.map(day => day.title), ['Day 7', 'Push', 'Day 2', 'Day 3', 'Leg Day']);
  assert.equal(days[0].name, 'Day 7');
  assert.equal(days[1].name, undefined);
});

test('M18: the cap never removes weeks of a longer program', () => {
  assert.equal(titles.clampProgramWeeks(20, 28, 12), 12);
  assert.equal(titles.clampProgramWeeks(0, 0, 12), 1);
  // A 20-week program (140 days) keeps 20 weeks when its duration is asked again.
  assert.equal(titles.clampProgramWeeks(20, 140, 12), 20);
  assert.equal(titles.clampProgramWeeks(30, 140, 12), 20);
  assert.equal(titles.weeksOfDays(15), 3);
  assert.equal(titles.weeksOfDays(0), 1);
});

test('M14: the timer counts from the real clock', () => {
  // 60 min with the screen locked: 3600 s, not the few ticks the sleeping tab got.
  assert.equal(drafts.elapsedSince(120, 1_000_000, 1_000_000 + 3_600_000), 3720);
  assert.equal(drafts.elapsedSince(5, 2_000, 1_000), 5);
});

function memoryStore() {
  const data = new Map();
  return { getItem: k => (data.has(k) ? data.get(k) : null), setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k), data };
}

test('M16: a draft kept on this device, erased only when that copy reached the server', () => {
  const store = memoryStore();
  const now = Date.now();
  const first = { planId: 'P', dayKey: 'D', savedAt: now - 10, payload: { status: 'IN_PROGRESS', workoutElapsedSeconds: 60 } };
  assert.equal(drafts.writeLocalDraft(store, first), true);
  const second = { ...first, savedAt: now, payload: { ...first.payload, workoutElapsedSeconds: 90 } };
  drafts.writeLocalDraft(store, second);
  drafts.clearLocalDraft(store, 'P', 'D', first.savedAt); // the first copy arrived: the newer one stays
  assert.equal(drafts.readLocalDraft(store, 'P', 'D', now).payload.workoutElapsedSeconds, 90);
  drafts.clearLocalDraft(store, 'P', 'D', second.savedAt);
  assert.equal(drafts.readLocalDraft(store, 'P', 'D', now), null);
});

test('M16: storage refused or broken: nothing thrown', () => {
  const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); }, removeItem: () => { throw new Error('x'); } };
  assert.equal(drafts.writeLocalDraft(broken, { planId: 'P', dayKey: 'D', savedAt: 1, payload: {} }), false);
  assert.equal(drafts.readLocalDraft(broken, 'P', 'D'), null);
  drafts.clearLocalDraft(broken, 'P', 'D');
  const store = memoryStore();
  store.setItem(drafts.localDraftKey('P', 'D'), '{not json');
  assert.equal(drafts.readLocalDraft(store, 'P', 'D'), null);
});

test('M16: sent again only when the server does not have it', () => {
  const logs = [{ exerciseId: 'e', sets: [{ status: 'COMPLETED', reps: 8 }] }];
  const kept = { planId: 'P', dayKey: 'D', savedAt: 1, payload: { status: 'IN_PROGRESS', workoutElapsedSeconds: 300, overallWorkoutNote: '', clientExerciseLogs: logs } };
  assert.equal(drafts.localDraftNeeded(kept, { status: 'PENDING', workoutElapsedSeconds: 0 }), true);
  assert.equal(drafts.localDraftNeeded(kept, { status: 'IN_PROGRESS', workoutElapsedSeconds: 300, overallWorkoutNote: '', clientExerciseLogs: logs }), false);
  // Finished on the server, or done further on another device: the server's version wins.
  assert.equal(drafts.localDraftNeeded(kept, { status: 'COMPLETED', workoutElapsedSeconds: 0 }), false);
  assert.equal(drafts.localDraftNeeded(kept, { status: 'IN_PROGRESS', workoutElapsedSeconds: 900 }), false);
  assert.equal(drafts.isNetworkError({ status: 0 }), true);
  assert.equal(drafts.isNetworkError({ status: 403 }), false);
});
