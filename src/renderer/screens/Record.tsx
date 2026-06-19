import { Card } from '../components/ui';

export function RecordScreen() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-white">Record a meeting</h1>
        <p className="mt-1 text-sm text-slate-400">
          Capture your screen and audio without leaving the app.
        </p>
      </div>

      <Card className="flex flex-col items-center gap-3 py-12 text-center">
        <div className="text-4xl">🎬</div>
        <div className="text-lg font-medium text-white">Coming soon</div>
        <p className="max-w-sm text-sm text-slate-400">
          In-app recording (screen plus microphone and system audio) is on the way. For now, record
          with your usual tool and bring the file into the Transcribe tab.
        </p>
        <span className="rounded-full bg-slate-800 px-3 py-1 text-xs text-slate-400">Planned</span>
      </Card>
    </div>
  );
}
