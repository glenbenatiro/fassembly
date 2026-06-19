import type { Session } from '../App';
import { Button, Card } from '../components/ui';

// Final "done" screen shown after a transcript is saved.
export function ExportDone({ session, onReset }: { session: Session; onReset: () => void }) {
  const path = session.savedPath;
  if (!path) return null;

  return (
    <div className="space-y-6">
      <div className="text-center">
        <div className="text-4xl">✅</div>
        <h1 className="mt-2 text-xl font-semibold text-white">Transcript saved</h1>
        <p className="mt-1 break-all text-sm text-slate-400">{path}</p>
      </div>

      <Card className="flex flex-wrap justify-center gap-3">
        <Button variant="ghost" onClick={() => window.api.openPath(path)}>
          Open file
        </Button>
        <Button variant="ghost" onClick={() => window.api.showInFolder(path)}>
          Show in folder
        </Button>
        <Button onClick={onReset}>New transcription</Button>
      </Card>
    </div>
  );
}
