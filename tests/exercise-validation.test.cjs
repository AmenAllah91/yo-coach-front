const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../src/app/components/exercise-library/exercise-validation.ts'), 'utf8');
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText;
const moduleExports = {};
vm.runInNewContext(compiled, { exports: moduleExports, URL });
const { exerciseErrors, youtubeVideoId, exerciseMediaError } = moduleExports;
const valid = { name: ' Squat ', type: 'STRENGTH', equipment: 'BARBELL', muscle: 'LEGS', description: '', youtube: '', hasVideo: false, existingNames: [] };

test('required fields reject whitespace while description and media remain optional', () => {
  assert.equal(Object.keys(exerciseErrors(valid)).length, 0);
  const errors = exerciseErrors({ ...valid, name: '  ', type: '', equipment: '', muscle: '' });
  assert.equal(Object.keys(errors).length, 4);
});
test('trimmed case-insensitive duplicate names are rejected', () => {
  assert.equal(exerciseErrors({ ...valid, existingNames: ['sQUAT  '] }).name, 'EX_VALID_DUPLICATE');
});
test('character limits accept the boundary, including Unicode', () => {
  assert.equal(Object.keys(exerciseErrors({ ...valid, name: '😀'.repeat(100), description: 'a'.repeat(1000) })).length, 0);
  assert.equal(exerciseErrors({ ...valid, name: 'a'.repeat(101) }).name, 'EX_VALID_NAME_LENGTH');
  assert.equal(exerciseErrors({ ...valid, description: 'a'.repeat(1001) }).description, 'EX_VALID_DESCRIPTION_LENGTH');
});
test('YouTube video URLs support watch, short links, shorts, embed and live', () => {
  for (const url of ['https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10', 'https://youtu.be/dQw4w9WgXcQ', 'https://m.youtube.com/shorts/dQw4w9WgXcQ', 'https://youtube.com/embed/dQw4w9WgXcQ', 'https://youtube.com/live/dQw4w9WgXcQ']) assert.equal(youtubeVideoId(url), 'dQw4w9WgXcQ');
});
test('spoofed hosts, malformed IDs, non-http URLs and direct video links are rejected', () => {
  for (const url of ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ', 'https://evilyoutu.be/dQw4w9WgXcQ', 'https://youtube.com@evil.test/watch?v=dQw4w9WgXcQ', 'ftp://youtu.be/dQw4w9WgXcQ', 'https://youtu.be/abc', 'https://youtube.com/watch', 'https://example.com/video.mp4', 'random youtube.com/watch?v=dQw4w9WgXcQ']) assert.equal(youtubeVideoId(url), '');
});
test('uploaded video and YouTube link conflict on both fields', () => {
  const errors = exerciseErrors({ ...valid, youtube: 'https://youtu.be/dQw4w9WgXcQ', hasVideo: true });
  assert.equal(errors.video, 'EX_VALID_VIDEO_EXCLUSIVE');
  assert.equal(errors.youtube, 'EX_VALID_VIDEO_EXCLUSIVE');
});
test('attachments enforce allowed formats, MIME type and inclusive size limits', () => {
  for (const name of ['a.jpg', 'a.JPEG', 'a.png', 'a.webp']) assert.equal(exerciseMediaError({ name, type: '', size: 10 * 1024 * 1024 }, 'image'), '');
  assert.equal(exerciseMediaError({ name: 'a.jpg', type: 'image/gif', size: 10 }, 'image'), 'EX_VALID_IMAGE_TYPE');
  assert.equal(exerciseMediaError({ name: 'a.gif', type: '', size: 10 }, 'image'), 'EX_VALID_IMAGE_TYPE');
  assert.equal(exerciseMediaError({ name: 'a.png', type: '', size: 10 * 1024 * 1024 + 1 }, 'image'), 'EX_VALID_IMAGE_SIZE');
  assert.equal(exerciseMediaError({ name: 'a.mp4', type: 'video/mp4', size: 100 * 1024 * 1024 }, 'video'), '');
  assert.equal(exerciseMediaError({ name: 'a.mov', type: '', size: 10 }, 'video'), 'EX_VALID_VIDEO_TYPE');
  assert.equal(exerciseMediaError({ name: 'a.mp4', type: '', size: 100 * 1024 * 1024 + 1 }, 'video'), 'EX_VALID_VIDEO_SIZE');
});
