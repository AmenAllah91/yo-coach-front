// PRG-10: the editors' day rule, same cases as the server's ProgramDaysTest (backlog-programmes.md).
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, dependencies = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, console, require: name => dependencies[name] ?? {} });
  return exports;
}

const days = load('src/app/shared/models/program-days.ts');
const workout = load('src/app/shared/models/workout-publication.ts', { './program-days': days });
const nutrition = load('src/app/shared/models/nutrition-publication.ts', { './program-days': days });

const set = reps => ({ reps });
const exercise = (name, ...sets) => ({ name, sets });
const session = (name, ...exercises) => ({ name, exercises });
const workoutDay = (...sessions) => ({ workoutSessions: sessions });
const filled = () => workoutDay(session('Push', exercise('Squat', set(10))));
const empty = () => workoutDay(session('Main Session'));
const rest = () => ({ restDay: true });

const food = quantity => ({ name: 'Oats', quantity, unit: 'g' });
const meal = (name, ...foods) => ({ name, foods });
const mealDay = (...meals) => ({ meals });

test('workout day states', () => {
  assert.equal(days.workoutDayStatus(filled()), 'FILLED');
  assert.equal(days.workoutDayStatus(rest()), 'REST');
  assert.equal(days.workoutDayStatus(empty()), 'EMPTY', 'the default session without exercise is empty');
  assert.equal(days.workoutDayStatus(workoutDay(session('Push', exercise('Squat', set(10))), session('Main Session'))), 'FILLED');
});

test('D2: zero reps or one wrong set among others is an error, as on the server', () => {
  assert.equal(days.workoutDayStatus(workoutDay(session('Push', exercise('Squat', set(0))))), 'INVALID');
  assert.equal(days.workoutDayStatus(workoutDay(session('Push', exercise('Squat', set(10), set(null))))), 'INVALID');
  assert.equal(workout.workoutDayState(workoutDay(session('Push', exercise('Squat', set(10), set(0))))), 'EMPTY',
    'no longer counted as ready (the editor showed 7/7 and the server refused)');
  const messages = workout.workoutDayValidationMessages(workoutDay(session('Push', exercise('Squat', set(10), set(0)))), 0);
  assert.deepEqual([...messages], ['Day 1, exercise 1, set 2: reps must be at least 1.']);
});

test('cardio needs a duration', () => {
  const run = { name: 'Run', type: 'CARDIO', sets: [{ duration: 20 }] };
  assert.equal(days.workoutDayStatus(workoutDay(session('Cardio', run))), 'FILLED');
  run.sets[0].duration = 0;
  assert.equal(days.workoutDayStatus(workoutDay(session('Cardio', run))), 'INVALID');
});

test('a meal without food is empty whatever its name, and never blocks the save', () => {
  for (const name of ['Meal 2', 'New Meal', 'Déjeuner']) {
    assert.equal(days.nutritionMealStatus(meal(name)), 'EMPTY');
    assert.equal(nutrition.nutritionMealState(meal(name)), 'EMPTY_PLACEHOLDER');
    assert.equal(nutrition.nutritionMealValidationMessages(meal(name), 2).length, 0);
  }
  assert.equal(days.nutritionDayStatus(mealDay(meal('Breakfast', food(80)), meal('Déjeuner'))), 'FILLED');
  assert.equal(nutrition.nutritionDayValidationMessages(mealDay(meal('Breakfast', food(80)), meal('New Meal'))).length, 0);
});

test('nutrition day states', () => {
  assert.equal(days.nutritionDayStatus(mealDay(meal('Meal 1'))), 'EMPTY');
  assert.equal(days.nutritionDayStatus(mealDay(meal('Breakfast', food(80)), meal('Lunch', food(0)))), 'INVALID');
  assert.equal(days.nutritionDayStatus({ cheatMeal: true, meals: [] }), 'REST');
  assert.equal(days.nutritionMealStatus({ name: 'Recipe', draft: true, foods: [food(80)] }), 'INVALID');
  assert.equal(nutrition.nutritionDayState({ cheatMeal: true, meals: [] }), 'CHEAT');
});

