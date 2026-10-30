import test from 'node:test';
import assert from 'node:assert/strict';
import type { TranscribeOptions } from './args';
import { buildSpecs, type SpecDefaults } from './specs';

const NO_OPTIONS: TranscribeOptions = {
  names: null,
  speakers: null,
  model: null,
  language: null,
  out: null,
  json: false,
};

const DEFAULTS: SpecDefaults = {
  defaultModel: 'universal-3-5-pro',
  defaultLanguage: '',
  defaultOutputDir: '',
  defaultParticipants: 'Dana, Sebastian',
  defaultSpeakerNames: ['Dana'],
};

test('with no options, the app settings decide, and the file saves beside the recording', () => {
  const [spec] = buildSpecs(['/calls/standup.mp4'], NO_OPTIONS, DEFAULTS, '2026-05-04');
  assert.deepEqual(spec, {
    filePath: '/calls/standup.mp4',
    model: 'universal-3-5-pro',
    speakersExpected: null,
    speakerNames: ['Dana'],
    language: null,
    outputDir: '/calls',
    isoDate: '2026-05-04',
    participants: ['Dana', 'Sebastian'],
    autoSave: true,
  });
});

test('a default save folder from Settings beats the recording folder', () => {
  const defaults = { ...DEFAULTS, defaultOutputDir: 'D:\\Notes', defaultLanguage: 'en' };
  const [spec] = buildSpecs(['C:\\Calls\\a.mp4'], NO_OPTIONS, defaults, '2026-05-04');
  assert.equal(spec.outputDir, 'D:\\Notes');
  assert.equal(spec.language, 'en');
});

test('options override settings, and --names fills both the roster and the participants', () => {
  const options: TranscribeOptions = {
    names: ['Priya', 'Tomas'],
    speakers: 3,
    model: 'universal-2',
    language: 'es',
    out: '/out',
    json: true,
  };
  const specs = buildSpecs(['/a.mp4', '/b.wav'], options, DEFAULTS, '2026-05-04');
  assert.equal(specs.length, 2);
  for (const spec of specs) {
    assert.deepEqual(spec.speakerNames, ['Priya', 'Tomas']);
    assert.deepEqual(spec.participants, ['Priya', 'Tomas']);
    assert.equal(spec.speakersExpected, 3);
    assert.equal(spec.model, 'universal-2');
    assert.equal(spec.language, 'es');
    assert.equal(spec.outputDir, '/out');
  }
});
