import type { Step } from '../App';

const STEPS: { key: Step; label: string }[] = [
  { key: 'select', label: 'Select' },
  { key: 'configure', label: 'Configure' },
  { key: 'progress', label: 'Transcribe' },
  { key: 'review', label: 'Review' },
];

const INDEX: Record<Step, number> = {
  select: 0,
  configure: 1,
  progress: 2,
  review: 3,
  done: 4,
};

function Check() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
      <path
        d="M2.5 6.2 L5 8.5 L9.5 3.5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="32"
        className="animate-draw-check"
      />
    </svg>
  );
}

export function Stepper({ step }: { step: Step }) {
  const current = INDEX[step];

  return (
    <nav aria-label="Progress" className="mb-8">
      <ol className="flex items-center">
        {STEPS.map((s, i) => {
          const status = i < current ? 'done' : i === current ? 'active' : 'pending';
          const breathing = status === 'active' && step === 'progress';
          const isLast = i === STEPS.length - 1;

          return (
            <li key={s.key} className="flex flex-1 items-center last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <span
                  className={[
                    'grid h-7 w-7 place-items-center rounded-full text-xs font-semibold transition-colors',
                    status === 'done' && 'bg-pine text-paper-raised',
                    status === 'active' &&
                      'border-2 border-pine bg-paper-raised text-pine-deep',
                    status === 'pending' && 'border border-line bg-paper-raised text-ink-faint',
                    breathing && 'animate-breathe',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {status === 'done' ? <Check /> : i + 1}
                </span>
                <span
                  className={[
                    'text-[0.6875rem] font-medium tracking-wide',
                    status === 'pending' ? 'text-ink-faint' : 'text-ink-soft',
                    status === 'active' && 'text-pine-deep',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                >
                  {s.label}
                </span>
              </div>
              {!isLast && (
                <span
                  className={`mx-2 h-px flex-1 -translate-y-2.5 ${
                    i < current ? 'bg-pine' : 'bg-line'
                  }`}
                />
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
