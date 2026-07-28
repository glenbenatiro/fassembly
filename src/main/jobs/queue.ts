import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type {
  JobEvent,
  JobRecord,
  JobSpec,
  QueueState,
  TranscriptionResult,
} from '../../shared/types';
import { CancelledError, isAbortError } from '../util/async';
import { Semaphore } from '../util/semaphore';
import { removeWithRetry } from '../util/files';
import { getProvider } from '../stt';
import { classifyError } from './errors';
import { runJob } from './runner';
import { isTerminal, type JobRuntime } from './state';

/** Progress can fire many times a second per job; the UI cannot use that rate. */
const EMIT_THROTTLE_MS = 200;

export interface JobQueueOptions {
  concurrency: number;
  extractConcurrency: number;
  providerId: string;
  getApiKey(): string | null;
  getFilenamePattern(): string;
}

/**
 * Owns every job. The renderer is a view over this, not the source of truth, so
 * progress survives a tab switch or a renderer reload.
 *
 * Two semaphores rather than one: `jobSlots` is the user-facing "how many at
 * once", and `extractSlots` separately caps concurrent ffmpeg processes. Ten
 * simultaneous encodes would peg the CPU and make everything slower, so the
 * network-bound and CPU-bound stages are limited independently.
 */
export class JobQueue {
  private readonly jobs = new Map<string, JobRuntime>();
  private readonly order: string[] = [];
  private readonly listeners = new Set<(e: JobEvent) => void>();
  private readonly jobSlots: Semaphore;
  private readonly extractSlots: Semaphore;
  private readonly pumping = new Set<string>();
  private readonly opts: JobQueueOptions;
  /** Enqueuing does not spend money; pressing Start does. */
  private started = false;

  constructor(opts: JobQueueOptions) {
    this.opts = opts;
    this.jobSlots = new Semaphore(opts.concurrency);
    this.extractSlots = new Semaphore(opts.extractConcurrency);
  }

  // -- subscription -------------------------------------------------------

  on(listener: (e: JobEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: JobEvent): void {
    for (const listener of this.listeners) listener(event);
  }

  // -- reads --------------------------------------------------------------

  list(): JobRecord[] {
    return this.order
      .map((id) => this.jobs.get(id)?.record)
      .filter((r): r is JobRecord => r !== undefined);
  }

  queueState(): QueueState {
    let running = 0;
    let queued = 0;
    for (const job of this.jobs.values()) {
      if (job.record.status === 'queued') queued++;
      else if (!isTerminal(job.record.status)) running++;
    }
    return {
      concurrency: this.jobSlots.limit,
      extractConcurrency: this.extractSlots.limit,
      running,
      queued,
      total: this.jobs.size,
    };
  }

  result(jobId: string): TranscriptionResult | null {
    return this.jobs.get(jobId)?.result ?? null;
  }

  audioPath(jobId: string): string | null {
    return this.jobs.get(jobId)?.audioPath ?? null;
  }

  // -- writes -------------------------------------------------------------

  enqueue(specs: JobSpec[]): string[] {
    const ids: string[] = [];
    for (const spec of specs) {
      const id = randomUUID();
      const job: JobRuntime = {
        record: {
          id,
          spec,
          fileName: path.basename(spec.filePath),
          status: 'queued',
          message: 'Queued',
          percent: null,
          bytesSent: null,
          bytesTotal: null,
          attempt: 1,
          error: null,
          errorKind: null,
          queuedAt: Date.now(),
          startedAt: null,
          finishedAt: null,
          transcriptId: null,
          savedPath: null,
          summary: null,
          hasAudio: false,
        },
        controller: new AbortController(),
        audioPath: null,
        uploadUrl: null,
        result: null,
        lastEmitAt: 0,
        pendingEmit: null,
      };
      this.jobs.set(id, job);
      this.order.push(id);
      ids.push(id);
      this.emit({ type: 'added', job: job.record });
      // Files added while a run is in progress join it rather than waiting for
      // another press of Start.
      if (this.started) this.pump(id);
    }
    this.emitQueueState();
    return ids;
  }

  /** Edit a queued job's settings. Running or finished jobs are left alone. */
  updateSpec(jobId: string, patch: Partial<JobSpec>): void {
    const job = this.jobs.get(jobId);
    if (!job || job.record.status !== 'queued') return;
    job.record.spec = { ...job.record.spec, ...patch };
    this.patch(job, {}, { force: true });
  }

  start(): void {
    this.started = true;
    for (const id of this.order) {
      const job = this.jobs.get(id);
      if (job?.record.status === 'queued') this.pump(id);
    }
    this.emitQueueState();
  }

  cancel(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || isTerminal(job.record.status)) return;
    // One abort covers all three cases: waiting in the semaphore, running
    // ffmpeg, and an in-flight fetch or poll sleep.
    job.controller.abort(new CancelledError());
  }

  cancelAll(): void {
    this.started = false;
    for (const job of this.jobs.values()) {
      if (!isTerminal(job.record.status)) job.controller.abort(new CancelledError());
    }
  }

