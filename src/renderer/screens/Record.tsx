import { Card } from '../components/ui';

export function RecordScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[1.6rem] font-medium leading-tight text-ink">
          Record a meeting
        </h1>
        <p className="mt-1.5 text-sm text-ink-soft">
          Capture your screen and audio without leaving the app.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="text-4xl">🎬</div>
        <div className="font-display text-lg font-medium text-ink">Coming soon</div>
        <p className="max-w-sm text-sm text-ink-soft">
          In-app recording (screen plus microphone and system audio) is on the way. For now, record
          with your usual tool and bring the file into the Transcribe tab.
        </p>
        <span className="rounded-full border border-line bg-paper px-3 py-1 text-xs font-medium text-ink-soft">
          Planned
        </span>
      </Card>
    </div>
  );
}
