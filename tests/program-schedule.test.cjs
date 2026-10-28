// AW-08: the assignment helpers (backlog-programmes.md A2, A5, A7, A9).
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
  }).outputText, { exports, console, require: () => ({}), Date, Math });
  return exports;
}

const s = load('src/app/shared/models/program-schedule.ts');
const iso = value => value; // dates are already yyyy-MM-dd

test('dates: add days, next Monday, days between', () => {
  assert.equal(s.addDaysIso('2026-10-30', 3), '2026-11-02');
  assert.equal(s.addDaysIso('2026-03-01', -1), '2026-02-28');
  assert.equal(s.nextMondayIso('2026-10-23'), '2026-10-26', 'a Friday: the coming Monday');
  assert.equal(s.nextMondayIso('2026-10-26'), '2026-11-02', 'a Monday: the one after');
  assert.equal(s.daysBetween('2026-10-25', '2026-11-21'), 27);
});

test('shortcuts: today, tomorrow, next Monday; continuity first and never twice', () => {
  const plain = s.dateShortcuts('2026-10-23');
  assert.equal(plain.map(x => x.key).join(), 'TODAY,TOMORROW,NEXT_MONDAY');
  const after = s.dateShortcuts('2026-10-23', '2026-10-25');
  assert.equal(after.map(x => x.key).join(), 'CONTINUITY,TODAY,TOMORROW,NEXT_MONDAY');
  const sameAsTomorrow = s.dateShortcuts('2026-10-23', '2026-10-24');
  assert.equal(sameAsTomorrow.map(x => x.key).join(), 'CONTINUITY,TODAY,NEXT_MONDAY', 'tomorrow is the continuity');
  assert.equal(s.dateShortcuts('2026-10-23', '2026-10-20').map(x => x.key).join(), 'TODAY,TOMORROW,NEXT_MONDAY',
    'a continuity in the past is not offered');
});

test('read-only: stopped or finished client programs, never library programs', () => {
  const today = '2026-10-23';
  assert.equal(s.isPlanLocked({ client: { id: 'c' }, stoppedAt: '2026-10-30', endDate: '2026-10-30' }, today), true);
  assert.equal(s.isPlanLocked({ client: { id: 'c' }, endDate: '2026-10-22' }, today), true);
  assert.equal(s.isPlanLocked({ client: { id: 'c' }, endDate: '2026-10-23' }, today), false, 'its last day is today');
  assert.equal(s.isPlanLocked({ endDate: '2026-01-01' }, today), false, 'a library program');
  assert.equal(s.isLockedError({ status: 409, error: { code: 'PROGRAM_LOCKED' } }), true);
  assert.equal(s.isLockedError({ status: 400, error: { code: 'PROGRAM_GAP' } }), false);
});

test('sentences before the click (A5)', () => {
  const stopped = { programName: 'A', kind: 'STOPPED', endDate: '2026-11-07', newEndDate: '2026-10-26', preparedDaysLost: 0 };
  assert.equal(JSON.stringify(s.changeSentence(stopped, iso)), JSON.stringify({ key: 'ASSIGN_FLOW.CHANGE_STOPPED', params: { name: 'A', date: '2026-10-26' } }));
  const lost = s.changeSentence({ ...stopped, preparedDaysLost: 5 }, iso);
  assert.equal(lost.key, 'ASSIGN_FLOW.CHANGE_STOPPED_LOST');
  assert.equal(lost.params.count, 5);
  assert.equal(s.changeSentence({ ...stopped, preparedDaysLost: 1 }, iso).key, 'ASSIGN_FLOW.CHANGE_STOPPED_LOST_ONE');
  const removed = s.changeSentence({ programName: 'C', kind: 'REMOVED', startDate: '2026-11-02', endDate: '2026-11-15', preparedDaysLost: 3 }, iso);
  assert.equal(removed.key, 'ASSIGN_FLOW.CHANGE_REMOVED');
  assert.equal(removed.params.date, '2026-11-02', 'the day it was planned');
});

test('sentences after the click, failures and retries (A7)', () => {
  const done = s.doneSentence({ programName: 'A', kind: 'STOPPED', newEndDate: '2026-10-22' }, 'Khalil', iso);
  assert.equal(done.key, 'ASSIGN_FLOW.DONE_STOPPED');
  assert.equal(done.params.client, 'Khalil');
  assert.equal(s.failureReasonKey('CLIENT_ARCHIVED'), 'ASSIGN_FLOW.REASON_CLIENT_ARCHIVED');
  assert.equal(s.failureReasonKey('SOMETHING'), 'ASSIGN_FLOW.REASON_UNEXPECTED');
  assert.equal(s.retryable({ ok: false, errorCode: 'ASSIGN_FAILED' }), true);
  assert.equal(s.retryable({ ok: false, errorCode: 'CLIENT_ARCHIVED' }), false, 'trying again would not help');
  assert.equal(s.retryable({ ok: true }), false);
});

