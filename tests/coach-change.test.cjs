const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rx = require('rxjs');

function component(confirm, responses) {
  const exports = {};
  const dialogs = [], calls = [], routes = [];
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,
    '../src/app/components/clients/invitation/invitation.component.ts'), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText, {
    exports,
    require: name => name === '@angular/core' ? { Component: () => klass => klass }
      : name === 'sweetalert2' ? { default: { fire: async options => { dialogs.push(options); return { isConfirmed: confirm }; } } } : {},
  });
  let refreshes = 0;
  const c = new exports.InvitationComponent({}, { navigate: async route => routes.push(route) },
    { acceptInvitation: (...args) => { calls.push(args); return responses[calls.length - 1]; } },
    { getCurrentLanguage: () => 'en', setLanguage: () => {} },
    { isLoggedIn: () => true, getId: async () => 'client' },
    { refresh: async () => { refreshes++; return true; } });
  c.token = 'token'; c.invitation = { status: 'PENDING' };
  return { c, dialogs, calls, routes, refreshes: () => refreshes };
}
const confirmation = () => rx.throwError(() => ({ status: 409,
  error: { code: 'COACH_CHANGE_CONFIRMATION_REQUIRED', currentCoachId: 'A' } }));
const settle = () => new Promise(resolve => setImmediate(resolve));

test('Cancel leaves the invitation pending and sends no confirmed change', async () => {
  const { c, calls, dialogs, routes } = component(false, [confirmation()]);
  await c.acceptInvitation(); await settle();
  assert.equal(dialogs[0].title, 'Change coach?');
  assert.equal(dialogs[0].cancelButtonText, 'Cancel');
  assert.equal(dialogs[0].confirmButtonText, 'Change coach');
  assert.equal(calls.length, 1); assert.equal(routes.length, 0);
  assert.equal(c.invitation.status, 'PENDING'); assert.equal(c.actionError, false);
});

test('Confirm submits the exact previous coach and refreshes access before onboarding', async () => {
  const result = component(true, [confirmation(), rx.of({})]);
  await result.c.acceptInvitation(); await settle();
  assert.deepEqual(result.calls[1], ['token', 'client', 'A']);
  assert.equal(result.refreshes(), 1);
  assert.equal(result.routes[0][0], '/client-onboarding');
  assert.equal(result.c.invitation.status, 'ACCEPTED');
});

test('Archived clients accept directly without the change-coach dialog', async () => {
  const result = component(false, [rx.of({})]);
  await result.c.acceptInvitation(); await settle();
  assert.equal(result.dialogs.length, 0); assert.equal(result.calls.length, 1);
  assert.equal(result.refreshes(), 1); assert.equal(result.c.invitation.status, 'ACCEPTED');
});

test('A failed acceptance allows retry and keeps the invitation pending', async () => {
  const { c, dialogs, routes } = component(false, [rx.throwError(() => ({ status: 500 }))]);
  await c.acceptInvitation(); await settle();
  assert.equal(c.actionError, true); assert.equal(c.accepting, false);
  assert.equal(c.invitation.status, 'PENDING'); assert.equal(dialogs.length, 0); assert.equal(routes.length, 0);
});
