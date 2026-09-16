const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rx = require('rxjs');
function load(file, dependencies = {}) {
  const source = fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true } }).outputText,
    { exports, console, require: name => dependencies[name] ?? (name === 'rxjs' ? rx : name === '@angular/core' ? { Component: () => klass => klass, Injectable: () => klass => klass } : {}) });
  return exports;
}
const validators = load('src/app/components/nutrition/custom-foods/food-validation.ts');
const { foodErrors, foodNumber, foodImageError } = validators;
const { CustomFoodsComponent } = load('src/app/components/nutrition/custom-foods/custom-foods.component.ts', { './food-validation': validators });
const { NutritionService } = load('src/app/service/nutrition.service.ts', { '../../environments/environment': { environment: { baseApiUrl: 'https://api.test' } } });
const valid = { foodName: ' Test food ', servingDescription: 'Grams', servingSize: '100', calories: '12.5', protein: '0', carbs: '0.25', fat: '0.3', fiber: '', sugar: '', polyols: '', saturated: '', polyunsaturated: '', monounsaturated: '', salt: '' };
function service(overrides = {}) { return { getFoods: () => rx.of({ content: [] }), createFood: food => rx.of({ ...food, id: 'new' }), updateFood: (id, food) => rx.of({ ...food, id }), ...overrides }; }
function component(api) { const c = new CustomFoodsComponent(api ?? service()); Object.assign(c, valid); return c; }

