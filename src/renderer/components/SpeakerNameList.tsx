import { Button, inputClass } from './ui';

export function SpeakerNameList({
  names,
  onChange,
}: {
  names: string[];
  onChange: (names: string[]) => void;
}) {
  const setAt = (i: number, value: string) => {
    const next = names.slice();
    next[i] = value;
    onChange(next);
  };

  const add = () => onChange([...names, '']);
  const remove = (i: number) => onChange(names.filter((_, idx) => idx !== i));

  return (
    <div className="space-y-2">
      {names.map((name, i) => (
        <div key={i} className="flex gap-2">
          <input
            className={inputClass}
            value={name}
            placeholder={`Speaker ${i + 1} name`}
            onChange={(e) => setAt(i, e.target.value)}
          />
          <Button variant="ghost" onClick={() => remove(i)} aria-label="Remove name">
            ✕
          </Button>
        </div>
      ))}
      <button onClick={add} className="text-sm text-indigo-400 hover:text-indigo-300">
        + Add name
      </button>
    </div>
  );
}
