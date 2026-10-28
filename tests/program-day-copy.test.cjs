// Copies between program days (« Copier ce jour », « Dupliquer la semaine », « Coller sur des jours »), run with
// `node --test tests/program-day-copy.test.cjs`.
const { test } = require('node:test');
const assert = require('node:assert/strict');
// Values built inside the vm context have its own prototypes: compare their structure.
const sameAs = (actual, expected) => assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected);
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const DIR = path.join(__dirname, '../src/app/shared/program-copy');
const loaded = {};

class EventEmitter {
  constructor() { this.calls = []; }
  emit(value) { this.calls.push(value); }
}
const angularCore = {
  Component: () => (klass) => klass,
  Injectable: () => (klass) => klass,
  Input: () => () => {},
  Output: () => () => {},
  EventEmitter,
};

function load(file) {
  if (loaded[file]) return loaded[file];
  const exports = {};
  const source = fs.readFileSync(file, 'utf8');
  const js = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText;
  vm.runInNewContext(js, {
    exports,
    globalThis: { crypto: require('node:crypto') },
    require: (name) => {
      if (name === '@angular/core') return angularCore;
      if (name.startsWith('./')) return load(path.join(path.dirname(file), name + '.ts'));
      return {};
    },
  });
  loaded[file] = exports;
  return exports;
}

const copy = load(path.join(DIR, 'program-day-copy.ts'));
const { ProgramCopyController } = load(path.join(DIR, 'program-copy-controller.ts'));
const { ProgramDayClipboardService } = load(path.join(DIR, 'program-day-clipboard.service.ts'));
const { CopyDaysModalComponent } = load(path.join(DIR, 'copy-days-modal.component.ts'));
const activity = load(path.join(__dirname, '../src/app/shared/models/client-day-activity.ts'));

/** A workout editor with `count` days; `filled` days have one session with an exercise named after them. */
function editor(count, { filled = [], locked = [], readOnly = false } = {}) {
  const days = Array.from({ length: count }, (_, i) => ({
    id: `d${i}`, date: `2026-11-${String(i + 1).padStart(2, '0')}`, dayNumber: i + 1, title: `Day ${i + 1}`, name: `Day ${i + 1}`,
    status: 'PENDING',
    workoutSessions: filled.includes(i) ? [{ name: 'S', exercises: [{ id: `e${i}`, name: `ex${i}` }] }] : [],
  }));
  days.forEach((day) => (day.session = day.workoutSessions[0] ?? null));
  const host = {
    selected: days[0],
    notes: [],
    restoredDays: [],
  };
  const clipboard = new ProgramDayClipboardService();
  const controller = new ProgramCopyController(clipboard, 'workout', {
    days: () => days,
    selectedDay: () => host.selected,
    isFilled: (day) => (day.workoutSessions || []).length > 0,
    isLocked: (day) => locked.includes(days.indexOf(day)),
    apply: (source, target) => copy.copyWorkoutDayContent(source, target),
    restored: (day) => { host.restoredDays.push(day); day.session = day.workoutSessions?.[0] ?? null; },
    planName: () => 'Force',
    translate: (key, params) => (params ? `${key}:${JSON.stringify(params)}` : key),
    notify: (title, message, undo) => host.notes.push({ title, message, undo }),
    readOnly: () => readOnly,
  });
  return { days, host, controller, clipboard };
}

function modal(inputs) {
  const m = new CopyDaysModalComponent();
  Object.assign(m, inputs);
  m.ngOnChanges();
  return m;
}

test('weekCopies: each day of the week onto the same weekday of the targets, existing days only', () => {
  const copies = copy.weekCopies(1, [2, 3], 17);
  assert.equal(copies.length, 10); // 7 for week 2, 3 for the partial week 3
  sameAs(copies[0], { from: 0, to: 7 });
  sameAs(copies.at(-1), { from: 2, to: 16 });
  sameAs(copy.weekCopies(2, [2], 14), []); // never onto itself
});

