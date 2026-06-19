import { inputClass } from './ui';

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
    return <p className="text-sm text-slate-500">No speakers detected.</p>;
  }

  return (
    <div className="space-y-2">
      {speakers.map((sp) => (
        <div key={sp} className="flex items-center gap-3">
          <span className="w-28 shrink-0 truncate text-sm text-slate-400">{sp}</span>
          <span className="text-slate-600">→</span>
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
