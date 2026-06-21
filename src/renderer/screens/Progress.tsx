import type { Session } from '../App';
import { Button, Card, StepHeader } from '../components/ui';

const STAGES: { key: string; label: string }[] = [
  { key: 'extract', label: 'Extract audio' },
  { key: 'upload', label: 'Upload to AssemblyAI' },
  { key: 'transcribe', label: 'Transcribe' },
];

export function ProgressScreen({
  session,
  onRetry,
  onBack,
}: {
  session: Session;
  onRetry: () => void;
  onBack: () => void;
}) {
  const stage = session.progress?.stage;
  const error = session.error;
  const currentIndex = STAGES.findIndex((s) => s.key === stage);
  const isDone = stage === 'done';

  return (
    <div className="space-y-6">
      <StepHeader eyebrow="Working" title="Transcribing" subtitle={session.fileName} />

      {error ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-brick/30 bg-brick-wash px-4 py-3 text-sm text-brick">
            {error}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onBack}>
              Back
            </Button>
            <Button onClick={onRetry}>Try again</Button>
          </div>
        </div>
      ) : (
        <Card className="space-y-4">
          {STAGES.map((s, i) => {
            const done = isDone || currentIndex > i;
            const active = !isDone && currentIndex === i;
            return (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs font-semibold ${
                    done
                      ? 'bg-pine text-paper-raised'
                      : active
                        ? 'animate-breathe border-2 border-pine bg-paper-raised text-pine-deep'
                        : 'border border-line bg-paper-raised text-ink-faint'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={active || done ? 'text-ink' : 'text-ink-faint'}>{s.label}</span>
              </div>
            );
          })}
          <p className="animate-pulse text-xs text-ink-faint">
            {session.progress?.message ?? 'Starting…'}
          </p>
        </Card>
      )}
    </div>
  );
}