test('copyWorkoutDayContent: content only, the target keeps its place; a default title stays', () => {
  const source = { title: 'Push', name: 'Push', description: 'heavy', workoutSessions: [{ exercises: [{ id: 'e1' }] }], isRestDay: false };
  const target = { id: 't', date: '2026-11-05', dayNumber: 5, title: 'Day 5', name: 'Day 5', status: 'COMPLETED', clientExerciseLogs: [1] };
  copy.copyWorkoutDayContent(source, target);
  assert.equal(target.id, 't');
  assert.equal(target.date, '2026-11-05');
  assert.equal(target.status, 'COMPLETED');
  sameAs(target.clientExerciseLogs, [1]);
  assert.equal(target.title, 'Push');
  assert.equal(target.session, target.workoutSessions[0]);
  source.workoutSessions[0].exercises[0].id = 'changed';
  assert.equal(target.workoutSessions[0].exercises[0].id, 'e1'); // deep copy

  const other = { title: 'Day 3', name: 'Day 3' };
  copy.copyWorkoutDayContent({ title: 'Day 1', workoutSessions: [] }, other);
  assert.equal(other.title, 'Day 3');
});

test('copyMealDayContent: new meal and food ids, targets copied, client fields kept', () => {
  const source = { meals: [{ id: 'm1', foods: [{ id: 'f1' }] }], dayTargets: { calories: 2000 }, cheatMeal: false, refeedDay: true };
  const target = { id: 'd2', date: '2026-11-02', status: 'COMPLETED', hunger: 'low', meals: [] };
  copy.copyMealDayContent(source, target);
  assert.equal(target.id, 'd2');
  assert.equal(target.status, 'COMPLETED');
  assert.equal(target.hunger, 'low');
  assert.equal(target.refeedDay, true);
  assert.equal(target.dayTargets.calories, 2000);
  assert.notEqual(target.meals[0].id, 'm1');
  assert.notEqual(target.meals[0].foods[0].id, 'f1');
  source.dayTargets.calories = 1;
  assert.equal(target.dayTargets.calories, 2000);
});

test('an empty day cannot be copied; a week without a filled day cannot be duplicated', () => {
  const { host, controller, days } = editor(14, { filled: [3] });
  assert.equal(controller.canCopyDay, false); // day 1 is empty
  assert.equal(controller.canDuplicateWeek, true); // week 1 has day 4
  host.selected = days[3];
  assert.equal(controller.canCopyDay, true);
  host.selected = days[8];
  assert.equal(controller.canDuplicateWeek, false); // week 2 is empty
  assert.equal(editor(7, { filled: [0] }).controller.canDuplicateWeek, false); // a single week
  assert.equal(editor(14, { filled: [0], readOnly: true }).controller.canCopyDay, false);
});

test('copy onto days, then « Annuler » puts every target back as it was', () => {
  const { days, host, controller } = editor(14, { filled: [0, 9] });
  const before = JSON.stringify(days[9]);
  controller.openDay();
  assert.equal(controller.modal.mode, 'day');
  controller.confirm([{ from: 0, to: 7 }, { from: 0, to: 9 }]);
  assert.equal(controller.modal, null);
  assert.equal(days[7].workoutSessions[0].exercises[0].name, 'ex0');
  assert.equal(days[9].workoutSessions[0].exercises[0].name, 'ex0');
  assert.equal(host.notes.length, 1);
  assert.match(host.notes[0].title, /COPY_DAYS.DONE/);

  const sameObject = days[9];
  host.notes[0].undo();
  assert.equal(days[9], sameObject); // the editor keeps its reference
  assert.equal(JSON.stringify(days[9]), before);
  assert.equal(days[7].workoutSessions.length, 0);
  assert.equal(days[9].session, days[9].workoutSessions[0]); // relinked
});

test('locked days (past or done by the client) are never written, even if asked', () => {
  const { days, controller } = editor(14, { filled: [0], locked: [7] });
  controller.openDay();
  sameAs(controller.modal.locked.slice(6, 9), [false, true, false]);
  controller.confirm([{ from: 0, to: 7 }, { from: 0, to: 8 }]);
  assert.equal(days[7].workoutSessions.length, 0);
  assert.equal(days[8].workoutSessions.length, 1);
});

