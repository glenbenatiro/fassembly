import path from 'node:path';
import type { JobRecord } from '../../shared/types';
import type { Semaphore } from '../util/semaphore';
import type { SttProvider } from '../stt/types';
import { extractAudio } from '../ffmpeg';
import { renderMarkdown } from '../markdown';
import { buildFilename } from '../util/filename';
import { tempAudioPath, writeFileUnique } from '../util/files';
import type { JobRuntime } from './state';

export interface RunDeps {
  extractSlots: Semaphore;
  apiKey: string;
  provider: SttProvider;
  filenamePattern: string;
  patch(p: Partial<JobRecord>): void;
}

/**
 * The per-job pipeline: extract -> upload -> transcribe -> optionally save.
 *
 * Every stage is skippable on a retry if its output already exists, so a failure
 * during polling resumes polling rather than re-uploading and re-billing a
 * 500 MB file.
 */
export async function runJob(job: JobRuntime, deps: RunDeps): Promise<void> {
  const { spec } = job.record;
  const signal = job.controller.signal;

  // 1. Extract audio ------------------------------------------------------
  if (!job.uploadUrl && !job.audioPath) {
    signal.throwIfAborted();
    // Acquiring the encoder slot can block behind other jobs. Say so rather than
    // sitting on "Starting" with no explanation.
    deps.patch({ status: 'extracting', percent: null, message: 'Waiting for an encoder slot' });

    // Lock ordering is always jobSlots -> extractSlots, and this one is released
    // before anything else is acquired. Nesting these the other way would deadlock.
    const releaseExtract = await deps.extractSlots.acquire(signal);
    try {
      deps.patch({ status: 'extracting', percent: 0, message: 'Extracting audio' });
      const outPath = tempAudioPath(job.record.id, spec.filePath);
      await extractAudio({
        inputPath: spec.filePath,
        outPath,
        signal,
        onProgress: (p) =>
          deps.patch({ status: 'extracting', percent: p.percent, message: p.message }),
      });
      job.audioPath = outPath;
      deps.patch({ hasAudio: true });
    } finally {
      releaseExtract();
    }
  }

  // 2. Upload -------------------------------------------------------------
  if (!job.uploadUrl) {
    signal.throwIfAborted();
    deps.patch({
      status: 'uploading',
      percent: 0,
      bytesSent: 0,
      bytesTotal: null,
      message: 'Uploading audio',
    });
    job.uploadUrl = await deps.provider.upload({
      apiKey: deps.apiKey,
      audioPath: job.audioPath as string,
      signal,
      onProgress: (sent, total) =>
        deps.patch({
          status: 'uploading',
          percent: total > 0 ? (sent / total) * 100 : null,
          bytesSent: sent,
          bytesTotal: total,
          message: `Uploading ${formatMB(sent)} of ${formatMB(total)}`,
        }),
    });
  }

  // 3. Transcribe ---------------------------------------------------------
  if (!job.result) {
    signal.throwIfAborted();
    deps.patch({
      status: 'transcribing',
      percent: null,
      bytesSent: null,
      bytesTotal: null,
      message: 'Submitting to AssemblyAI',
    });
    job.result = await deps.provider.transcribe({
      apiKey: deps.apiKey,
      uploadUrl: job.uploadUrl,
      options: {
        model: spec.model,
        speakersExpected: spec.speakersExpected,
        speakerNames: spec.speakerNames,
        language: spec.language,
      },
      signal,
      existingTranscriptId: job.record.transcriptId,
      onSubmitted: (transcriptId) => deps.patch({ transcriptId }),
      // AssemblyAI does not report how far along it is, so this stays
      // indeterminate rather than inventing a percentage. Elapsed time is real.
      onPoll: ({ status, elapsedMs, note }) =>
        deps.patch({
          status: 'transcribing',
          percent: null,
          message: note ?? `Transcribing - ${status}, ${formatElapsed(elapsedMs)} elapsed`,
        }),
    });
    deps.patch({
      summary: {
        speakers: job.result.speakers,
        utteranceCount: job.result.utterances.length,
        audioDurationSec: job.result.audioDurationSec,
        modelUsed: job.result.modelUsed,
      },
    });
  }

  // 4. Save ---------------------------------------------------------------
  if (spec.autoSave && spec.outputDir) {
    try {
      const filename = buildFilename(deps.filenamePattern, spec.isoDate, job.record.fileName);
      const markdown = renderMarkdown({
        outputDir: spec.outputDir,
        sourceFileName: job.record.fileName,
        model: job.result.modelUsed || spec.model,
        isoDate: spec.isoDate,
        participants: spec.participants.length ? spec.participants : job.result.speakers,
        utterances: job.result.utterances,
      });
      const savedPath = await writeFileUnique(path.join(spec.outputDir, filename), markdown);
      deps.patch({ savedPath });
    } catch (err) {
      // The transcript is in hand; a save failure must not discard it. Surface
      // the problem and let the user save manually from the detail pane.
      const reason = err instanceof Error ? err.message : String(err);
      deps.patch({ message: `Transcribed, but saving failed: ${reason}` });
    }
  }
}

function formatMB(bytes: number | null): string {
  if (bytes === null) return '?';
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatElapsed(ms: number): string {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
