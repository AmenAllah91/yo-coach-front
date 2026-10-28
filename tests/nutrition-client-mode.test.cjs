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
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, useDefineForClassFields: false },
  }).outputText, { exports, require: name => dependencies[name] ?? {} });
  return exports;
}

const schedule = load('src/app/shared/models/program-schedule.ts');
const { NutritionClientMode } = load('src/app/components/nutrition/nutrition-client-mode.ts', {
  '@shared/models/program-schedule': schedule,
});

function mode(url, idClient) {
  const params = new URL(url, 'http://localhost').searchParams;
  const route = { snapshot: { paramMap: { get: key => (key === 'idClient' ? idClient : null) }, queryParamMap: { get: key => params.get(key) } } };
  const navigations = [];
  const router = { navigate: (commands, options) => navigations.push({ commands, options }), navigateByUrl: url => navigations.push({ url }) };
  const clients = { getClientById: () => ({ subscribe: ({ next }) => next({ firstName: 'Khalil', lastName: 'Arfaoui' }) }) };
  const announced = [];
  const programSchedule = { announceChanges: (...args) => announced.push(args) };
  return { m: new NutritionClientMode(route, router, clients, programSchedule, {}, {}, {}), navigations, announced };
}

// Objects made inside the vm context have other prototypes: compare their JSON.
const plain = value => JSON.parse(JSON.stringify(value));
const days = count => Array.from({ length: count }, (_, i) => ({ id: String(i), dayOfWeek: `Day ${i + 1}` }));

test('a library plan: nothing changes (no dates, no client, normal back)', () => {
  const { m } = mode('/nutrition/create-full-plan?startDate=2026-12-07', null);
  const list = days(3);
  m.refreshDates(list);
  assert.equal(m.active, false);
  assert.equal(list[0].date, undefined);
  assert.equal(m.goBack(), false);
});

test('a client plan: the start of the creation window, a date per day, the end, the client', () => {
  const { m } = mode('/clients/create-full-plan/c1?startDate=2026-12-30', 'c1');
  const draft = {};
  m.init(draft, () => false);
  const list = days(4);
  m.refreshDates(list);
  assert.deepEqual(list.map(d => d.date), ['2026-12-30', '2026-12-31', '2027-01-01', '2027-01-02']);
  assert.equal(list[3].dayNumber, 4);
  assert.equal(list[3].dayOfWeek, 'Day 4', 'the builder keeps its own day fields');
  assert.equal(m.endDate, '2027-01-02');
  assert.equal(m.clientName, 'Khalil Arfaoui');
  assert.deepEqual({ ...m.planFields(), client: undefined }, { client: undefined, startDate: '2026-12-30', endDate: '2027-01-02', isMealPlanTemplate: false });
  assert.equal(typeof draft.scheduleAnnouncer, 'function');
  assert.equal(typeof draft.overlapGuard, 'function');
});

test('an older client plan with fewer days than its dates gets empty days up to its saved end', () => {
  const { m } = mode('/clients/create-full-plan/c1/edit/p1', 'c1');
  const list = days(2);
  m.load({ startDate: '2026-11-02T00:00:00', endDate: '2026-11-06' }, list, () => ({ id: 'new' }));
  assert.equal(list.length, 5);
  assert.equal(m.startDate, '2026-11-02');
  assert.equal(list[4].date, '2026-11-06');
  assert.equal(m.endDate, '2026-11-06');
});

test('the day asked by the address, and back to the client nutrition tab', () => {
  const { m, navigations } = mode('/clients/create-full-plan/c1/edit/p1?day=2', 'c1');
  const list = days(3);
  assert.equal(m.requestedDay(list), list[1]);
  assert.equal(m.goBack(), true);
  assert.deepEqual(plain(navigations[0]), { commands: ['/clients/profil-client', 'c1'], options: { queryParams: { tab: 'nutrition' } } });
  const back = mode('/clients/create-full-plan/c1/edit/p1?returnUrl=%2Fcalendar', 'c1');
  back.m.goBack();
  assert.deepEqual(plain(back.navigations[0]), { url: '/calendar' });
});
