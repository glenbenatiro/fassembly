import type { TranscribeProgress, TranscriptionResult } from '../../shared/types';

export interface SttOptions {
  model: string;
  speakersExpected: number | null;
  speakerNames: string[];
}

// A speech-to-text backend. Implement this interface to add a new provider, then
// register it in ./index.ts. Swapping providers is then a one-line change.
export interface SttProvider {
  readonly id: string;
  transcribe(
    audioPath: string,
    apiKey: string,
    options: SttOptions,
    onProgress: (e: TranscribeProgress) => void,
  ): Promise<TranscriptionResult>;
}
