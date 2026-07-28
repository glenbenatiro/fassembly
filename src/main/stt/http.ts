import { isAbortError, jitter, sleep } from '../util/async';

export class HttpError extends Error {
  readonly status: number;
  readonly body: string;
  readonly retryAfterMs: number | null;

  constructor(status: number, body: string, retryAfterMs: number | null) {
    super(`HTTP ${status}${body ? `: ${body.slice(0, 300)}` : ''}`);
    this.name = 'HttpError';
    this.status = status;
    this.body = body;
    this.retryAfterMs = retryAfterMs;
  }

  static async from(res: Response): Promise<HttpError> {
    let body = '';
    try {
      body = await res.text();
    } catch {
      // Body already consumed or the connection died. The status is enough.
    }
    return new HttpError(res.status, body, parseRetryAfter(res.headers.get('retry-after')));
  }
}

export class ProviderError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ProviderError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

/** Retry-After is either delta-seconds or an HTTP date. */
function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const seconds = Number(header);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const when = Date.parse(header);
  return Number.isFinite(when) ? Math.max(0, when - Date.now()) : null;
}

// ---------------------------------------------------------------------------
// Process-wide pacer
// ---------------------------------------------------------------------------
// Ten concurrent jobs polling independently arrive in synchronised bursts and
// can trip AssemblyAI's account-wide rate limit. Serialising every request
// behind a minimum gap costs nothing (the calls are seconds apart in steady
// state) and removes the burst entirely.
const MIN_GAP_MS = 120;
let pacerTail: Promise<void> = Promise.resolve();
let lastCallAt = 0;

function pace(): Promise<void> {
  const next = pacerTail.then(async () => {
    const wait = MIN_GAP_MS - (Date.now() - lastCallAt);
    if (wait > 0) await sleep(wait);
    lastCallAt = Date.now();
  });
  pacerTail = next.catch(() => undefined);
  return next;
}

const RETRYABLE_STATUS = new Set([408, 425, 429, 500, 502, 503, 504]);

export interface AaiRequestOptions {
  apiKey: string;
  signal: AbortSignal;
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  maxAttempts?: number;
  onRetry?(info: { attempt: number; delayMs: number; reason: string }): void;
}

/**
 * A JSON call to AssemblyAI with backoff, 429 handling, and cancellation.
 *
 * Replaces the previous bare fetch, which failed the whole job on the first
 * transient blip. With ten jobs in flight, "transient blip" stops being rare.
 */
export async function aaiJson<T>(url: string, opts: AaiRequestOptions): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 4;
  let backoffMs = 1_000;

  for (let attempt = 1; ; attempt++) {
    opts.signal.throwIfAborted();
    await pace();

    let retryReason: string;
    let waitMs: number;

    try {
      const res = await fetch(url, {
        method: opts.method ?? 'GET',
        headers: {
          authorization: opts.apiKey,
          ...(opts.body !== undefined ? { 'content-type': 'application/json' } : {}),
        },
        body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
        signal: opts.signal,
      });

      if (res.ok) return (await res.json()) as T;

      const httpError = await HttpError.from(res);
      if (!RETRYABLE_STATUS.has(res.status) || attempt >= maxAttempts) throw httpError;

      waitMs = httpError.retryAfterMs ?? jitter(backoffMs);
      retryReason = res.status === 429 ? 'Rate limited' : `Server error ${res.status}`;
    } catch (err) {
      if (isAbortError(err) || opts.signal.aborted) throw err;
      if (err instanceof HttpError) throw err;
      // Network-level failure: DNS, reset connection, undici socket errors.
      if (attempt >= maxAttempts) throw err;
      waitMs = jitter(backoffMs);
      retryReason = 'Network error';
    }

    opts.onRetry?.({ attempt, delayMs: waitMs, reason: retryReason });
    await sleep(waitMs, opts.signal);
    backoffMs = Math.min(30_000, backoffMs * 2);
  }
}
