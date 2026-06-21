import type { Session } from '../App';
import { Button, Card } from '../components/ui';

// Final "done" screen shown after a transcript is saved.
export function ExportDone({ session, onReset }: { session: Session; onReset: () => void }) {
  const path = session.savedPath;
  if (!path) return null;

  return (
    <div className="space-y-8 text-center">
      <div className="flex flex-col items-center">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-pine-wash">
          <svg width="34" height="34" viewBox="0 0 32 32" fill="none" aria-hidden="true">
            <path
              d="M9 16.5 L14 21.5 L23 10.5"
              stroke="#2F5D50"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeDasharray="32"
              className="animate-draw-check"
            />
          </svg>
        </span>
        <h1 className="mt-4 font-display text-[1.6rem] font-medium text-ink">Transcript saved</h1>
        <p className="mt-1.5 break-all font-mono text-xs text-ink-soft">{path}</p>
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