test('macro plans use their targets', () => {
  const targets = (proteinG, carbsG, fatG, calories) => ({ proteinG, carbsG, fatG, calories });
  assert.equal(days.nutritionDayStatus({ meals: [], dayTargets: targets(150, 200, 60, 1900) }, 'TOTAL_FOR_DAY'), 'FILLED');
  assert.equal(days.nutritionDayStatus({ meals: [], dayTargets: targets(150, null, 60, 1900) }, 'TOTAL_FOR_DAY'), 'INVALID');
  assert.equal(days.nutritionDayStatus({ meals: [], dayTargets: targets(0, 0, null, 0) }, 'TOTAL_FOR_DAY'), 'EMPTY');
  assert.equal(days.nutritionDayStatus(mealDay({ name: 'Meal 1', foods: [], mealTargets: targets(30, 40, 10, 360) }, meal('Meal 2')), 'EACH_MEAL'), 'FILLED');
  assert.equal(nutrition.nutritionDayState({ meals: [], dayTargets: targets(150, 200, 60, 1900) }, 'TOTAL_FOR_DAY'), 'READY');
});

test('a week and a half followed by empty days has no gap', () => {
  const list = [];
  for (let i = 0; i < 28; i++) list.push(i < 10 ? (i === 6 ? rest() : filled()) : empty());
  const summary = days.workoutSummary(list);
  assert.equal(summary.totalDays, 28);
  assert.equal(summary.lastNonEmpty, 10);
  assert.equal(summary.readyDays, 10);
  assert.deepEqual([...summary.gaps], []);
});

test('empty days before the last filled one are gaps; an invalid day is reported apart', () => {
  const summary = days.workoutSummary([empty(), filled(), workoutDay(session('Push', exercise('Squat', set(0)))), empty(), filled()]);
  assert.equal(summary.lastNonEmpty, 5);
  assert.deepEqual([...summary.gaps], [1, 4]);
  assert.deepEqual([...summary.invalidDays], [3]);

  const nutritionSummary = days.nutritionSummary([mealDay(meal('Breakfast', food(80))), { cheatMeal: true, meals: [] },
    mealDay(meal('Meal 1')), mealDay(meal('Lunch', food(150)))]);
  assert.deepEqual([...nutritionSummary.gaps], [3]);
});

test('the server refusal is recognised', () => {
  const refusal = { error: { code: 'PROGRAM_GAP', error: 'Day 4 is empty: fill it or mark it as a rest day.', days: [4] } };
  assert.deepEqual([...days.programDaysError(refusal).days], [4]);
  assert.equal(days.programDaysError({ error: { error: 'Other' } }), null);
});

test('PRG-13: the first thing to fix names the day, the exercise or meal, and the set or food', () => {
  const issue = days.firstWorkoutIssue([filled(), workoutDay(session('Push', exercise('Squat', set(10), set(0))))]);
  assert.equal(issue.key, 'PROGRAM_ISSUE_SET_REPS');
  assert.deepEqual({ ...issue.params }, { day: 2, exercise: 1, set: 2 });
  assert.equal(days.firstWorkoutIssue([workoutDay(session('', exercise('Squat', set(10))))]).key, 'PROGRAM_ISSUE_SESSION_NAME');
  assert.equal(days.firstWorkoutIssue([filled(), empty(), rest()]), null, 'empty days are not errors');

  const nutritionIssue = days.firstNutritionIssue([mealDay(meal('Breakfast', food(80)), meal('Lunch', food(80), { name: 'Rice', quantity: 0, unit: 'g' }))]);
  assert.equal(nutritionIssue.key, 'PROGRAM_ISSUE_FOOD_QUANTITY');
  assert.deepEqual({ ...nutritionIssue.params }, { day: 1, meal: 2, food: 2 });
  assert.equal(days.firstNutritionIssue([mealDay(meal('Déjeuner'))]), null, 'an empty renamed meal is not an error');
  assert.equal(days.firstNutritionIssue([{ meals: [], dayTargets: { proteinG: 150, carbsG: null, fatG: 60, calories: 1900 } }], 'TOTAL_FOR_DAY').key,
    'PROGRAM_ISSUE_DAY_TARGETS');
});
