// CC-11: what the client did on a day, face to what was planned (backlog-programmes.md, calendar lot C, L2-L3).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, console, require: () => ({}) });
  return exports;
}

const d = load('src/app/shared/models/calendar-day.ts');
const sets = (...reps) => reps.map((r, i) => ({ setNumber: i + 1, reps: r, weight: 60 }));

test('workout: sets done, missed, skipped exercise, by id, number or position', () => {
  const day = {
    workoutSessions: [{ exercises: [
      { id: 'a', name: 'Tractions', sets: sets(8, 8, 8) },
      { id: 'b', name: 'Rowing', sets: sets(10, 10) },
      { name: 'Curl', sets: sets(12, 12) },
      { id: 'd', name: 'Gainage', sets: sets(1) },
      { id: 'e', name: 'Vélo', type: 'CARDIO', sets: [{ setNumber: 1, duration: 20 }] },
    ] }],
    clientExerciseLogs: [
      { exerciseId: 'a', sets: [
        { setNumber: 1, reps: 8, weight: 62, status: 'COMPLETED' },
        { setNumber: 2, reps: 8, weight: 62, status: 'COMPLETED' },
        { setNumber: 3, reps: 7, weight: 62, status: 'COMPLETED' },
      ] },
      { exerciseId: 'b', sets: [{ setNumber: 1, reps: 10, weight: 60, status: 'COMPLETED' }, { setNumber: 2, status: 'MISSED' }] },
      { displayNumber: '3', skipped: true, note: 'épaule' },
    ],
    workoutElapsedSeconds: 2700,
    overallWorkoutNote: ' bonne séance ',
  };
  const report = d.workoutReport(day);
  assert.equal(report.exercises.map((e) => e.state).join(), 'DONE,PARTIAL,MISSED,PENDING,PENDING');
  assert.equal(report.exercises[0].done[2].reps, 7, 'what the client did, not what was planned');
  assert.equal(report.exercises[0].done[0].weight, 62);
  assert.equal(report.exercises[1].missedSets, 1);
  assert.equal(report.exercises[2].note, 'épaule');
  assert.equal(report.exercises[4].cardio, true);
  assert.equal(report.doneExercises, 1);
  assert.equal(report.loggedExercises, 3);
  assert.equal(report.minutes, 45);
  assert.equal(report.note, 'bonne séance');
  assert.equal(report.markedDone, false);
  assert.equal(d.workoutReport({ clientCompletionMode: 'ALREADY_COMPLETED' }).markedDone, true);
  assert.equal(d.workoutReport(null).exercises.length, 0);
});

test('nutrition: each meal with its report, the feelings, no calories invented', () => {
  const report = d.nutritionReport({
    meals: [{ id: 'm1', name: 'Petit-déjeuner', foods: [{ name: 'Avoine' }] }, { id: 'm2', name: 'Déjeuner', foods: [{ name: 'Riz' }] }, { _id: 'm3', name: 'Dîner', foods: [{ name: 'Soupe' }] }],
    clientMealLogs: [{ mealId: 'm1', status: 'AS_PLANNED' }, { mealId: 'm3', status: 'skipped', note: 'resto' }],
    hunger: '4', energy: 'bonne', overallNote: 'ok',
  });
  assert.equal(report.meals.map((m) => m.state || '-').join(), 'AS_PLANNED,-,SKIPPED');
  assert.equal(report.meals[2].note, 'resto');
  assert.equal(report.reported, 2);
  assert.equal(report.hunger, '4');
  assert.equal(report.digestion, '');
  assert.equal(report.note, 'ok');
});

test('tasks and check-ins: their color', () => {
  assert.equal(d.tasksTone([]), null);
  assert.equal(d.tasksTone([{ status: 'DONE' }, { status: 'DONE' }]), 'done');
  assert.equal(d.tasksTone([{ status: 'DONE' }, { status: 'MISSED' }]), 'partial');
  assert.equal(d.tasksTone([{ status: 'MISSED' }]), 'missed');
  assert.equal(d.tasksTone([{ status: 'DONE' }, { status: 'UPCOMING' }]), 'planned');
  assert.equal(d.checkInTone('RECEIVED'), 'done');
  assert.equal(d.checkInTone('LATE'), 'missed');
  assert.equal(d.checkInTone('UPCOMING'), 'planned');
});

