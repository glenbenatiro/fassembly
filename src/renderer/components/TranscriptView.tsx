import type { Utterance } from '../../shared/types';
import { formatTime } from '../util';

export function TranscriptView({ utterances }: { utterances: Utterance[] }) {
  if (utterances.length === 0) {
    return <p className="text-sm text-slate-500">No transcript content.</p>;
  }

  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-2">
      {utterances.map((u, i) => (
        <div key={i} className="text-sm">
          <div className="flex items-baseline gap-2">
            <span className="font-semibold text-indigo-300">{u.speaker}</span>
            <span className="text-xs text-slate-600">{formatTime(u.start)}</span>
          </div>
          <p className="text-slate-300">{u.text}</p>
        </div>
      ))}
    </div>
  );
}
