import type { KeyboardEvent } from 'react';
import type { JobRecord, QueueState } from '../../shared/types';
import { Banner, Button, IconButton } from '../components/ui';
import { Dropzone } from '../components/Dropzone';
import { BatchDefaults, type BatchValues } from '../components/BatchDefaults';
import { JobRow } from '../components/JobRow';
import { isTerminal } from '../jobState';

export function Queue({
  jobs,
  queueState,
  batch,
  overrides,
  selectedId,
  notice,
  hasApiKey,
  onBatchChange,
  onAddFiles,
  onRejected,
  onSelect,
  onStart,
  onCancelAll,
  onCancel,
  onRetry,
  onRemove,
  onClearFinished,
  onConcurrency,
  onDismissNotice,
  goSettings,
}: {
  jobs: JobRecord[];
  queueState: QueueState | null;
  batch: BatchValues;
  overrides: Record<string, string[]>;
  selectedId: string | null;
  notice: string | null;
  hasApiKey: boolean;
  onBatchChange: (patch: Partial<BatchValues>) => void;
  onAddFiles: (paths: string[]) => void;
  onRejected: (names: string[]) => void;
  onSelect: (id: string) => void;
  onStart: () => void;
  onCancelAll: () => void;
  onCancel: (id: string) => void;
  onRetry: (id: string) => void;
  onRemove: (id: string) => void;
  onClearFinished: () => void;
  onConcurrency: (n: number) => void;
  onDismissNotice: () => void;
  goSettings: () => void;
}) {
  const running = queueState?.running ?? 0;
  const queued = queueState?.queued ?? 0;
  const finished = jobs.filter((j) => isTerminal(j.status)).length;
  const anyActive = running > 0 || queued > 0;

  // Arrow keys move the selection, so the whole queue is usable without a mouse.
  const handleListKeys = (e: KeyboardEvent) => {
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    e.preventDefault();
    if (jobs.length === 0) return;
    const at = jobs.findIndex((j) => j.id === selectedId);
    const next =
      e.key === 'ArrowDown'
        ? Math.min(jobs.length - 1, at + 1)
        : Math.max(0, (at === -1 ? 0 : at) - 1);
    onSelect(jobs[next].id);
  };

  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <Dropzone compact={jobs.length > 0} onFiles={onAddFiles} onRejected={onRejected} />

      {!hasApiKey && (
        <Banner tone="amber">
          No AssemblyAI API key yet.{' '}
          <button onClick={goSettings} className="font-medium text-pine underline hover:text-pine-deep">
            Add it in Settings
          </button>{' '}
          to transcribe.
        </Banner>
      )}

      {notice && (
        <div className="flex items-start gap-2 rounded-lg border border-amber/30 bg-amber-wash px-3 py-2 text-xs text-amber">
          <span className="flex-1">{notice}</span>
          <IconButton label="Dismiss" onClick={onDismissNotice}>
            ✕
          </IconButton>
        </div>
      )}

      <BatchDefaults values={batch} onChange={onBatchChange} disabled={false} />

      {jobs.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-1 text-center">
          <p className="text-sm text-ink-soft">Nothing queued yet.</p>
          <p className="text-xs text-ink-soft">
            Drop in as many recordings as you like, then press Transcribe.
          </p>
        </div>
      ) : (
        <ul
          role="listbox"
          aria-label="Transcription queue"
          tabIndex={0}
          onKeyDown={handleListKeys}
          className="min-h-0 flex-1 space-y-0.5 overflow-y-auto rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-pine/40"
        >
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              selected={job.id === selectedId}
              overridden={(overrides[job.id]?.length ?? 0) > 0}
              onSelect={() => onSelect(job.id)}
              onCancel={() => onCancel(job.id)}
              onRetry={() => onRetry(job.id)}
              onRemove={() => onRemove(job.id)}
            />
          ))}
        </ul>
      )}

      <div className="space-y-2.5 border-t border-line pt-3">
        <div className="flex items-center justify-between text-xs text-ink-soft">
          <span aria-live="polite">
            {running} running · {queued} queued
            {finished > 0 && ` · ${finished} finished`}
          </span>
          {finished > 0 && (
            <button
              onClick={onClearFinished}
              className="font-medium text-pine outline-none hover:text-pine-deep focus-visible:ring-2 focus-visible:ring-pine/40"
            >
              Clear finished
            </button>
          )}
        </div>

        <label className="block">
          <span className="mb-1 flex items-baseline justify-between text-xs text-ink-soft">
            <span>At once</span>
            <span className="font-mono text-ink">{queueState?.concurrency ?? 3}</span>
          </span>
          <input
            type="range"
            min={1}
            max={10}
            step={1}
            value={queueState?.concurrency ?? 3}
            onChange={(e) => onConcurrency(Number(e.target.value))}
            className="w-full accent-pine"
          />
          <span className="mt-1 block text-[0.6875rem] text-ink-soft">
            Uploads are usually the bottleneck. Raise it if your connection is fast.
          </span>
        </label>

        <div className="flex gap-2">
          <Button
            className="flex-1"
            onClick={onStart}
            disabled={!hasApiKey || queued === 0}
            title={queued === 0 ? 'Nothing queued' : undefined}
          >
            Transcribe {queued > 0 && `(${queued})`}
          </Button>
          {anyActive && (
            <Button variant="ghost" onClick={onCancelAll}>
              Stop all
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
