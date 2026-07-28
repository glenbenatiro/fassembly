import type { JobStatus } from '../../shared/types';
import { STAGES, stageIndex } from '../jobState';

/**
 * The warm horizontal stepper from the old wizard, repurposed: it used to track
 * the whole app's flow, and now tracks one job's stages inside the detail pane.
 */
export function JobStages({ status }: { status: JobStatus }) {
  const current = stageIndex(status);
  const failed = status === 'error' || status === 'cancelled';

  return (
    <nav aria-label="Job progress">
      <ol className="flex items-start">
        {STAGES.map((stage, i) => {
          const done = current > i;
          const active = current === i;
          return (
            <li key={stage.key} className="flex flex-1 items-start last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  aria-current={active ? 'step' : undefined}
                  className={`grid h-5 w-5 place-items-center rounded-full text-[0.625rem] ${
                    done
                      ? 'bg-pine text-paper-raised'
                      : active
                        ? `bg-paper-raised ring-2 ${failed ? 'ring-brick' : 'ring-pine'} ${failed ? '' : 'animate-breathe'}`
                        : 'border border-line bg-paper-raised text-ink-faint'
                  }`}
                >
                  {done ? (
                    <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true">
                      <path
                        d="M2.5 6.2 L5 8.7 L9.5 3.6"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeDasharray="32"
                        className="animate-draw-check"
                      />
                    </svg>
                  ) : null}
                </span>
                <span
                  className={`text-[0.6875rem] ${active ? 'font-medium text-ink' : 'text-ink-soft'}`}
                >
                  {stage.label}
                </span>
              </div>
              {i < STAGES.length - 1 && (
                <span
                  className={`mx-2 mt-2.5 h-px flex-1 ${done ? 'bg-pine' : 'bg-line'}`}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
