const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file) {
  const source = fs.readFileSync(path.join(__dirname, '../', file), 'utf8');
  const exports = {};
  vm.runInNewContext(ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText,
    { exports, require: () => ({}) });
  return exports;
}

const pages = load('src/app/components/forms/checkin-pages.ts');
const validation = load('src/app/components/forms/create-form/check-in-form-validation.ts');

// A long check-in: "Ton corps" (sex, pain, where?) then "Cycle" only for women.
const parts = [
  { id: 'body', title: 'Ton corps' },
  { id: 'cycle', title: 'Cycle', condition: { questionId: 'sex', optionIds: ['f'] } },
];
const questions = [
  { id: 'day', type: 'TEXT', order: 3, sectionId: 'cycle' },
  { id: 'where', type: 'TEXT', order: 2, sectionId: 'body', condition: { questionId: 'hurt', yes: true } },
  { id: 'sex', type: 'MULTIPLE_CHOICE', order: 0, sectionId: 'body' },
  { id: 'hurt', type: 'YES_NO', order: 1, sectionId: 'body' },
];

test('questions come page by page, then in their order', () => {
  assert.deepEqual([...pages.orderedQuestions(questions, parts).map(q => q.id)], ['sex', 'hurt', 'where', 'day']);
});

test('a woman gets the cycle part, a man in pain gets "where?"', () => {
  const ordered = pages.orderedQuestions(questions, parts);
  const woman = pages.visibleQuestionIds(ordered, parts, [{ questionId: 'sex', selectedOptionId: 'f' }, { questionId: 'hurt', yes: false }]);
  assert.deepEqual([...woman].sort(), ['day', 'hurt', 'sex']);
  const man = pages.visibleQuestionIds(ordered, parts, [{ questionId: 'sex', selectedOptionId: 'm' }, { questionId: 'hurt', yes: true }]);
  assert.deepEqual([...man].sort(), ['hurt', 'sex', 'where']);
});

test('nothing answered yet: only the questions without a condition', () => {
  const ordered = pages.orderedQuestions(questions, parts);
  assert.deepEqual([...pages.visibleQuestionIds(ordered, parts, [])].sort(), ['hurt', 'sex']);
});

test('a form without parts is one page, and a question of a removed part opens the first page', () => {
  const single = pages.pagesOf([], 'Bilan');
  assert.equal(single.length, 1);
  assert.equal(single[0].id, pages.SINGLE_PAGE);
  assert.equal(pages.pageOf({ id: 'x', type: 'TEXT', sectionId: 'gone' }, parts), 'body');
});

test('the editor flags an empty part and an unfinished condition', () => {
  const issues = validation.validateCheckInParts(
    [{ id: 'p1', title: 'Corps' }, { id: 'p2', title: 'Vide', condition: { questionId: 'q1', yes: null, optionIds: [] } }],
    [{ id: 'q1', type: 'yes-no', text: 'Douleur ?', sectionId: 'p1' },
     { id: 'q2', type: 'input-text', text: 'Où ?', sectionId: 'p1', condition: { questionId: 'q1', yes: null, optionIds: [] } }],
  );
  assert.deepEqual([...issues.map(i => i.messageKey)].sort(), ['CHECKIN_ERROR_CONDITION', 'CHECKIN_ERROR_EMPTY_PART', 'CHECKIN_ERROR_PART_CONDITION']);

  const fine = validation.validateCheckInParts(
    [{ id: 'p1', title: 'Corps' }],
    [{ id: 'q1', type: 'yes-no', text: 'Douleur ?', sectionId: 'p1' },
     { id: 'q2', type: 'input-text', text: 'Où ?', sectionId: 'p1', condition: { questionId: 'q1', yes: true, optionIds: [] } }],
  );
  assert.equal(fine.length, 0);
});
