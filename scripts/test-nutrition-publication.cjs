const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { Subject } = require('rxjs');

function load(relative, imports = {}) {
  const source = fs.readFileSync(path.join(__dirname, '..', relative), 'utf8');
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  new Function('require', 'exports', code)(name => imports[name] || require(name), exports);
  return exports;
}
const rules = load('src/app/shared/models/nutrition-publication.ts');
const { NutritionDraftState } = load('src/app/components/nutrition/nutrition-draft-state.ts', {
  '@shared/models/nutrition-publication': rules,
});
const placeholder = () => ({ name: 'Meal 1', mealTime: '08:00', foods: [], mealTargets: { calories: 0, proteinG: 0, carbsG: 0, fatG: 0 } });
const valid = () => ({ ...placeholder(), foods: [{ foodRef: { id: 'rice' }, quantity: 100, unit: 'g' }] });
const day = () => ({ cheatMeal: false, meals: [valid(), placeholder(), placeholder()] });

test('placeholders are ignored; started foods and draft recipes block readiness', () => {
  assert.equal(rules.nutritionDayStatus({ meals: [placeholder()] }, null), 'Empty');
  assert.equal(rules.nutritionDayStatus(day(), null), 'Ready');
  const incomplete = day(); incomplete.meals[0].foods[0].quantity = 0;
  assert.equal(rules.nutritionMealStatus(incomplete.meals[0], null), 'Incomplete');
  assert.equal(rules.nutritionDayStatus(incomplete, null), 'Empty');
  incomplete.meals.push(valid());
  assert.equal(rules.nutritionDayStatus(incomplete, null), 'Incomplete');
  incomplete.cheatMeal = true;
  assert.equal(rules.nutritionDayStatus(incomplete, null), 'Cheat meal');
  assert.equal(rules.nutritionMealStatus({ ...valid(), draft: true }, null), 'Incomplete');
});

test('macro modes preserve empty, valid and incomplete targets', () => {
  assert.equal(rules.nutritionMealStatus(placeholder(), 'EACH_MEAL'), 'Empty');
  const meal = { ...placeholder(), mealTargets: { proteinG: 10, carbsG: 20, fatG: 5, calories: 165 } };
  assert.equal(rules.nutritionDayStatus({ meals: [meal, placeholder()] }, 'EACH_MEAL'), 'Ready');
  meal.mealTargets.proteinG = -1;
  assert.equal(rules.nutritionMealStatus(meal, 'EACH_MEAL'), 'Incomplete');
  assert.equal(rules.nutritionDayStatus({ meals: [meal] }, 'EACH_MEAL'), 'Empty');
});

test('food quantities and nutrition must be finite and non-negative', () => {
  for (const quantity of [undefined, null, 0, -1, NaN, Infinity]) {
    const meal = valid(); meal.foods[0].quantity = quantity;
    assert.equal(rules.nutritionMealStatus(meal, null), 'Incomplete');
  }
  for (const field of ['calories', 'protein', 'carbohydrates', 'carbs', 'fat']) {
    const meal = valid(); meal.foods[0][field] = -1;
    assert.equal(rules.nutritionMealStatus(meal, null), 'Incomplete');
  }
  for (const field of ['energy', 'calories', 'protein', 'carbohydrates', 'fat']) {
    const meal = valid(); meal.foods[0].foodRef[field] = -1;
    assert.equal(rules.nutritionMealStatus(meal, null), 'Incomplete');
  }
  const meal = valid();
  meal.foods = [{ manual: true, name: 'Water', quantity: 0.5, unit: 'l', calories: 0, protein: 0, carbs: 0, fat: 0 }];
  assert.equal(rules.nutritionMealStatus(meal, null), 'Ready');
  meal.foods.push({ manual: true, name: 'Rice', unit: 'g' });
  assert.equal(rules.nutritionMealStatus(meal, null), 'Incomplete');
});

test('recipes need valid ingredients, name and servings', () => {
  assert.equal(rules.nutritionMealStatus({ ...placeholder(), template: true }, null), 'Incomplete');
  for (const changes of [{ draft: true }, { name: '' }, { servings: 0 }, { servings: Infinity }, { totalTimeMinutes: -1 }]) {
    assert.equal(rules.nutritionMealStatus({ ...valid(), template: true, ...changes }, null), 'Incomplete');
  }
  assert.equal(rules.nutritionMealStatus({ ...valid(), template: true, servings: 2 }, null), 'Ready');
});

test('create once, keep draft at 7/7, publish explicitly, and restore ID on reopen', () => {
  const response = new Subject(); const requests = [];
  const service = {
    createNutritionPlan: plan => { requests.push(['create', plan]); return response; },
    updateNutritionPlan: plan => { requests.push(['update', plan]); return response; },
  };
  const route = { snapshot: { paramMap: { get: () => null } } };
  global.window = { location: { href: 'http://localhost/nutrition/create-full-plan' }, history: { state: {}, replaceState: () => {} } };
  const state = new NutritionDraftState(service, route, null);
  const plan = { name: 'Draft', mealDays: Array.from({ length: 7 }, day) };
  state.save(plan); state.save(plan);
  assert.equal(requests.length, 1);
  assert.deepEqual(requests[0][1].publishedWeeks, []);
  response.next({ ...requests[0][1], id: 'saved-plan' });
  state.save(plan, 1);
  assert.equal(requests[1][0], 'update');
  assert.equal(requests[1][1].id, 'saved-plan');
  assert.deepEqual(requests[1][1].publishedWeeks, [1]);
  response.next(requests[1][1]);
  const reopened = new NutritionDraftState(service, route, null);
  reopened.load(requests[1][1]);
  assert.equal(reopened.isPublished(1), true);
  assert.equal(reopened.id, 'saved-plan');
});

test('failed publication does not show Published or Saved', () => {
  const response = new Subject();
  const state = new NutritionDraftState({ createNutritionPlan: () => response }, { snapshot: {} }, null);
  state.save({ name: 'Draft', mealDays: Array.from({ length: 7 }, day) }, 1);
  response.error(new Error('offline'));
  assert.equal(state.isPublished(1), false);
  assert.equal(state.savedAt, null);
  assert.equal(state.saving, false);
  assert.ok(state.error);
});
