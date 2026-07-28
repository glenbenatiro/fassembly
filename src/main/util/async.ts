// Small async helpers shared by the job queue. Deliberately free of Electron
// imports so they can be exercised from a plain node process.

/**
 * Thrown when a job is cancelled. The queue treats this as a clean stop rather
 * than a failure, so a cancelled job does not show up as an error row.
 */
export class CancelledError extends Error {
  constructor(message = 'Cancelled') {
    super(message);
    this.name = 'CancelledError';
  }
}

/** True for our own cancellation and for the DOMException fetch/abort throws. */
export function isAbortError(err: unknown): boolean {
  if (err instanceof CancelledError) return true;
  return err instanceof Error && (err.name === 'AbortError' || err.name === 'CancelledError');
}

/** setTimeout as a promise that rejects on abort instead of hanging. */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(signal?.reason ?? new CancelledError());
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

/**
 * Spread a delay by +/- ratio. Without this, ten jobs started together stay in
 * lockstep and hit AssemblyAI in synchronised bursts for the whole run.
 */
export function jitter(ms: number, ratio = 0.25): number {
  const spread = ms * ratio;
  return Math.max(0, Math.round(ms - spread + Math.random() * spread * 2));
}

export function clampInt(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
