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
      <StepHeader step={2} title="Transcribing" subtitle={session.fileName} />

      {error ? (
        <div className="space-y-4">
          <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-200">
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
                  className={`grid h-6 w-6 place-items-center rounded-full text-xs ${
                    done
                      ? 'bg-emerald-500 text-white'
                      : active
                        ? 'bg-indigo-500 text-white'
                        : 'bg-slate-700 text-slate-400'
                  }`}
                >
                  {done ? '✓' : i + 1}
                </span>
                <span className={active || done ? 'text-white' : 'text-slate-400'}>{s.label}</span>
              </div>
            );
          })}
          <p className="animate-pulse text-xs text-slate-500">
            {session.progress?.message ?? 'Starting...'}
          </p>
        </Card>
      )}
    </div>
  );
}
