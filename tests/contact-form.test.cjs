const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const rx = require('rxjs');
let image;
class TestImage { constructor() { image = this; } }
function load(file) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true },
  }).outputText, {
    exports, require: name => name === 'rxjs' ? rx : name === '@angular/core'
      ? { Component: () => klass => klass, ViewChild: () => () => {}, Input: () => () => {}, HostListener: () => () => {} } : {},
    setTimeout: () => 0,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: () => {} },
    Image: TestImage, File: class { constructor(parts, name, options) { this.name = name; Object.assign(this, options); } },
    sessionStorage: { getItem: () => 'coach' },
  });
  return exports;
}
const { PublicContactFormComponent } = load('src/app/components/website/public-contact-form/public-contact-form.component.ts');
const { ContactFormManagerComponent } = load('src/app/components/website/contact-form-manager/contact-form-manager.component.ts');
const translate = { instant: key => key, use: () => {} };
function publicForm(submitLead = () => rx.of({})) {
  const c = new PublicContactFormComponent({}, { submitLead }, translate, { getCurrentLanguage: () => 'en' }, { setTitle: () => {} });
  c.form = { slug: 'coach' };
  c.lead = { fullName: '  Jane Doe ', email: ' jane@example.com ', message: ' Hello ', termsAccepted: true, website: '' };
  return c;
}
function manager(saveMine = draft => rx.of(draft), upload = () => rx.of('cover.png')) {
  const c = new ContactFormManagerComponent({ saveMine }, {}, { uploadFileInPath: upload }, translate);
  c.form = { slug: 'coach', coachName: 'Coach', message: 'Saved', coverImage: '', published: true };
  c.resetDraft(); return c;
}
test('public form rejects blanks, malformed emails and missing terms', () => {
  const c = publicForm(); assert.equal(c.canSubmit, true);
  for (const field of ['fullName', 'email', 'message']) {
    const old = c.lead[field]; c.lead[field] = '  '; assert.equal(c.canSubmit, false); c.lead[field] = old;
  }
  c.lead.email = 'invalid'; assert.equal(c.emailError, 'CONTACT_ERROR_EMAIL_INVALID');
  c.lead.email = 'jane@example.com'; c.lead.termsAccepted = false; assert.equal(c.canSubmit, false);
});
test('public length boundaries use trimmed values', () => {
  const c = publicForm();
  for (const [field, max] of [['fullName', 100], ['message', 2000]]) {
    c.lead[field] = '  ' + 'x'.repeat(max) + ' '; assert.equal(c.canSubmit, true);
    c.lead[field] = 'x'.repeat(max + 1); assert.equal(c.canSubmit, false); c.lead[field] = 'valid';
  }
  c.lead.email = 'a'.repeat(242) + '@example.com'; assert.equal(c.canSubmit, true);
  c.lead.email = 'a'.repeat(243) + '@example.com'; assert.equal(c.canSubmit, false);
});
test('public submission trims payload and blocks duplicate sends while pending', () => {
  const pending = new rx.Subject(); let calls = 0, payload;
  const c = publicForm((slug, body) => { calls++; payload = body; return pending; });
  c.submit(); c.submit(); assert.equal(calls, 1); assert.equal(c.canSubmit, false);
  assert.equal(payload.fullName, 'Jane Doe'); assert.equal(payload.email, 'jane@example.com'); assert.equal(payload.message, 'Hello');
  assert.equal(payload.website, ''); pending.next({}); pending.complete(); assert.equal(c.submitted, true);
});
test('server failure shows a translated message and allows retry; a 429 says to wait', () => {
  let c = publicForm(() => rx.throwError(() => new Error('server'))); c.submit();
  assert.equal(c.error, 'CONTACT_ERROR_SEND'); assert.equal(c.canSubmit, true);
  c = publicForm(() => rx.throwError(() => ({ status: 429 }))); c.submit();
  assert.equal(c.error, 'CONTACT_ERROR_TOO_MANY');
});
test('an incomplete form shows every error instead of sending', () => {
  let calls = 0; const c = publicForm(() => { calls++; return rx.of({}); });
  c.lead.fullName = ''; c.lead.termsAccepted = false; c.submit();
  assert.equal(calls, 0); assert.equal(JSON.stringify(c.touched), JSON.stringify({ fullName: true, email: true, message: true, terms: true }));
});
test('customization saves only real changes and rejects invalid entered values', () => {
  const c = manager(); assert.equal(c.canSave, false);
  c.draft.message = 'x'.repeat(500); assert.equal(c.canSave, true);
  c.draft.message += 'x'; assert.equal(c.canSave, false); assert.equal(c.messageError, 'CONTACT_MESSAGE_LENGTH_ERROR');
  c.draft.message = ''; assert.equal(c.canSave, true);
  c.resetDraft(); assert.equal(c.draft.message, 'Saved'); assert.equal(c.canSave, false);
});
test('customization prevents duplicate saves and keeps the form online', () => {
  let calls = 0, payload; const pending = new rx.Subject();
  const c = manager(body => { calls++; payload = body; return pending; }); c.draft.message = 'New';
  c.save(); c.save(); assert.equal(calls, 1); assert.equal(c.canSave, false); assert.equal(payload.published, true);
  pending.next({ slug: 'coach', message: 'New', published: true }); pending.complete();
  assert.equal(c.form.message, 'New'); assert.equal(c.dirty, false); assert.equal(c.saved, true);
});
test('online toggle saves at once with the saved look, not the draft', () => {
  let payload; const c = manager(body => { payload = body; return rx.of({ ...body }); });
  c.draft.message = 'Unsaved draft'; c.togglePublished();
  assert.equal(payload.published, false); assert.equal(payload.message, 'Saved'); assert.equal(c.form.published, false);
  assert.equal(c.draft.message, 'Unsaved draft');
});
function event(file) { return { target: { files: [file], value: 'file' } }; }
test('cover type, extension and inclusive 5 MB limit are checked before upload', async () => {
  let uploads = 0; const c = manager(undefined, () => { uploads++; return rx.of('url'); });
  for (const file of [{ name: 'a.gif', type: 'image/png', size: 1 }, { name: 'a.png', type: 'text/plain', size: 1 }, { name: 'a.webp', type: 'image/webp', size: 5 * 1024 * 1024 + 1 }]) {
    await c.onCoverSelected(event(file)); assert.ok(c.uploadError); assert.equal(c.draft.coverImage, '');
  }
  const operation = c.onCoverSelected(event({ name: 'a.webp', type: 'image/webp', size: 5 * 1024 * 1024 }));
  assert.equal(c.canSave, false); image.naturalWidth = 10; image.naturalHeight = 10; image.onload();
  await operation; assert.equal(uploads, 1); assert.equal(c.draft.coverImage, 'url'); assert.equal(c.canSave, true);
});
test('invalid dimensions block upload and save; existing cover can be cleared', async () => {
  let uploads = 0; const c = manager(undefined, () => { uploads++; return rx.of('url'); });
  const operation = c.onCoverSelected(event({ name: 'a.png', type: 'image/png', size: 1 }));
  image.naturalWidth = 0; image.naturalHeight = 10; image.onload(); await operation;
  assert.equal(uploads, 0); assert.equal(c.uploadError, 'CONTACT_IMAGE_DIMENSIONS_ERROR'); assert.equal(c.canSave, false);
  c.form.coverImage = 'old'; c.resetDraft(); c.removeCover(); assert.equal(c.draft.coverImage, ''); assert.equal(c.canSave, true);
});
test('cover upload stays locked until completion and failure stays under the image field', async () => {
  const pending = new rx.Subject(); let saves = 0; const c = manager(() => { saves++; return rx.of({}); }, () => pending);
  const operation = c.onCoverSelected(event({ name: 'a.png', type: 'image/png', size: 1 }));
  image.naturalWidth = 10; image.naturalHeight = 10; image.onload(); await Promise.resolve();
  c.draft.message = 'Changed'; c.save(); assert.equal(saves, 0); assert.equal(c.saving, false);
  pending.error(new Error('server')); await operation; assert.equal(c.uploadError, 'CONTACT_IMAGE_UPLOAD_ERROR');
});
