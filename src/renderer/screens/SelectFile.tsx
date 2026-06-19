import { useState } from 'react';
import type { DragEvent } from 'react';
import type { Session } from '../App';
import { Button, StepHeader } from '../components/ui';

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
    update({ filePath, fileName: name });
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
        step={1}
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
        className={`flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed p-12 text-center transition ${
          dragOver ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-900/40'
        }`}
      >
        <div className="text-3xl">📼</div>
        {session.fileName ? (
          <div>
            <div className="font-medium text-slate-200">{session.fileName}</div>
            <div className="text-xs text-slate-500">Ready to transcribe</div>
          </div>
        ) : (
          <div className="text-slate-400">Drag a file here, or</div>
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
