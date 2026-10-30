import type { IdentificationStatus, JobRecord, JobStatus, TranscriptionResult } from '../shared/types';

// What a command-line run prints. Progress goes to stderr and results to stdout,
// so `fassembly a.mp4 > paths.txt` or `--json | jq` get only the results.

/** How often an unchanged stage may repeat its progress line. */
export const PROGRESS_INTERVAL_MS = 10_000;

/**
 * Turns the queue's event stream into readable lines. A new stage always
 * prints; progress within a stage prints at most every PROGRESS_INTERVAL_MS,
 * because the queue updates five times a second and a terminal is not a UI.
 */
export class ProgressPrinter {
  private readonly last = new Map<string, { status: JobStatus; message: string; at: number }>();
  private readonly write: (line: string) => void;
  private readonly now: () => number;

  constructor(write: (line: string) => void, now: () => number = Date.now) {
    this.write = write;
    this.now = now;
  }

  update(job: JobRecord): void {
    const prev = this.last.get(job.id);
    const at = this.now();
    const stageChanged = !prev || prev.status !== job.status;
    const due = !!prev && job.message !== prev.message && at - prev.at >= PROGRESS_INTERVAL_MS;
    if (!stageChanged && !due) return;
    this.last.set(job.id, { status: job.status, message: job.message, at });
    this.write(`${job.fileName}: ${job.message}`);
  }
}

export interface CliJobResult {
  file: string;
  status: JobStatus;
  savedPath: string | null;
  /** Why the job failed or could not save. Null when it saved cleanly. */
  error: string | null;
  speakers: string[];
  identification: IdentificationStatus | null;
  identificationNote: string | null;
  audioDurationSec: number | null;
  model: string | null;
}

export function toCliResult(job: JobRecord, result: TranscriptionResult | null): CliJobResult {
  let error: string | null = null;
  if (job.status === 'error') error = job.error ?? job.message;
  else if (job.status === 'cancelled') error = job.message;
  // Done but not saved: the queue keeps the save failure in the message.
  else if (!job.savedPath) error = job.message;

  return {
    file: job.spec.filePath,
    status: job.status,
    savedPath: job.savedPath,
    error,
    speakers: result?.speakers ?? job.summary?.speakers ?? [],
    identification: result?.identification ?? null,
    identificationNote: result?.identificationNote ?? null,
    audioDurationSec: result?.audioDurationSec ?? job.summary?.audioDurationSec ?? null,
    model: result?.modelUsed ?? job.summary?.modelUsed ?? null,
  };
}

/** 0 when every transcript was saved, 1 otherwise. Usage errors (2) never get this far. */
export function exitCodeFor(results: readonly CliJobResult[]): number {
  return results.every((r) => r.savedPath && !r.error) ? 0 : 1;
}

/** Lines for stderr after the run: failures, and speakers that need a human look. */
export function warningLines(results: readonly CliJobResult[]): string[] {
  const lines: string[] = [];
  for (const r of results) {
    const name = baseName(r.file);
    if (r.error) {
      lines.push(`${name}: ${r.status === 'done' ? r.error : `failed - ${r.error}`}`);
      continue;
    }
    const speakers = r.speakers.join(', ');
    if (r.identification === 'uncertain') {
      lines.push(`${name}: check the speaker names (${speakers}). ${r.identificationNote ?? ''}`.trim());
    } else if (r.identification === 'unresolved') {
      lines.push(
        `${name}: speakers could not be named, so they stay as ${speakers}. ${r.identificationNote ?? ''}`.trim(),
      );
    }
  }
  return lines;
}

function baseName(filePath: string): string {
  return filePath.slice(Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\')) + 1);
}
