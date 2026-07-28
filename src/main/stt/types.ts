import type { ModelId, TranscriptionResult } from '../../shared/types';

export interface SttOptions {
  model: ModelId;
  speakersExpected: number | null;
  speakerNames: string[];
  language: string | null; // null => let the provider detect it
}

export interface UploadArgs {
  apiKey: string;
  audioPath: string;
  signal: AbortSignal;
  onProgress(sent: number, total: number): void;
}

export interface PollInfo {
  status: string;
  elapsedMs: number;
  /** Set when the provider is backing off, so the UI can explain the pause. */
  note?: string;
}

export interface TranscribeArgs {
  apiKey: string;
  uploadUrl: string;
  options: SttOptions;
  signal: AbortSignal;
  onSubmitted(transcriptId: string): void;
  onPoll(info: PollInfo): void;
  /** Resume polling an already-submitted transcript instead of resubmitting. */
  existingTranscriptId?: string | null;
  maxWallClockMs?: number;
}

// A speech-to-text backend. Implement this interface to add a new provider, then
// register it in ./index.ts.
//
// Upload and transcribe are separate calls so the queue can label the two stages
// distinctly, and so a retry after a polling failure can skip re-uploading (and
// re-paying for) audio that already landed.
export interface SttProvider {
  readonly id: string;
  upload(args: UploadArgs): Promise<string>;
  transcribe(args: TranscribeArgs): Promise<TranscriptionResult>;
}
