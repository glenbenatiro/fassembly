import type { JobRecord } from '../../shared/types';
import { Chip, IconButton, ProgressBar } from './ui';
import { canRetry, isRunning, isTerminal, specChips, statusLabel } from '../jobState';

function StatusDot({ job }: { job: JobRecord }) {
  const base = 'grid h-4 w-4 shrink-0 place-items-center rounded-full text-[0.625rem]';
  if (job.status === 'done') {
    return (
      <span className={`${base} bg-pine text-paper-raised`} aria-hidden="true">
        ✓
      </span>
    );
  }
  if (job.status === 'error') {
    return (
      <span className={`${base} bg-brick text-paper-raised`} aria-hidden="true">
        !
      </span>
    );
  }
  if (job.status === 'cancelled') {
    return <span className={`${base} border border-amber bg-amber-wash`} aria-hidden="true" />;
  }
  if (isRunning(job.status)) {
    return <span className={`${base} animate-breathe bg-pine`} aria-hidden="true" />;
  }
  return <span className={`${base} border border-line bg-paper`} aria-hidden="true" />;
}

export function JobRow({
  job,
  selected,
  overridden,
  onSelect,
  onCancel,
  onRetry,
  onRemove,
}: {
  job: JobRecord;
  selected: boolean;
  overridden: boolean;
  onSelect: () => void;
  onCancel: () => void;
  onRetry: () => void;
  onRemove: () => void;
}) {
  const running = isRunning(job.status);
  const chips = specChips(job.spec);

  return (
    <li>
      <div
        role="option"
        aria-selected={selected}
        tabIndex={-1}
        onClick={onSelect}
        className={`group cursor-pointer rounded-xl border px-3 py-2.5 transition-colors ${
          selected
            ? 'border-pine/40 bg-pine-wash'
            : 'border-transparent hover:border-line hover:bg-paper-raised'
        }`}
      >
        <div className="flex items-center gap-2">
          <StatusDot job={job} />
          <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink" title={job.fileName}>
            {job.fileName}
          </span>
          <span className="shrink-0 text-xs text-ink-soft">
            {running && job.percent !== null ? `${Math.round(job.percent)}%` : statusLabel(job.status)}
          </span>

          {/* Actions stay in the layout so rows never reflow on hover. */}
          <span className="flex shrink-0 items-center gap-0.5 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {canRetry(job) && (
              <IconButton
                label={`Retry ${job.fileName}`}
                onClick={(e) => {
                  e.stopPropagation();
                  onRetry();
                }}
              >
                ↻
              </IconButton>
            )}
            <IconButton
              label={
                isTerminal(job.status) ? `Remove ${job.fileName}` : `Stop ${job.fileName}`
              }
              onClick={(e) => {
                e.stopPropagation();
                if (isTerminal(job.status)) onRemove();
                else onCancel();
              }}
            >
              ✕
            </IconButton>
          </span>
        </div>

        <div className="mt-1.5 flex flex-wrap items-center gap-1 pl-6">
          {chips.map((c, i) => (
            <Chip key={i}>{c}</Chip>
          ))}
          {overridden && <Chip tone="accent">custom</Chip>}
        </div>

        {(running || job.status === 'error') && (
          <div className="mt-2 pl-6">
            <ProgressBar
              percent={job.status === 'error' ? 100 : job.percent}
              tone={job.status === 'error' ? 'brick' : 'pine'}
            />
            <p className="mt-1 truncate text-[0.6875rem] text-ink-soft" title={job.message}>
              {job.message}
            </p>
          </div>
        )}
      </div>
    </li>
  );
}
