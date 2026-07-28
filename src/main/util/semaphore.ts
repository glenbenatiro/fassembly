import { CancelledError } from './async';

interface Waiter {
  resolve(release: () => void): void;
  reject(err: unknown): void;
  detach(): void;
}

/**
 * A FIFO counting semaphore with an abortable acquire and a runtime-adjustable
 * limit. No dependency, because this project bundles through Vite and avoids
 * packages that do not bundle cleanly (see the note in src/main/settings.ts).
 */
export class Semaphore {
  private limitValue: number;
  private inUseCount = 0;
  private waiters: Waiter[] = [];

  constructor(limit: number) {
    this.limitValue = Math.max(1, Math.floor(limit));
  }

  get limit(): number {
    return this.limitValue;
  }

  get inUse(): number {
    return this.inUseCount;
  }

  get waiting(): number {
    return this.waiters.length;
  }

  /**
   * Growing dispatches queued waiters immediately. Shrinking does not preempt:
   * running holders keep their slot and `inUse` may sit above `limit` until they
   * finish. Killing work the user already started would be worse than waiting.
   */
  setLimit(next: number): void {
    this.limitValue = Math.max(1, Math.floor(next));
    this.dispatch();
  }

  /**
   * Resolves to an idempotent release function. Rejects with the signal's reason
   * if the caller is aborted while still queued, so a cancelled job neither holds
   * a slot nor claims one later.
   */
  acquire(signal?: AbortSignal): Promise<() => void> {
    if (signal?.aborted) return Promise.reject(signal.reason ?? new CancelledError());
    if (this.inUseCount < this.limitValue) {
      this.inUseCount++;
      return Promise.resolve(this.makeRelease());
    }
    return new Promise<() => void>((resolve, reject) => {
      const waiter: Waiter = { resolve, reject, detach: () => undefined };
      const onAbort = () => {
        const i = this.waiters.indexOf(waiter);
        if (i >= 0) this.waiters.splice(i, 1);
        reject(signal?.reason ?? new CancelledError());
      };
      if (signal) {
        signal.addEventListener('abort', onAbort, { once: true });
        waiter.detach = () => signal.removeEventListener('abort', onAbort);
      }
      this.waiters.push(waiter);
    });
  }

  private makeRelease(): () => void {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      this.inUseCount--;
      this.dispatch();
    };
  }

  private dispatch(): void {
    while (this.inUseCount < this.limitValue && this.waiters.length > 0) {
      const waiter = this.waiters.shift();
      if (!waiter) return;
      waiter.detach();
      this.inUseCount++;
      waiter.resolve(this.makeRelease());
    }
  }
}
