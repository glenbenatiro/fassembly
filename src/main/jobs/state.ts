import type { JobRecord, TranscriptionResult } from '../../shared/types';

/**
 * A job's full state. `record` is the serialisable half that crosses IPC; the
 * rest stays in main because it is either not serialisable (AbortController) or
 * too large to put on an event stream (the transcript).
 */
export interface JobRuntime {
  record: JobRecord;
  /** Replaced on every retry, so an old cancel cannot abort the new attempt. */
  controller: AbortController;
  audioPath: string | null;
  /** Survives a retry: never re-upload (or re-pay for) audio that already landed. */
  uploadUrl: string | null;
  result: TranscriptionResult | null;
  lastEmitAt: number;
  pendingEmit: NodeJS.Timeout | null;
}

export function isTerminal(status: JobRecord['status']): boolean {
  return status === 'done' || status === 'error' || status === 'cancelled';
}
