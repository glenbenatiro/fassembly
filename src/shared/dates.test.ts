import test from 'node:test';
import assert from 'node:assert/strict';
import { dateFromFileName, recordingDateIso } from './dates';

test('reads the date from a Snipping Tool recording name', () => {
  assert.equal(dateFromFileName('Screen Recording 2026-11-09 184950.mp4'), '2026-11-09');
});

test('reads dates separated by underscores or dots', () => {
  assert.equal(dateFromFileName('Meeting started 2026_10_03 18_02.m4a'), '2026-10-03');
  assert.equal(dateFromFileName('standup.2026.07.28.wav'), '2026-07-28');
});

test('ignores names without a date', () => {
  assert.equal(dateFromFileName('standup.mp4'), null);
  assert.equal(dateFromFileName('take 12.mp4'), null);
});

test('ignores digits that are part of a longer number', () => {
  assert.equal(dateFromFileName('clip 120260509123.mp4'), null);
  assert.equal(dateFromFileName('id-12026-05-09.mp4'), null);
});

test('rejects dates that do not exist', () => {
  assert.equal(dateFromFileName('Screen Recording 2026-02-30 101500.mp4'), null);
  assert.equal(dateFromFileName('Screen Recording 2026-13-01 101500.mp4'), null);
});

test('the file name wins over the modified time', () => {
  const modified = new Date(2026, 10, 10, 14, 0, 0);
  assert.equal(recordingDateIso('Screen Recording 2026-11-09 184950.mp4', modified), '2026-11-09');
});

test('without a date in the name, the local modified date is used', () => {
  const modified = new Date(2026, 4, 18, 23, 59, 0);
  assert.equal(recordingDateIso('standup.mp4', modified), '2026-05-18');
});
