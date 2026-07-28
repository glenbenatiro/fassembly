import type { JobRecord, JobSpec, JobStatus } from '../shared/types';
import { modelShortLabel } from '../shared/models';

export const STAGES: { key: JobStatus; label: string }[] = [
  { key: 'extracting', label: 'Extract' },
  { key: 'uploading', label: 'Upload' },
  { key: 'transcribing', label: 'Transcribe' },
];

/** -1 while queued, 0..2 while running, 3 once finished. */
export function stageIndex(status: JobStatus): number {
  switch (status) {
    case 'queued':
      return -1;
    case 'extracting':
      return 0;
    case 'uploading':
      return 1;
    case 'transcribing':
      return 2;
    default:
      return STAGES.length;
  }
}

export function isTerminal(status: JobStatus): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled';
}

export function isRunning(status: JobStatus): boolean {
  return status === 'extracting' || status === 'uploading' || status === 'transcribing';
}

export type Tone = 'quiet' | 'pine' | 'brick' | 'amber';

export function statusTone(status: JobStatus): Tone {
  if (status === 'done') return 'pine';
  if (status === 'error') return 'brick';
  if (status === 'cancelled') return 'amber';
  if (isRunning(status)) return 'pine';
  return 'quiet';
}

export function statusLabel(status: JobStatus): string {
  switch (status) {
    case 'queued':
      return 'Queued';
    case 'extracting':
      return 'Extracting';
    case 'uploading':
      return 'Uploading';
    case 'transcribing':
      return 'Transcribing';
    case 'done':
      return 'Done';
    case 'error':
      return 'Failed';
    case 'cancelled':
      return 'Stopped';
    default:
      return status;
  }
}

/** The compact settings summary shown on each row. */
export function specChips(spec: JobSpec): string[] {
  const chips = [modelShortLabel(spec.model)];
  chips.push(spec.speakersExpected ? `${spec.speakersExpected} spk` : 'Auto spk');
  if (spec.language) chips.push(spec.language);
  if (spec.speakerNames.length > 0) {
    const shown = spec.speakerNames.slice(0, 2).join(', ');
    const extra = spec.speakerNames.length - 2;
    chips.push(extra > 0 ? `${shown} +${extra}` : shown);
  }
  return chips;
}

/** Retrying an auth failure without fixing the key just fails again. */
export function canRetry(job: JobRecord): boolean {
  return job.status === 'error' || job.status === 'cancelled';
}

export function formatDuration(sec: number | null): string | null {
  if (sec === null) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}