test('exercise lines: A1/A2 for a superset, a letter alone otherwise, sets and rest', () => {
  const lines = d.exerciseLines({ workoutSessions: [{ exercises: [
    { name: 'Développé incliné', supersetGroupId: 'g1', sets: [{ reps: 5, weight: 60, restMin: 2 }, { reps: 5, weight: 60 }] },
    { name: 'Tractions lestées', supersetGroupId: 'g1', sets: [{ reps: 5 }] },
    { name: 'Arnold press', sets: [{ reps: 8, restSec: 90 }] },
    { name: 'Front squat', supersetGroupId: 'g2', sets: [] },
    { name: 'Hip thrust', supersetGroupId: 'g2', sets: [] },
    { name: 'Vélo', type: 'CARDIO', supersetGroupId: 'g3', sets: [{ duration: 20 }] },
  ] }] });
  assert.equal(lines.map((l) => l.label).join(), 'A1,A2,B,C1,C2,D', 'a superset of one exercise is a letter alone');
  assert.equal(lines[0].restSeconds, 120);
  assert.equal(lines[2].restSeconds, 90);
  assert.equal(lines[1].restSeconds, null);
  assert.equal(lines[0].sets.length, 2);
  assert.equal(lines[5].cardio, true);
  assert.equal(lines[5].sets[0].duration, 20);
});

test('meal lines: foods with their quantity, the calories target of a meal', () => {
  const lines = d.mealLines({ meals: [
    { name: 'Petit-déjeuner', foods: [{ name: 'Avoine', quantity: 80, unit: 'g' }, { name: 'Banane', quantity: 1 }, { name: '' }] },
    { name: 'Collation', mealTargets: { calories: 349.6 } },
  ] });
  assert.equal(lines[0].foods.join(' | '), 'Avoine 80 g | Banane 1');
  assert.equal(lines[0].kcal, null);
  assert.equal(lines[1].kcal, 350);
});

test('exercise lines: timed exercise (measure TIME), superset links', () => {
  const lines = d.exerciseLines({ workoutSessions: [{ exercises: [
    { name: 'Squat', supersetGroupId: 'g1', groupType: 'CIRCUIT', measure: 'TIME', sets: [{ reps: 10, durationSec: 30 }] },
    { name: 'Pompes', supersetGroupId: 'g1', sets: [{ reps: 12 }] },
    { name: 'Gainage', supersetGroupId: 'g1', measure: 'time', sets: [{ durationSec: 45 }] },
    { name: 'Curl', sets: [{ reps: 8 }] },
  ] }] });
  assert.deepEqual(JSON.parse(JSON.stringify(lines.map((l) => [l.label, l.link, l.groupKind, l.timed]))), [
    ['A1', 'start', 'CIRCUIT', true],
    ['A2', 'middle', null, false],
    ['A3', 'end', null, true],
    ['B', null, null, false],
  ]);
  assert.equal(lines[0].sets[0].seconds, 30);
  const report = d.workoutReport({ workoutSessions: [{ exercises: [{ id: 'a', name: 'Gainage', measure: 'TIME', sets: [{ durationSec: 45 }] }] }] });
  assert.equal(report.exercises[0].timed, true);
});

// 2026-11-23 audit « repas vides »: an empty meal (no food, no macros) is never shown nor counted, whatever its name.
test('planned meals: an empty meal is left out, whatever its name; a reported one stays', () => {
  const day = {
    meals: [
      { id: 'a', name: 'Petit-déjeuner', foods: [{ name: 'Avoine', quantity: 80, unit: 'g' }], mealTargets: { calories: 300 } },
      { id: 'b', name: 'Déjeuner', foods: [], mealTargets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 } },
      { id: 'c', name: 'Meal 3', foods: [], mealTargets: { calories: 450, proteinG: 30, carbsG: 50, fatG: 12 } },
      { id: 'd', name: 'New Meal', foods: [] },
    ],
    clientMealLogs: [{ mealId: 'd', status: 'SKIPPED' }],
  };
  assert.equal(d.mealPlanned(day.meals[1]), false, 'renamed but empty');
  assert.equal(d.mealPlanned(day.meals[2]), true, 'macros per meal');
  assert.deepEqual(d.plannedMeals(day).map((meal) => meal.id), ['a', 'c', 'd']);
  assert.deepEqual(d.mealLines(day).map((line) => line.number), [1, 3, 4], 'each meal keeps its place');
  assert.equal(d.nutritionReport(day).meals.length, d.mealLines(day).length, 'the day panel reads both side by side');
});
