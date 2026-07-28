import type { JobErrorKind } from '../../shared/types';
import { FfmpegError } from '../ffmpeg';
import { HttpError, ProviderError, TimeoutError } from '../stt/http';

/**
 * Turn whatever went wrong into something a person can act on, plus a kind the
 * UI can use to decide whether retrying is even worth offering.
 */
export function classifyError(err: unknown): { message: string; kind: JobErrorKind } {
  if (err instanceof HttpError) {
    if (err.status === 401 || err.status === 403) {
      return { kind: 'auth', message: 'AssemblyAI rejected the API key. Check it in Settings.' };
    }
    if (err.status === 429) {
      return {
        kind: 'rate-limit',
        message: 'AssemblyAI rate limit reached. Try again shortly, or lower the parallel setting.',
      };
    }
    if (err.status >= 500) {
      return {
        kind: 'network',
        message: `AssemblyAI had a server error (${err.status}). Retry in a moment.`,
      };
    }
    return { kind: 'provider', message: err.message };
  }
  if (err instanceof FfmpegError) return { kind: 'ffmpeg', message: err.message };
  if (err instanceof TimeoutError) return { kind: 'timeout', message: err.message };
  if (err instanceof ProviderError) return { kind: 'provider', message: err.message };

  const message = err instanceof Error ? err.message : String(err);
  if (/fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message)) {
    return {
      kind: 'network',
      message: 'Could not reach AssemblyAI. Check your internet connection and retry.',
    };
  }
  if (/ENOENT/i.test(message)) {
    return { kind: 'input', message: 'The recording could not be read. Was it moved or deleted?' };
  }
  return { kind: 'unknown', message };
}
