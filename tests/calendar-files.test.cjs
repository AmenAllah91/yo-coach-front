// CA-10: PDF / Excel programs on the client's calendar, one band per program (backlog-programmes.md K4).
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

const c = load('src/app/shared/models/calendar-files.ts');
const file = (programId, start, end, name = programId) => ({ programId, name, resourceType: 'PDF', start, end, tone: 0, lane: 0 });
/** The 7 dates of the week starting on that Monday (November 2026: the 2nd is a Monday). */
const week = (monday) => Array.from({ length: 7 }, (_, i) => `2026-11-${String(monday + i).padStart(2, '0')}`);
const plain = (band) => ({ id: band.file.programId, col: band.col, span: band.span, lane: band.lane, starts: band.starts, ends: band.ends, first: band.first });

test('files: by start, one color each, overlapping files never share a row', () => {
  const files = c.arrangeFiles([
    file('b', '2026-11-10', '2026-11-30'),
    file('a', '2026-11-03', '2026-11-12'),
    file('c', '2026-11-14', '2026-11-20'),
  ]);
  assert.equal(files.map((f) => f.programId).join(), 'a,b,c');
  assert.equal(files.map((f) => f.tone).join(), '0,1,2');
  assert.equal(files.map((f) => f.lane).join(), '0,1,0', 'c starts after a ends: it takes the free first row');
});

test('a program over several weeks: « Début » on its first week, « Fin » on its last, dates once', () => {
  const [program] = c.arrangeFiles([file('p', '2026-11-04', '2026-11-19')]);
  const seen = new Set();
  const first = c.weekBands(week(2), [program], seen);
  const second = c.weekBands(week(9), [program], seen);
  const third = c.weekBands(week(16), [program], seen);
  assert.deepEqual(plain(first.bands[0]), { id: 'p', col: 2, span: 5, lane: 0, starts: true, ends: false, first: true });
  assert.deepEqual(plain(second.bands[0]), { id: 'p', col: 0, span: 7, lane: 0, starts: false, ends: false, first: false });
  assert.deepEqual(plain(third.bands[0]), { id: 'p', col: 0, span: 4, lane: 0, starts: false, ends: true, first: false });
  assert.equal(JSON.stringify(first.covered), JSON.stringify([false, false, true, true, true, true, true]));
  assert.equal(first.lanes, 1);
  assert.equal(c.weekBands(week(23), [program], seen).bands.length, 0, 'nothing after its end');
});

test('a program started before the month: its first piece on the screen carries the dates, without « Début »', () => {
  const [program] = c.arrangeFiles([file('p', '2026-10-20', '2026-11-06')]);
  // November 2026 starts on a Sunday: the first row has only that day, the days before are outside the month.
  const firstRow = [null, null, null, null, null, null, '2026-11-01'];
  const { bands } = c.weekBands(firstRow, [program], new Set());
  assert.deepEqual(plain(bands[0]), { id: 'p', col: 6, span: 1, lane: 0, starts: false, ends: false, first: true });
});

test('rows: only the files of the week, in the order they keep elsewhere', () => {
  const files = c.arrangeFiles([
    file('a', '2026-11-02', '2026-11-05'),
    file('b', '2026-11-03', '2026-11-25'),
  ]);
  assert.equal(files.map((f) => f.lane).join(), '0,1');
  const later = c.weekBands(week(16), files, new Set());
  assert.equal(later.lanes, 1, 'a is over: b goes up to the first row of that week');
  assert.equal(later.bands[0].lane, 0);
  const both = c.weekBands(week(2), files, new Set());
  assert.equal(both.lanes, 2);
  assert.equal(both.bands.map((band) => band.lane).join(), '0,1');
});

test('a one-day program starts and ends on the same day', () => {
  const [program] = c.arrangeFiles([file('p', '2026-11-05', '2026-11-05')]);
  const { bands } = c.weekBands(week(2), [program], new Set());
  assert.deepEqual(plain(bands[0]), { id: 'p', col: 3, span: 1, lane: 0, starts: true, ends: true, first: true });
});