  retry(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job || !isTerminal(job.record.status) || job.record.status === 'done') return;
    job.controller = new AbortController();
    this.patch(
      job,
      {
        status: 'queued',
        message: 'Queued',
        percent: null,
        error: null,
        errorKind: null,
        attempt: job.record.attempt + 1,
        finishedAt: null,
      },
      { force: true },
    );
    // Retry is an explicit act, so it runs regardless of the Start state.
    this.started = true;
    this.pump(jobId);
    this.emitQueueState();
  }

  remove(jobId: string): void {
    const job = this.jobs.get(jobId);
    if (!job) return;
    if (!isTerminal(job.record.status)) job.controller.abort(new CancelledError());
    if (job.pendingEmit) clearTimeout(job.pendingEmit);
    if (job.audioPath) void removeWithRetry(job.audioPath);
    this.jobs.delete(jobId);
    const i = this.order.indexOf(jobId);
    if (i >= 0) this.order.splice(i, 1);
    this.emit({ type: 'removed', jobId });
    this.emitQueueState();
  }

  /** The memory-release valve: finished jobs hold their whole transcript. */
  clearFinished(): void {
    for (const id of [...this.order]) {
      const job = this.jobs.get(id);
      if (job && isTerminal(job.record.status)) this.remove(id);
    }
  }

  setConcurrency(n: number): void {
    this.jobSlots.setLimit(n);
    this.emitQueueState();
  }

  setExtractConcurrency(n: number): void {
    this.extractSlots.setLimit(n);
    this.emitQueueState();
  }

  /** Stop everything and clean up temp audio. Called on app quit. */
  async shutdown(): Promise<void> {
    this.cancelAll();
    const paths: string[] = [];
    for (const job of this.jobs.values()) {
      if (job.pendingEmit) clearTimeout(job.pendingEmit);
      if (job.audioPath) paths.push(job.audioPath);
    }
    await Promise.race([
      Promise.all(paths.map((p) => removeWithRetry(p, 2))),
      new Promise((resolve) => setTimeout(resolve, 3_000)),
    ]);
  }

  // -- execution ----------------------------------------------------------

  private pump(id: string): void {
    if (this.pumping.has(id)) return;
    this.pumping.add(id);
    void this.run(id).finally(() => this.pumping.delete(id));
  }

  private async run(id: string): Promise<void> {
    const job = this.jobs.get(id);
    if (!job) return;

    let release: (() => void) | null = null;
    try {
      release = await this.jobSlots.acquire(job.controller.signal);

      const apiKey = this.opts.getApiKey();
      if (!apiKey) throw new Error('No API key set. Add your AssemblyAI key in Settings.');

      this.patch(
        job,
        { status: 'extracting', startedAt: job.record.startedAt ?? Date.now(), message: 'Starting' },
        { force: true },
      );

      await runJob(job, {
        extractSlots: this.extractSlots,
        apiKey,
        provider: getProvider(this.opts.providerId),
        filenamePattern: this.opts.getFilenamePattern(),
        patch: (p) => this.patch(job, p),
      });

      this.patch(
        job,
        {
          status: 'done',
          percent: 100,
          message: job.record.savedPath ? 'Saved' : 'Ready to review',
          finishedAt: Date.now(),
        },
        { force: true },
      );
    } catch (err) {
      if (isAbortError(err) || job.controller.signal.aborted) {
        this.patch(
          job,
          {
            status: 'cancelled',
            // Honest about what cancelling can and cannot undo.
            message: job.record.transcriptId
              ? 'Stopped. AssemblyAI may still finish and bill this transcript.'
              : 'Stopped',
            percent: null,
            finishedAt: Date.now(),
          },
          { force: true },
        );
      } else {
        const { message, kind } = classifyError(err);
        this.patch(
          job,
          {
            status: 'error',
            error: message,
            errorKind: kind,
            message,
            percent: null,
            finishedAt: Date.now(),
          },
          { force: true },
        );
      }
    } finally {
      release?.();
      this.emitQueueState();
    }
  }

  // -- event plumbing -----------------------------------------------------

  /**
   * Merge into the record and tell the renderer, at most every 200ms per job.
   * Status changes and terminal states bypass the throttle; a trailing timer
   * guarantees the final value is always delivered.
   */
  private patch(job: JobRuntime, partial: Partial<JobRecord>, opts?: { force?: boolean }): void {
    const statusChanged =
      partial.status !== undefined && partial.status !== job.record.status;
    job.record = { ...job.record, ...partial };

    const force = opts?.force || statusChanged;
    const since = Date.now() - job.lastEmitAt;

    if (force || since >= EMIT_THROTTLE_MS) {
      if (job.pendingEmit) {
        clearTimeout(job.pendingEmit);
        job.pendingEmit = null;
      }
      job.lastEmitAt = Date.now();
      this.emit({ type: 'updated', job: job.record });
      return;
    }

    if (!job.pendingEmit) {
      job.pendingEmit = setTimeout(() => {
        job.pendingEmit = null;
        job.lastEmitAt = Date.now();
        this.emit({ type: 'updated', job: job.record });
      }, EMIT_THROTTLE_MS - since);
    }
  }

  private emitQueueState(): void {
    this.emit({ type: 'queue', state: this.queueState() });
  }
}