test('all required fields reject blank values, including calories and serving description', () => {
  for (const field of ['foodName', 'servingDescription', 'servingSize', 'calories', 'protein', 'carbs', 'fat']) assert.equal(foodErrors({ ...valid, [field]: '  ' })[field], 'FOOD_VALID_REQUIRED');
  assert.equal(Object.keys(foodErrors(valid)).length, 0);
});
test('name uses its trimmed Unicode length', () => {
  assert.equal(Object.keys(foodErrors({ ...valid, foodName: '  ' + '😀'.repeat(100) + '  ' })).length, 0);
  assert.equal(foodErrors({ ...valid, foodName: 'x'.repeat(101) }).foodName, 'FOOD_VALID_NAME_LENGTH');
});
test('valid decimal numbers accept dots, commas, zero and scientific notation', () => {
  for (const [text, expected] of [['1.2345', 1.2345], [' 1,25 ', 1.25], ['.5', .5], ['0', 0], ['1e2', 100]]) assert.equal(foodNumber(text), expected);
});
test('invalid, infinite and partially numeric values are rejected for every numeric field', () => {
  for (const field of validators.foodNumericFields) for (const text of ['abc', '1foo', 'NaN', 'Infinity', '1e999', '0x10', '1.2.3', '1 2']) assert.equal(foodErrors({ ...valid, [field]: text })[field], 'FOOD_VALID_NUMBER');
});
test('required nutrients accept zero; serving size must be strictly positive; optional negatives fail', () => {
  assert.equal(foodErrors({ ...valid, servingSize: '0' }).servingSize, 'FOOD_VALID_POSITIVE');
  for (const field of validators.foodNumericFields.filter(f => f !== 'servingSize')) assert.equal(foodErrors({ ...valid, [field]: '-1' })[field], 'FOOD_VALID_NONNEGATIVE');
});
test('fat subtypes cannot exceed total fat; decimal equality and empty fields work', () => {
  assert.equal(Object.keys(foodErrors({ ...valid, saturated: '0.1', polyunsaturated: '0.2' })).length, 0);
  const errors = foodErrors({ ...valid, saturated: '0.2', polyunsaturated: '0.2' });
  for (const key of ['fat', 'saturated', 'polyunsaturated']) assert.equal(errors[key], 'FOOD_VALID_FAT_SUM');
  assert.equal(foodErrors({ ...valid, fat: '1e308', saturated: '1e308', polyunsaturated: '1e308' }).fat, 'FOOD_VALID_FAT_SUM');
});
test('image validates allowed extensions, MIME types and the inclusive 10 MB limit', () => {
  for (const name of ['a.jpg', 'a.JPEG', 'a.png', 'a.webp']) assert.equal(foodImageError({ name, type: '', size: 10 * 1024 * 1024 }), '');
  assert.equal(foodImageError({ name: 'a.gif', type: 'image/gif', size: 1 }), 'FOOD_VALID_IMAGE_TYPE');
  assert.equal(foodImageError({ name: 'a.png', type: 'text/plain', size: 1 }), 'FOOD_VALID_IMAGE_TYPE');
  assert.equal(foodImageError({ name: 'a.png', type: 'image/png', size: 10 * 1024 * 1024 + 1 }), 'FOOD_VALID_IMAGE_SIZE');
});
test('Add sends trimmed names, manual decimal calories, and null for empty optional values', async () => {
  let payload;
  const c = component(service({ createFood: food => { payload = food; return rx.of({ ...food, id: 'new' }); } }));
  await c.saveFood();
  assert.equal(payload.name, 'Test food');
  assert.equal(payload.calories, 12.5);
  for (const field of ['fiber', 'sugar', 'polyols', 'saturatedFat', 'polyunsaturatedFat', 'monounsaturatedFat', 'sodium']) assert.equal(payload[field], null);
});
test('Edit preserves decimals and zero, allows clearing optional values, and rejects invalid inputs', async () => {
  let payload;
  const c = component(service({ updateFood: (id, food) => { payload = food; return rx.of({ ...food, id }); } }));
  c.editFood({ id: 'edit', name: 'Food', calories: 2.25, protein: 0, carbs: 0, fat: 1, fiber: 0, polyols: 2.5, servingSize: 50, servingUnit: 'Grams' });
  assert.equal(c.calories, '2.25'); assert.equal(c.fiber, '0'); assert.equal(c.polyols, '2.5');
  c.sugar = 'invalid'; assert.equal(c.canSave, false);
  c.sugar = ''; c.fiber = ''; await c.saveFood();
  assert.equal(payload.fiber, null); assert.equal(payload.polyols, 2.5); assert.equal(payload.calories, 2.25);
});
test('double click sends exactly one save request and disables the form while pending', async () => {
  const pending = new rx.Subject(); let calls = 0;
  const c = component(service({ createFood: () => { calls++; return pending; } }));
  const first = c.saveFood(); await c.saveFood(); assert.equal(calls, 1); assert.equal(c.canSave, false);
  pending.next({ id: 'new' }); pending.complete(); await first; assert.equal(c.isSaving, false);
});
test('retry after failed image upload updates the created food instead of creating a duplicate', async () => {
  let creates = 0, updates = 0;
  const c = component(service({ createFood: food => { creates++; return rx.of({ ...food, id: 'new' }); }, updateFood: (id, food) => { updates++; assert.equal(id, 'new'); return rx.of({ ...food, id }); }, uploadFoodImage: () => rx.throwError(() => new Error('upload failed')) }));
  c.selectedImageFile = { name: 'a.png', type: 'image/png', size: 100 };
  await c.saveFood(); assert.equal(c.fieldError('image'), 'FOOD_VALID_IMAGE_FAILED'); assert.equal(c.isSaving, false);
  c.removeSelectedImage(); await c.saveFood(); assert.equal(creates, 1); assert.equal(updates, 1);
});
test('food service maps API field names and keeps optional null values in both directions', async () => {
  let body;
  const api = new NutritionService({ post: (url, payload) => { body = payload; return rx.of({ ...payload, id: 'new' }); } });
  const result = await rx.firstValueFrom(api.createFood({ name: 'Food', calories: 1.25, protein: 0, carbs: .5, fat: 1, fiber: null, polyols: null, servingSize: 100, servingUnit: 'Grams' }));
  assert.equal(body.energy, 1.25); assert.equal(body.carbohydrates, .5); assert.equal(body.servingDescription, 'Grams'); assert.equal(body.fiber, null); assert.equal(body.polyols, null);
  assert.equal(result.calories, 1.25); assert.equal(result.carbs, .5); assert.equal(result.servingUnit, 'Grams');
});
