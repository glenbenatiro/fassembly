import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Session } from '../App';
import { Button, StepHeader } from '../components/ui';
import { parentDir } from '../util';

export function SelectFile({
  session,
  update,
  onNext,
}: {
  session: Session;
  update: (patch: Partial<Session>) => void;
  onNext: () => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const setFile = (filePath: string | null) => {
    if (!filePath) return;
    const name = filePath.split(/[\\/]/).pop() ?? filePath;
    // Default the save folder to the recording's own folder. The user can still
    // pick another on the Review screen.
    update({ filePath, fileName: name, outputDir: parentDir(filePath) || session.outputDir });
  };

  const onBrowse = async () => setFile(await window.api.pickFile());

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) setFile(window.api.getPathForFile(file));
  };

  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="New transcript"
        title="Choose a recording"
        subtitle="Drop in an audio or video file from a meeting."
      />

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={onDrop}
        className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-12 text-center transition-colors ${
          dragOver ? 'border-pine bg-pine-wash' : 'border-line bg-paper-raised'
        }`}
      >
        <div className="text-3xl">📼</div>
        {session.fileName ? (
          <div>
            <div className="font-medium text-ink">{session.fileName}</div>
            <div className="text-xs text-ink-faint">Ready to transcribe</div>
          </div>
        ) : (
          <div className="text-ink-soft">Drag a file here, or</div>
        )}
        <Button variant="ghost" onClick={onBrowse}>
          Browse files
        </Button>
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} disabled={!session.filePath}>
          Next
        </Button>
      </div>
    </div>
  );
}
