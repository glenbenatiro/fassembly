import type { Utterance } from '../../shared/types';
import { formatTime } from '../util';
import { speakerColor } from '../speakerColors';

export function TranscriptView({ utterances }: { utterances: Utterance[] }) {
  if (utterances.length === 0) {
    return <p className="text-sm text-ink-faint">No transcript content.</p>;
  }

  return (
    <div className="max-h-80 space-y-4 overflow-y-auto pr-1">
      {utterances.map((u, i) => {
        const color = speakerColor(u.speaker);
        return (
          <div
            key={i}
            className="animate-fade-rise border-l-2 pl-3.5"
            style={{ borderColor: color, animationDelay: `${Math.min(i, 10) * 35}ms` }}
          >
            <div className="flex items-baseline gap-2.5">
              <span className="font-display text-sm font-semibold" style={{ color }}>
                {u.speaker}
              </span>
              <span className="font-mono text-[0.6875rem] text-ink-faint">
                {formatTime(u.start)}
              </span>
            </div>
            <p className="mt-0.5 text-[0.9rem] leading-relaxed text-ink">{u.text}</p>
          </div>
        );
      })}
    </div>
  );
}
