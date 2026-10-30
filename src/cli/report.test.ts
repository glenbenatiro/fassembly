import test from 'node:test';
import assert from 'node:assert/strict';
import type { JobRecord, TranscriptionResult } from '../shared/types';
import {
  exitCodeFor,
  PROGRESS_INTERVAL_MS,
  ProgressPrinter,
  toCliResult,
  warningLines,
} from './report';

function record(partial: Partial<JobRecord>): JobRecord {
  return {
    id: 'job-1',
    spec: {
      filePath: '/calls/standup.mp4',
      model: 'universal-3-5-pro',
      speakersExpected: null,
      speakerNames: ['Dana', 'Sebastian'],
      language: null,
      outputDir: '/calls',
      isoDate: '2026-05-04',
      participants: [],
      autoSave: true,
    },
    fileName: 'standup.mp4',
    status: 'done',
    message: 'Saved',
    percent: 100,
    bytesSent: null,
    bytesTotal: null,
    attempt: 1,
    error: null,
    errorKind: null,
    queuedAt: 0,
    startedAt: 0,
    finishedAt: 0,
    transcriptId: 't1',
    savedPath: '/calls/2026-05-04-standup.md',
    summary: null,
    hasAudio: false,
    ...partial,
  };
}

function result(partial: Partial<TranscriptionResult>): TranscriptionResult {
  return {
    id: 't1',
    text: '',
    utterances: [],
    speakers: ['Dana', 'Sebastian'],
    audioDurationSec: 60,
    modelUsed: 'universal-3-5-pro',
    speakerMapping: { A: 'Dana', B: 'Sebastian' },
    identification: 'success',
    identificationNote: null,
    ...partial,
  };
}

test('progress prints each new stage, and repeats within a stage at most every interval', () => {
  const lines: string[] = [];
  let now = 0;
  const printer = new ProgressPrinter((l) => lines.push(l), () => now);

  printer.update(record({ status: 'uploading', message: 'Uploading 1.0 MB of 9.0 MB' }));
  now += 1_000;
  printer.update(record({ status: 'uploading', message: 'Uploading 2.0 MB of 9.0 MB' }));
  now += PROGRESS_INTERVAL_MS;
  printer.update(record({ status: 'uploading', message: 'Uploading 8.0 MB of 9.0 MB' }));
  now += 1_000;
  printer.update(record({ status: 'transcribing', message: 'Submitting to AssemblyAI' }));

  assert.deepEqual(lines, [
    'standup.mp4: Uploading 1.0 MB of 9.0 MB',
    'standup.mp4: Uploading 8.0 MB of 9.0 MB',
    'standup.mp4: Submitting to AssemblyAI',
  ]);
});

test('a saved transcript exits 0; a failure or an unsaved one exits 1', () => {
  const saved = toCliResult(record({}), result({}));
  assert.equal(saved.error, null);
  assert.equal(exitCodeFor([saved]), 0);

  const failed = toCliResult(
    record({ status: 'error', error: 'AssemblyAI rejected the API key.', savedPath: null }),
    null,
  );
  assert.equal(failed.error, 'AssemblyAI rejected the API key.');

  const unsaved = toCliResult(
    record({ message: 'Transcribed, but saving failed: EACCES', savedPath: null }),
    result({}),
  );
  assert.equal(unsaved.error, 'Transcribed, but saving failed: EACCES');

  assert.equal(exitCodeFor([saved, failed]), 1);
  assert.equal(exitCodeFor([unsaved]), 1);
});

test('warnings flag failures and speakers that need a human look, and nothing else', () => {
  const lines = warningLines([
    toCliResult(record({}), result({})),
    toCliResult(record({ status: 'error', error: 'Network down.', savedPath: null }), null),
    toCliResult(
      record({}),
      result({ identification: 'uncertain', identificationNote: 'Names look swapped.' }),
    ),
    toCliResult(
      record({}),
      result({
        identification: 'unresolved',
        identificationNote: 'Nobody said a name.',
        speakers: ['A', 'B'],
        speakerMapping: null,
      }),
    ),
  ]);
  assert.deepEqual(lines, [
    'standup.mp4: failed - Network down.',
    'standup.mp4: check the speaker names (Dana, Sebastian). Names look swapped.',
    'standup.mp4: speakers could not be named, so they stay as A, B. Nobody said a name.',
  ]);
});
