import { inputClass } from './ui';
import { speakerColor } from '../speakerColors';

export function SpeakerRemapEditor({
  speakers,
  remap,
  onChange,
}: {
  speakers: string[];
  remap: Record<string, string>;
  onChange: (remap: Record<string, string>) => void;
}) {
  if (speakers.length === 0) {
    return <p className="text-sm text-ink-faint">No speakers detected.</p>;
  }

  return (
    <div className="space-y-2">
      {speakers.map((sp) => (
        <div key={sp} className="flex items-center gap-3">
          <span className="flex w-28 shrink-0 items-center gap-2">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: speakerColor(sp) }}
              aria-hidden="true"
            />
            <span className="truncate text-sm text-ink-soft">{sp}</span>
          </span>
          <span className="text-ink-faint">→</span>
          <input
            className={inputClass}
            value={remap[sp] ?? sp}
            onChange={(e) => onChange({ ...remap, [sp]: e.target.value })}
          />
        </div>
      ))}
    </div>
  );
}
