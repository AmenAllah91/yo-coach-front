const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');
const ts = require('typescript');
const { of, Subject, throwError } = require('rxjs');

function load(file, dependencies = {}) {
  const exports = {};
  const source = fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
  vm.runInNewContext(ts.transpileModule(source, {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
      experimentalDecorators: true, useDefineForClassFields: false,
    },
  }).outputText, {
    exports, crypto, console: { log() {} },
    sessionStorage: { getItem: key => key === 'userId' ? 'coach' : null },
    require: name => dependencies[name] ?? (name === '@angular/core' ? { Component: () => klass => klass } : {}),
  });
  return exports;
}

const publication = load('src/app/shared/models/nutrition-publication.ts');
const math = load('src/app/shared/models/nutrition-math.ts');
const draftModule = load('src/app/components/nutrition/nutrition-draft-state.ts', {
  '@shared/models/nutrition-publication': publication,
});
const { NutritionDraftState } = draftModule;
const { CreateFullPlanComponent } = load('src/app/components/nutrition/create-full-plan/create-full-plan.component.ts', {
  '../nutrition-draft-state': draftModule,
  '@shared/models/nutrition-publication': publication,
  '@shared/models/nutrition-math': math,
  '../food-servings/plan-food-serving': { PlanFoodServing: class {} },
});

const clone = value => JSON.parse(JSON.stringify(value));
function setup(url = '/nutrition/create-full-plan?type=each&name=nutrition%20plan&durationWeeks=1') {
  const plans = new Map();
  const calls = [];
  const route = {
    snapshot: {
      paramMap: { get: () => null },
      queryParamMap: { get: key => new URL(router.url, 'http://localhost').searchParams.get(key) },
    },
  };
  const router = {
    url, navigations: [],
    navigate(commands, options) {
      this.navigations.push({ commands, options });
      const next = new URL(this.url, 'http://localhost');
      for (const [key, value] of Object.entries(options.queryParams)) next.searchParams.set(key, value);
      this.url = next.pathname + next.search;
      return Promise.resolve(true);
    },
  };
  const service = {
    createNutritionPlan(plan) {
      calls.push({ method: 'POST', plan: clone(plan) });
      const saved = { ...clone(plan), id: `plan-${plans.size + 1}` };
      plans.set(saved.id, saved);
      return of(clone(saved));
    },
    updateNutritionPlan(plan) {
      calls.push({ method: 'PUT', plan: clone(plan) });
      assert.ok(plans.has(plan.id), 'updates must target an existing plan');
      plans.set(plan.id, clone(plan));
      return of(clone(plan));
    },
    getNutritionPlanById(id) { return of(clone(plans.get(id))); },
  };
  let meals = 2;
  const settings = { getDefaultMealsCount: () => meals, getConfig: () => ({ nutrition: { autoCreateMeals: true } }) };
  return {
    plans, calls, route, router, service,
    setMeals: count => { meals = count; },
    draft: (mode = null) => new NutritionDraftState(service, route, mode, undefined, router),
    editor: () => new CreateFullPlanComponent(router, route, service, settings, {}, { currentLang: 'fr' }, {}),
  };
}

test('configuration detour, reload, save and publish keep one full nutrition plan', () => {
  const env = setup();
  let editor = env.editor();
  editor.ngOnInit();
  assert.equal(env.plans.size, 1);
  assert.equal(new URL(env.router.url, 'http://localhost').searchParams.get('draftId'), 'plan-1');
  assert.equal(editor.days[0].meals.length, 2);
  editor.savePlan();

  // Leave for configuration, change defaults, then return using browser history.
  const resumeUrl = env.router.url;
  env.router.url = '/configuration';
  env.setMeals(1);
  env.router.url = resumeUrl;
  editor = env.editor();
  editor.ngOnInit();
  assert.equal(env.plans.size, 1);
  assert.equal(editor.days[0].meals.length, 2, 'resume must load the saved days, not regenerate defaults');

  for (const day of editor.days) {
    day.meals = day.meals.slice(0, 1);
    day.meals[0].foods = [{ name: 'Tuna', quantity: 100, unit: 'Grams', calories: 130, protein: 22, carbs: 0, fat: 5 }];
  }
  editor.planName = 'plan 1';
  editor.savePlan();
  editor = env.editor();
  editor.ngOnInit();
  assert.equal(editor.planName, 'plan 1');
  assert.ok(editor.days.every(day => day.meals.length === 1 && day.meals[0].foods.length === 1));
  editor.savePlan(1);
  assert.equal(editor.draft.error, '');
  assert.equal(env.plans.size, 1);
  assert.deepEqual(env.plans.get('plan-1').publishedWeeks, [1]);
  assert.equal(env.calls.filter(call => call.method === 'POST').length, 1);
  assert.ok(env.calls.filter(call => call.method === 'PUT').every(call => call.plan.id === 'plan-1'));
  assert.equal(env.router.navigations.length, 1);
  assert.equal(env.router.navigations[0].options.replaceUrl, true);
  assert.equal(env.router.navigations[0].options.queryParamsHandling, 'merge');
  assert.equal(env.router.navigations[0].options.relativeTo, env.route);
  assert.equal(new URL(resumeUrl, 'http://localhost').searchParams.get('type'), 'each');
});