test('the clients whose calendar changes, in the order chosen (A6)', () => {
  const previews = { a: { changes: [] }, b: { changes: [{}] }, c: { changes: [{}, {}] } };
  assert.equal(s.affectedClientIds(previews, ['c', 'a', 'b']).join(), 'c,b');
});

test('new dates: « Décaler » replaces the removal of the next programs, « Retirer » keeps the rule (CD-10)', () => {
  const preview = {
    changes: [
      { programId: 'B', programName: 'B', kind: 'REMOVED', startDate: '2026-11-08', endDate: '2026-11-14' },
      { programId: 'X', programName: 'X', kind: 'STOPPED', startDate: '2026-10-20', endDate: '2026-11-10', newEndDate: '2026-11-07' },
    ],
    shifts: [{ programId: 'B', programName: 'B', kind: 'SHIFTED', startDate: '2026-11-08', newStartDate: '2026-11-15' }],
  };
  assert.equal(s.movedChanges(preview, 'SHIFT').map(c => `${c.programId}:${c.kind}`).join(), 'B:SHIFTED,X:STOPPED');
  assert.equal(s.movedChanges(preview, 'REMOVE').map(c => `${c.programId}:${c.kind}`).join(), 'B:REMOVED,X:STOPPED');
  assert.equal(s.movedChanges(undefined, 'SHIFT').length, 0);
  assert.equal(s.losesSomething(s.movedChanges({ changes: [], shifts: preview.shifts }, 'SHIFT')), false, 'a shift alone saves at once');
  assert.equal(s.losesSomething(s.movedChanges(preview, 'SHIFT')), true);
});

test('a year being typed is not a date chosen yet (CD-11)', () => {
  assert.equal(s.typingYear('0002-09-06'), true);
  assert.equal(s.typingYear('0202-09-06'), true);
  assert.equal(s.typingYear('2028-09-06'), false);
});

test('new dates in one click: a week earlier or later, the continuity, today (CD-13)', () => {
  // Today Sunday 25 Oct; the program starts Monday 2 Nov.
  const keys = list => list.map(x => `${x.key}:${x.date}`).join();
  assert.equal(keys(s.moveShortcuts('2026-10-25', '2026-11-02')), 'MINUS_WEEK:2026-10-26,PLUS_WEEK:2026-11-09,TODAY:2026-10-25');
  assert.equal(keys(s.moveShortcuts('2026-10-25', '2026-11-02', '2026-11-01')),
    'MINUS_WEEK:2026-10-26,PLUS_WEEK:2026-11-09,CONTINUITY:2026-11-01,TODAY:2026-10-25');
  assert.equal(keys(s.moveShortcuts('2026-10-25', '2026-10-28')), 'PLUS_WEEK:2026-11-04,TODAY:2026-10-25', 'a week earlier would be in the past');
  assert.equal(keys(s.moveShortcuts('2026-10-25', '2026-11-02', '2026-11-09')), 'MINUS_WEEK:2026-10-26,PLUS_WEEK:2026-11-09,TODAY:2026-10-25',
    'never the same date twice');
});

test('another weekday: the same weekday just before or just after (CD-13)', () => {
  // The program started on a Monday (2 Nov); Wednesday 11 Nov is chosen.
  assert.equal(JSON.stringify(s.sameWeekdayAround('2026-11-11', '2026-11-02', '2026-10-25')), JSON.stringify({ before: '2026-11-09', after: '2026-11-16' }));
  assert.equal(s.sameWeekdayAround('2026-11-16', '2026-11-02', '2026-10-25'), null, 'still a Monday');
  assert.equal(JSON.stringify(s.sameWeekdayAround('2026-10-28', '2026-11-02', '2026-10-27')), JSON.stringify({ before: null, after: '2026-11-02' }),
    'Monday 26 Oct is in the past');
});

test('« Décaler la suite »: from the day after the last activity, resume today when late (DS-10)', () => {
  assert.equal(s.firstShiftableDay({ startDate: '2026-10-17', lastActivity: '2026-10-18' }), '2026-10-19');
  assert.equal(s.firstShiftableDay({ startDate: '2026-10-30', lastActivity: null }), '2026-10-30');
  assert.equal(s.defaultResume('2026-10-19', '2026-10-25'), '2026-10-25', 'days missed: they resume today');
  assert.equal(s.defaultResume('2026-11-02', '2026-10-25'), '2026-11-09', 'days to come: a week later');
  const line = s.changeSentence({ programName: 'A', kind: 'PAUSED', newStartDate: '2026-10-25', endDate: '2026-11-13', newEndDate: '2026-11-19' }, iso);
  assert.equal(line.key, 'ASSIGN_FLOW.CHANGE_PAUSED');
  assert.equal(line.params.date, '2026-10-25');
  assert.equal(line.params.end, '2026-11-19');
  assert.equal(s.losesSomething([{ kind: 'PAUSED' }, { kind: 'SHIFTED' }]), false, 'a pause loses nothing');
});
