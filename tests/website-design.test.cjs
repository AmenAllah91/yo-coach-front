const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

function load(file, context = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../', file), 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, require: () => ({}), ...context });
  return exports;
}

const design = load('src/app/components/website/models/website-design.ts');
const { isPublicCoachHostname } = load('src/app/config/public-coach-host.ts');

test('a saved design is completed and unknown values fall back; old themes get a close design', () => {
  const d = design.normalizeDesign({ layout: 'cover', font: 'nope', sectionOrder: ['contact', 'about', 'menu'], hiddenSections: ['contact', 'video'] });
  assert.equal(d.layout, 'cover');
  assert.equal(d.font, 'modern');
  // Arrays come from the vm realm: compare their JSON rather than their prototype.
  assert.equal(JSON.stringify(d.sectionOrder), JSON.stringify(['contact', 'about', 'video', 'stats', 'services', 'results', 'certificates', 'testimonials']));
  assert.equal(JSON.stringify(d.hiddenSections), JSON.stringify(['video'])); // the contact form can never be hidden
  assert.equal(design.normalizeDesign(null, 'dynamic').layout, 'split');
  assert.equal(design.normalizeDesign(null, 'serenity').heroBackground, 'gradient');
  assert.equal(design.normalizeDesign(undefined, 'unknown').layout, design.DEFAULT_DESIGN.layout);
});

test('every preset is complete and distinct, with valid colors', () => {
  const keys = new Set();
  for (const preset of design.THEME_PRESETS) {
    assert.ok(!keys.has(preset.key), preset.key); keys.add(preset.key);
    const d = design.normalizeDesign({ ...preset.design });
    for (const [key, value] of Object.entries(preset.design)) assert.equal(d[key], value, `${preset.key}.${key}`);
    for (const value of Object.values(preset.colors)) assert.match(value, /^#[0-9a-f]{6}$/, `${preset.key}: ${value}`);
    assert.ok(design.FONT_PAIRINGS[preset.design.font]);
  }
  assert.ok(design.THEME_PRESETS.length >= 8);
});

test('readable text, initials and WhatsApp links', () => {
  assert.equal(design.readableTextOn('#ffffff'), '#111827');
  assert.equal(design.readableTextOn('#0f172a'), '#ffffff');
  assert.equal(design.readableTextOn('#f59e0b'), '#111827');
  assert.equal(design.readableTextOn('not a color'), '#111827');
  assert.equal(design.initialsOf(' sami  ben ali '), 'SB');
  assert.equal(design.initialsOf(''), '?');
  assert.equal(design.whatsappLink('+216 22 333 444'), 'https://wa.me/21622333444');
  assert.equal(design.whatsappLink(''), '');
});

test('a coach site is any host that is not the platform, localhost or an address', () => {
  assert.equal(isPublicCoachHostname('sami.yo-coach.app'), true);
  assert.equal(isPublicCoachHostname('www.mon-coaching.com'), true);
  assert.equal(isPublicCoachHostname('mon-coaching.com'), true);
  assert.equal(isPublicCoachHostname('app.yo-coach.app'), false);
  assert.equal(isPublicCoachHostname('integration.yo-coach.app'), false);
  assert.equal(isPublicCoachHostname('login-int.yo-coach.app'), false);
  assert.equal(isPublicCoachHostname('yo-coach.app'), false);
  assert.equal(isPublicCoachHostname('localhost'), false);
  assert.equal(isPublicCoachHostname('app.localhost'), false);
  assert.equal(isPublicCoachHostname('127.0.0.1'), false);
  assert.equal(isPublicCoachHostname('::1'), false);
  assert.equal(isPublicCoachHostname(''), false);
});
