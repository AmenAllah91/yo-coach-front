const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const rx = require('rxjs');
const exportsForTest = {};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(
  'src/app/service/coach-settings.service.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
}).outputText, {
  exports: exportsForTest,
  require: name => name === '@angular/core' ? { Injectable: () => klass => klass }
    : name === 'rxjs' ? rx : { environment: { baseApiUrl: 'https://test' } },
  localStorage: { getItem: () => null },
});

test('Web reads actual backend demo counts and detects leftover library data', () => {
  const normalize = exportsForTest.normalizeDemoWorkspaceStatus;
  const status = normalize({ active: true, demoClients: 1, demoWorkoutPlans: 2, demoMealPlans: 3 });
  assert.equal(status.clientCount, 1);
  assert.equal(status.workoutProgramCount, 2);
  assert.equal(status.nutritionProgramCount, 3);
  assert.equal(normalize({ active: false, demoMeals: 2 }).active, true);
  assert.equal(normalize({ active: false, demoMeals: 0 }).active, false);
});

test('Removal verifies persisted status instead of interpreting a message as empty data', async () => {
  const requests = [];
  const service = new exportsForTest.CoachSettingsService({
    delete: url => { requests.push(['DELETE', url]); return rx.of({ message: 'removed' }); },
    get: url => { requests.push(['GET', url]); return rx.of({ active: false, demoMeals: 2 }); },
  });
  await assert.rejects(rx.firstValueFrom(service.removeDemoWorkspace()), /Demo data remains/);
  assert.equal(requests[0][0], 'DELETE');
  assert.equal(requests[1][0], 'GET');
});

test('Removal succeeds once the server confirms an empty workspace', async () => {
  const service = new exportsForTest.CoachSettingsService({
    delete: () => rx.of({}),
    get: () => rx.of({ active: false, demoClients: 0, demoMeals: 0 }),
  });
  assert.equal((await rx.firstValueFrom(service.removeDemoWorkspace())).active, false);
});

test('Verification failure does not report a successful empty workspace', async () => {
  const service = new exportsForTest.CoachSettingsService({
    delete: () => rx.of({}),
    get: () => rx.throwError(() => new Error('status unavailable')),
  });
  await assert.rejects(rx.firstValueFrom(service.removeDemoWorkspace()), /status unavailable/);
});
