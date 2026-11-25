// A « modified » meal counts for the part the client ate (¼, ½, ¾, all), not 100 % of the plan.
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

const u = load('src/app/components/clients/shared/client-plan-utils.ts');
const meal = (id, calories, proteinG, carbsG, fatG) => ({ id, name: id, mealTargets: { calories, proteinG, carbsG, fatG } });

test('consumed: a modified meal times its part, an older report (no part) counts in full', () => {
  const day = {
    meals: [meal('a', 400, 40, 40, 10), meal('b', 800, 60, 80, 20), meal('c', 600, 30, 60, 20), meal('d', 500, 20, 50, 20)],
    clientMealLogs: [
      { mealId: 'a', status: 'AS_PLANNED' },
      { mealId: 'b', status: 'MODIFIED', portion: 0.5 },
      { mealId: 'c', status: 'MODIFIED' },
      { mealId: 'd', status: 'SKIPPED', portion: 0.25 },
    ],
  };
  const eaten = u.consumedTotals(day);
  assert.equal(eaten.calories, 400 + 400 + 600);
  assert.equal(eaten.protein, 40 + 30 + 30);
  assert.equal(eaten.fat, 10 + 10 + 20);
});

test('part: read only on a modified meal, a wrong value is the whole meal', () => {
  const day = { meals: [meal('a', 100, 0, 0, 0)], clientMealLogs: [{ mealId: 'a', status: 'MODIFIED', portion: 0.75 }] };
  assert.equal(u.mealPortion(day, day.meals[0]), 0.75);
  assert.equal(u.portionValue(3), 1);
  assert.equal(u.portionValue(0), 1);
  assert.equal(u.portionValue(null), 1);
  assert.equal(u.portionValue('0.25'), 0.25);
  assert.deepEqual([0.25, 0.5, 0.75, 1].map(u.portionLabel), ['¼', '½', '¾', '']);
});

test('a day with only macros (no meal): nothing consumed', () => {
  const day = { meals: [], dayTargets: { calories: 2000, proteinG: 150, carbsG: 220, fatG: 60 } };
  assert.equal(u.consumedTotals(day).calories, 0);
  assert.equal(u.targetTotals(day).calories, 2000);
});
