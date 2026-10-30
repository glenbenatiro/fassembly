import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { defaultLatestDir, newestRecording, SCREEN_RECORDINGS } from './latest';

function tempDir(t: test.TestContext): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'fassembly-latest-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}

function writeAt(file: string, content: string, mtime: Date): void {
  fs.writeFileSync(file, content);
  fs.utimesSync(file, mtime, mtime);
}

test('the newest recording wins, ignoring other files, empty files and subfolders', (t) => {
  const dir = tempDir(t);
  writeAt(path.join(dir, 'older.mp4'), 'x', new Date('2026-05-01T09:00:00Z'));
  writeAt(path.join(dir, 'newer.M4A'), 'x', new Date('2026-05-02T09:00:00Z'));
  writeAt(path.join(dir, 'notes.md'), 'x', new Date('2026-05-03T09:00:00Z'));
  writeAt(path.join(dir, 'still-recording.mp4'), '', new Date('2026-05-03T09:00:00Z'));
  fs.mkdirSync(path.join(dir, 'nested'));
  writeAt(path.join(dir, 'nested', 'newest.mp4'), 'x', new Date('2026-05-04T09:00:00Z'));

  return newestRecording(dir).then((found) => assert.equal(found, path.join(dir, 'newer.M4A')));
});

test('a folder with no recordings gives null, and a missing one throws', async (t) => {
  const dir = tempDir(t);
  writeAt(path.join(dir, 'notes.md'), 'x', new Date());
  assert.equal(await newestRecording(dir), null);
  await assert.rejects(newestRecording(path.join(dir, 'missing')), { code: 'ENOENT' });
});

test('--latest looks in Screen Recordings when Videos has one', async (t) => {
  const videos = tempDir(t);
  assert.equal(await defaultLatestDir(videos), videos);
  fs.mkdirSync(path.join(videos, SCREEN_RECORDINGS));
  assert.equal(await defaultLatestDir(videos), path.join(videos, SCREEN_RECORDINGS));
});