for (const mode of [null, 'EACH_MEAL', 'TOTAL_FOR_DAY']) {
  test(`resumed ${mode || 'full'} drafts update by URL identity even before load`, () => {
    const env = setup('/clients/create-full-plan/client-1?draftId=existing&returnUrl=%2Fclients%2Fclient-1');
    env.plans.set('existing', { id: 'existing', name: 'draft', mealDays: [] });
    env.draft(mode).save({ name: 'renamed', mealDays: [] });
    assert.equal(env.calls[0].method, 'PUT');
    assert.equal(env.calls[0].plan.id, 'existing');
    assert.equal(env.calls[0].plan.trackingMode, mode);
    assert.equal(env.plans.size, 1);
    assert.equal(env.router.navigations.length, 0);
  });
}

test('editing an existing plan uses its path ID before load', () => {
  const env = setup('/nutrition/create-full-plan/existing');
  env.route.snapshot.paramMap.get = key => key === 'id' ? 'existing' : null;
  env.plans.set('existing', { id: 'existing', name: 'draft', mealDays: [] });
  env.draft().save({ name: 'renamed', mealDays: [] });
  assert.equal(env.calls[0].method, 'PUT');
  assert.equal(env.calls[0].plan.id, 'existing');
  assert.equal(env.router.navigations.length, 0);
});

test('concurrent clicks cannot create multiple plans', () => {
  const env = setup();
  const pending = new Subject();
  let creates = 0;
  env.service.createNutritionPlan = () => { creates++; return pending; };
  const draft = env.draft();
  draft.save({ name: 'draft', mealDays: [] });
  draft.save({ name: 'draft', mealDays: [] });
  assert.equal(creates, 1);
  assert.equal(draft.saving, true);
  pending.next({ id: 'saved' });
  assert.equal(draft.saving, false);
  assert.ok(env.router.url.includes('draftId=saved'));
});

test('failed creation leaves no resume ID and a retry creates only one plan', () => {
  const env = setup();
  const create = env.service.createNutritionPlan;
  env.service.createNutritionPlan = () => throwError(() => ({ error: { message: 'Save failed' } }));
  const draft = env.draft();
  draft.save({ name: 'draft', mealDays: [] });
  assert.equal(draft.error, 'Save failed');
  assert.equal(draft.saving, false);
  assert.equal(env.router.navigations.length, 0);
  env.service.createNutritionPlan = create;
  draft.save({ name: 'draft', mealDays: [] });
  draft.save({ name: 'draft', mealDays: [] });
  assert.equal(env.plans.size, 1);
  assert.deepEqual(env.calls.map(call => call.method), ['POST', 'PUT']);
});

test('a late creation response does not navigate away from configuration', () => {
  const env = setup();
  const pending = new Subject();
  env.service.createNutritionPlan = () => pending;
  const draft = env.draft();
  draft.save({ name: 'draft', mealDays: [] });
  env.router.url = '/configuration';
  pending.next({ id: 'saved' });
  assert.equal(env.router.url, '/configuration');
  assert.equal(env.router.navigations.length, 0);
});

test('starting a separate creation still creates a distinct plan', () => {
  const env = setup();
  env.draft().save({ name: 'same name', mealDays: [] });
  env.router.url = '/nutrition/create-full-plan?name=same%20name';
  env.draft().save({ name: 'same name', mealDays: [] });
  assert.equal(env.plans.size, 2);
  assert.deepEqual(env.calls.map(call => call.method), ['POST', 'POST']);
});
