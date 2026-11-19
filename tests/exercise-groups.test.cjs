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
    { exports, require: () => ({}) });
  return exports;
}
const g = load('src/app/shared/models/exercise-groups.ts');
const set = (reps, weight, extra = {}) => ({ reps: String(reps), weight, restMin: 1, restSec: 0, ...extra });
const ex = (name, group, sets, extra = {}) => ({ id: name, name, supersetGroupId: group, sets, ...extra });

test('groups are read from neighbours with the same id, with labels A/B or 1/2/3', () => {
  const list = [ex('solo', null, [set(8, 80)]), ex('a', 's1', [set(10, 50)]), ex('b', 's1', [set(12, 20)]),
    ex('c1', 'c', [set(15, 0)], { groupType: 'CIRCUIT' }), ex('c2', 'c', [set(10, 0)], { groupType: 'CIRCUIT' })];
  assert.equal(JSON.stringify(g.groupBounds(list, 2)), JSON.stringify({ start: 1, end: 2 }));
  assert.equal(g.isGroupStart(list, 1), true);
  assert.equal(g.isGroupEnd(list, 2), true);
  assert.equal(g.isGroupStart(list, 0), false);
  assert.deepEqual([1, 2, 3, 4].map(i => g.memberLabel(list, i)), ['A', 'B', '1', '2']);
  assert.equal(g.groupTypeOf(list[1]), 'SUPERSET');
  assert.equal(g.groupTypeOf(list[3]), 'CIRCUIT');
});

test('syncGroup gives every exercise the same count, type and rest, and never removes a set', () => {
  const a = ex('a', 's', [set(12, 50), set(10, 60), set(8, 70)]);
  const b = ex('b', 's', [set(12, 20)]);
  b.sets[0].restMin = 1; b.sets[0].restSec = 30;
  g.syncGroup([a, b]);
  assert.equal(b.sets.length, 3);
  assert.equal(a.sets.length, 3);
  assert.equal(b.sets[2].reps, '12');
  assert.equal(a.groupType, 'SUPERSET');
  assert.equal(a.groupRestSec, 90, 'old rest of the last exercise becomes the group rest');
  assert.equal(b.groupRestSec, 90);
});

test('group count adds a copy of the last line or removes the last one', () => {
  const a = ex('a', 'c', [set(15, 0), set(15, 0)]);
  g.setGroupCount([a], 4);
  assert.equal(a.sets.length, 4);
  assert.equal(a.sets[3].setNumber, 4);
  g.setGroupCount([a], 0);
  assert.equal(a.sets.length, 1, 'never below one');
});

test('uniform sets show one line; flatten and progression', () => {
  const a = ex('a', 's', [set(10, 60), set(10, 60), set(10, 60)]);
  assert.equal(g.isUniform(a), true);
  g.progressWeight(a, 2);
  assert.deepEqual(a.sets.map(s => s.weight), [60, 62, 64]);
  assert.equal(g.isUniform(a), false);
  assert.equal(g.setsSummary(a), '10 reps · 60 / 62 / 64 kg');
  g.flattenSets(a);
  assert.equal(g.isUniform(a), true);
  assert.deepEqual(a.sets.map(s => s.weight), [60, 60, 60]);
});

test('time measure uses seconds, reps measure uses reps', () => {
  const a = ex('a', 'c', [set(12, null), set(12, null)], { groupType: 'CIRCUIT' });
  g.changeMeasure(a, 'TIME');
  assert.equal(a.measure, 'TIME');
  assert.equal(g.setValue(a, a.sets[0]), 30);
  g.writeSetValue(a, a.sets[1], 45);
  assert.equal(g.setsSummary(a), '30 / 45 s');
  g.changeMeasure(a, 'REPS');
  assert.equal(a.measure, null);
  assert.equal(g.setValue(a, a.sets[0]), 12, 'reps come back as they were');
});

test('ungroup clears the group and puts the group rest back on each set', () => {
  const a = ex('a', 's', [set(10, 50)], { groupType: 'SUPERSET', groupRestSec: 75 });
  const b = ex('b', 's', [set(10, 20)], { groupType: 'SUPERSET', groupRestSec: 75 });
  g.ungroup([a, b]);
  assert.equal(a.supersetGroupId, null);
  assert.equal(b.groupType, null);
  assert.equal(a.sets[0].restMin, 1);
  assert.equal(a.sets[0].restSec, 15);
});

test('a day with a timed exercise (seconds) is filled, not « to fix »', () => {
  const days = load('src/app/shared/models/program-days.ts');
  const timed = { name: 'Gainage', type: 'STRENGTH', measure: 'TIME', supersetGroupId: 'c', groupType: 'CIRCUIT', sets: [{ reps: '', durationSec: 30, weight: null }] };
  const cardio = { name: 'Vélo', type: 'CARDIO', measure: 'TIME', supersetGroupId: 'c', groupType: 'CIRCUIT', sets: [{ reps: '', durationSec: 45 }] };
  const plain = { name: 'Squat', type: 'STRENGTH', sets: [{ reps: '10', weight: null }] };
  const day = { workoutSessions: [{ name: 'Jour 1', exercises: [timed, cardio, plain] }] };
  assert.equal(days.workoutDayStatus(day), 'FILLED');
  timed.sets[0].durationSec = null;
  assert.equal(days.workoutDayStatus(day), 'INVALID');
  assert.equal(days.workoutDayIssue(day, 1).key, 'PROGRAM_ISSUE_SET_DURATION');
});