test('« Copier vers un autre programme », banner, paste uses it up, « ✕ » cancels it', () => {
  const a = editor(14, { filled: [0] });
  a.controller.openDay();
  a.controller.keepForAnotherProgram();
  assert.equal(a.controller.modal, null);
  assert.equal(a.controller.copied.label, 'WEEK_NUMBER:{"number":1} · DAY_NUMBER:{"number":1} · Force');

  // Another program of the same kind sees the same clipboard (one service in the app).
  const b = editor(7);
  const shared = new ProgramCopyController(a.clipboard, 'workout', {
    days: () => b.days, selectedDay: () => b.days[0], isFilled: () => false, isLocked: () => false,
    apply: (s, t) => copy.copyWorkoutDayContent(s, t), restored: () => {}, planName: () => 'B',
    translate: (k) => k, notify: () => {}, readOnly: () => false,
  });
  assert.ok(shared.copied);
  shared.openPaste();
  assert.equal(shared.modal.mode, 'paste');
  shared.confirm([{ from: null, to: 2 }, { from: null, to: 4 }]);
  assert.equal(b.days[2].workoutSessions[0].exercises[0].name, 'ex0');
  assert.equal(b.days[4].workoutSessions[0].exercises[0].name, 'ex0');
  assert.notEqual(b.days[2].workoutSessions, b.days[4].workoutSessions); // each paste is its own copy
  assert.equal(shared.copied, null); // pasted: the banner goes away

  a.controller.openDay();
  a.controller.keepForAnotherProgram();
  a.controller.cancelKept();
  assert.equal(a.controller.copied, null);
  // A workout day is never offered to a nutrition plan.
  a.controller.keepForAnotherProgram();
  assert.equal(a.clipboard.get('nutrition:FOODS'), null);
});

test('modal, week mode: next week preselected, empty source days and locked targets skipped', () => {
  const filled = Array(21).fill(false);
  [0, 2, 4].forEach((i) => (filled[i] = true));
  const locked = Array(21).fill(false);
  locked[16] = true;
  const m = modal({ mode: 'week', dayCount: 21, sourceWeek: 1, filled, locked });
  sameAs([...m.selected], [2]);
  sameAs(m.copies.map((c) => c.to), [7, 9, 11]);
  m.selectFollowingWeeks();
  sameAs(m.copies.map((c) => c.to), [7, 9, 11, 14, 18]); // 16 is locked
});

test('modal, day mode: shortcuts never pick the source or a locked day; overwrite count', () => {
  const filled = Array(14).fill(false);
  filled[0] = filled[8] = true;
  const locked = Array(14).fill(false);
  locked[1] = true;
  const m = modal({ mode: 'day', dayCount: 14, sourceIndex: 0, filled, locked });
  m.selectSameWeekday();
  sameAs(m.copies, [{ from: 0, to: 7 }]);
  m.selected.clear();
  m.selectAll();
  assert.equal(m.copies.length, 12); // 14 - source - locked
  assert.ok(!m.copies.some((c) => c.to === 0 || c.to === 1));
  assert.equal(m.overwriteCount, 1); // day 9
  m.selected.clear();
  m.selectEmptyDays();
  assert.ok(!m.copies.some((c) => c.to === 8));
  m.toggle(1); // a locked day cannot be added by hand either
  assert.ok(!m.copies.some((c) => c.to === 1));
});

test('modal, paste mode: every day except the locked ones, from the clipboard', () => {
  const m = modal({ mode: 'paste', dayCount: 7, sourceIndex: null, filled: Array(7).fill(false), locked: [true, false, false, false, false, false, false] });
  m.selectAll();
  assert.equal(m.copies.length, 6);
  assert.ok(m.copies.every((c) => c.from === null));
});

test('client activity: the server rule for workout and nutrition days', () => {
  assert.equal(activity.workoutDayActive({ status: 'PENDING' }), false);
  assert.equal(activity.workoutDayActive({ status: 'COMPLETED' }), true);
  assert.equal(activity.workoutDayActive({ status: 'MISSED' }), true);
  assert.equal(activity.workoutDayActive({ status: 'PENDING', clientExerciseLogs: [{}] }), true);
  assert.equal(activity.workoutDayActive({ status: 'PENDING', workoutElapsedSeconds: 12 }), true);
  assert.equal(activity.workoutDayActive({ status: null, overallWorkoutNote: '  ' }), false);
  assert.equal(activity.mealDayActive({ status: 'PENDING', hunger: '' }), false);
  assert.equal(activity.mealDayActive({ status: 'PENDING', energy: 'high' }), true);
  assert.equal(activity.mealDayActive({ status: 'PENDING', clientMealLogs: [{}] }), true);
});
