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
const p = load('src/app/shared/models/workout-player.ts');
const sets = (n, rest, status = 'PENDING') => Array.from({ length: n }, () => ({ status, restMin: 0, restSec: rest }));

// Squat (3 séries, repos 60 s), superset Pompes + Tirage (2 tours, 45 s), circuit Gainage + Fentes (2 tours, 30 s).
const workout = () => [
  { grouped: false, circuit: false, restSec: null, exercises: [{ sets: sets(3, 60) }] },
  { grouped: true, circuit: false, restSec: 45, exercises: [{ sets: sets(2, 45) }, { sets: sets(2, 45) }] },
  { grouped: true, circuit: true, restSec: 30, exercises: [{ sets: sets(2, 0) }, { sets: sets(2, 30) }] },
];

test('order: sets one after the other, supersets and circuits round by round', () => {
  const steps = p.buildPlayerSteps(workout());
  assert.equal(steps.map(s => `${s.group}.${s.exercise}.${s.set}`).join(' '),
    '0.0.0 0.0.1 0.0.2 1.0.0 1.1.0 1.0.1 1.1.1 2.0.0 2.1.0 2.0.1 2.1.1');
});

test('rest: after each set alone, only at the end of the round in a group', () => {
  const groups = workout();
  const steps = p.buildPlayerSteps(groups);
  assert.equal(p.playerRestAfter(groups, steps[0], steps[1]), 60);
  assert.equal(p.playerRestAfter(groups, steps[2], steps[3]), 60);
  assert.equal(p.playerRestAfter(groups, steps[3], steps[4]), 0);
  assert.equal(p.playerRestAfter(groups, steps[4], steps[5]), 45);
  assert.equal(p.playerRestAfter(groups, steps[7], steps[8]), 0);
  assert.equal(p.playerRestAfter(groups, steps[8], steps[9]), 30);
});

test('old sessions without a group rest use the rest of the set; a circuit without any falls back on 60 s', () => {
  const groups = [
    { grouped: true, circuit: false, restSec: null, exercises: [{ sets: sets(2, 90) }, { sets: sets(2, 90) }] },
    { grouped: true, circuit: true, restSec: null, exercises: [{ sets: sets(2, 0) }, { sets: sets(2, 0) }] },
  ];
  const steps = p.buildPlayerSteps(groups);
  assert.equal(p.playerRestAfter(groups, steps[1], steps[2]), 90);
  assert.equal(p.playerRestAfter(groups, steps[5], steps[6]), 60);
});

test('next set: the first pending one after, else one left behind, else none', () => {
  const groups = workout();
  const steps = p.buildPlayerSteps(groups);
  assert.equal(p.nextPendingStep(groups, steps, 0), 1);
  groups.forEach(g => g.exercises.forEach(e => e.sets.forEach(s => (s.status = 'COMPLETED'))));
  groups[0].exercises[0].sets[1].status = 'PENDING';
  assert.equal(p.nextPendingStep(groups, steps, 5), 1);
  groups[0].exercises[0].sets[1].status = 'MISSED';
  assert.equal(p.nextPendingStep(groups, steps, 5), null);
});

test('warm-up: only the pending sets of the warm-up groups are skipped', () => {
  const groups = [
    { warmup: true, grouped: false, circuit: false, restSec: null, exercises: [{ sets: [{ status: 'COMPLETED' }, { status: 'PENDING' }] }] },
    { warmup: true, grouped: false, circuit: false, restSec: null, exercises: [{ sets: sets(1, 0) }] },
    { grouped: false, circuit: false, restSec: null, exercises: [{ sets: sets(2, 60) }] },
  ];
  const steps = p.buildPlayerSteps(groups);
  assert.equal(p.pendingWarmupSteps(groups, steps).map(s => `${s.group}.${s.exercise}.${s.set}`).join(' '), '0.0.1 1.0.0');
});

test('warm-up block: the warm-up exercises at the top of the workout', () => {
  const g = load('src/app/shared/models/exercise-groups.ts');
  const warm = { sets: [{ type: 'WARM_UP' }, { type: 'warm-up' }] };
  const regular = { sets: [{ type: 'WARM_UP' }, { type: 'REGULAR' }] };
  assert.equal(g.isWarmupExercise(warm), true);
  assert.equal(g.isWarmupExercise(regular), false);
  assert.equal(g.isWarmupExercise({ sets: [] }), false);
  assert.equal(g.isWarmupExercise({ ...warm, supersetGroupId: 'g1' }), false);
  assert.equal(g.warmupCount([warm, warm, regular, warm]), 2);
  assert.equal(g.warmupCount([regular, warm]), 0);
});

test('coach activity: warm-up sets are out of the set totals, a skipped warm-up is flagged', () => {
  const source = fs.readFileSync(path.join(__dirname, '../src/app/components/clients/profil-client/client-activity/client-activity.ts'), 'utf8');
  const groups = load('src/app/shared/models/exercise-groups.ts');
  const activity = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports: activity, require: name => (name.endsWith('exercise-groups') ? groups : {}) });
  const day = (logs, sets) => ({
    startDate: '2026-11-01',
    workoutDays: [{
      id: 'd1', dayNumber: 1, status: 'COMPLETED', clientExerciseLogs: logs,
      workoutSessions: [{ exercises: [
        { id: 'w', name: 'Bike', sets: [{ setNumber: 1, type: 'WARM_UP' }, { setNumber: 2, type: 'WARM_UP' }] },
        { id: 's', name: 'Squat', sets },
      ] }],
    }],
  });
  const regular = [{ setNumber: 1, type: 'REGULAR' }, { setNumber: 2, type: 'REGULAR' }];
  const done = n => Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, status: 'COMPLETED' }));
  const missed = n => Array.from({ length: n }, (_, i) => ({ setNumber: i + 1, status: 'MISSED' }));

  const [skipped] = activity.buildWorkoutActivities([day([{ exerciseId: 'w', sets: missed(2) }, { exerciseId: 's', sets: done(2) }], regular)]);
  assert.deepEqual([skipped.completedSets, skipped.missedSets, skipped.totalSets, skipped.warmupSkipped], [2, 0, 2, true]);

  const [made] = activity.buildWorkoutActivities([day([{ exerciseId: 'w', sets: done(2) }, { exerciseId: 's', sets: done(2) }], regular)]);
  assert.deepEqual([made.completedSets, made.totalSets, made.warmupSkipped], [2, 2, false]);

  // Une séance faite seulement d'échauffements garde ses totaux.
  const [only] = activity.buildWorkoutActivities([day([{ exerciseId: 'w', sets: done(2) }, { exerciseId: 's', sets: done(1) }], [{ setNumber: 1, type: 'WARM_UP' }])]);
  assert.deepEqual([only.completedSets, only.totalSets, only.warmupSkipped], [3, 3, false]);
});
