import { useState } from 'react';
import type { DragEvent, KeyboardEvent } from 'react';
import { isMediaPath } from '../../shared/media';
import { Button } from './ui';

/**
 * Accepts a whole batch, not one file. Keyboard-operable: the previous version
 * was a bare div with drag handlers, so keyboard users could only reach the
 * Browse button.
 */
export function Dropzone({
  compact,
  onFiles,
  onRejected,
}: {
  compact: boolean;
  onFiles: (paths: string[]) => void;
  onRejected: (names: string[]) => void;
}) {
  const [dragOver, setDragOver] = useState(false);

  const browse = async () => {
    const paths = await window.api.pickFiles();
    if (paths.length > 0) onFiles(paths);
  };

  const handleDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const paths = Array.from(e.dataTransfer.files ?? [])
      .map((f) => window.api.getPathForFile(f))
      .filter((p): p is string => !!p);

    // Filter here rather than letting one stray file reject the whole batch.
    const accepted = paths.filter(isMediaPath);
    const rejected = paths.filter((p) => !isMediaPath(p));
    if (accepted.length > 0) onFiles(accepted);
    if (rejected.length > 0) onRejected(rejected.map((p) => p.split(/[\\/]/).pop() ?? p));
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      void browse();
    }
  };

  const dragProps = {
    onDragOver: (e: DragEvent) => {
      e.preventDefault();
      setDragOver(true);
    },
    onDragLeave: () => setDragOver(false),
    onDrop: handleDrop,
  };

  if (compact) {
    return (
      <div
        {...dragProps}
        role="button"
        tabIndex={0}
        onClick={() => void browse()}
        onKeyDown={handleKeyDown}
        className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed px-3 py-2.5 text-sm transition-colors outline-none focus-visible:ring-2 focus-visible:ring-pine/40 ${
          dragOver
            ? 'border-pine bg-pine-wash text-pine-deep'
            : 'border-line bg-paper-raised text-ink-soft hover:border-ink-faint'
        }`}
      >
        <span aria-hidden="true">＋</span> Add recordings
      </div>
    );
  }

  return (
    <div
      {...dragProps}
      role="button"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={`flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-10 text-center transition-colors outline-none focus-visible:ring-2 focus-visible:ring-pine/40 ${
        dragOver ? 'border-pine bg-pine-wash' : 'border-line bg-paper-raised'
      }`}
      onClick={() => void browse()}
    >
      <div className="text-3xl" aria-hidden="true">
        📼
      </div>
      <div className="text-sm text-ink-soft">Drop recordings here</div>
      <Button
        variant="ghost"
        onClick={(e) => {
          e.stopPropagation();
          void browse();
        }}
      >
        Browse files
      </Button>
      <p className="text-xs text-ink-soft">Audio or video. Add as many as you like.</p>
    </div>
  );
}
