import { useRef } from 'react';
import { IconButton, inputSmClass } from './ui';

export function SpeakerNameList({
  names,
  onChange,
  disabled = false,
}: {
  names: string[];
  onChange: (names: string[]) => void;
  disabled?: boolean;
}) {
  // Stable keys per row. Index keys smear input state when a middle row is
  // removed: every row below shifts up and inherits the wrong value.
  const keys = useRef<number[]>([]);
  const nextKey = useRef(0);
  while (keys.current.length < names.length) keys.current.push(nextKey.current++);
  if (keys.current.length > names.length) keys.current.length = names.length;

  const setAt = (i: number, value: string) => {
    const next = names.slice();
    next[i] = value;
    onChange(next);
  };

  const add = () => {
    keys.current.push(nextKey.current++);
    onChange([...names, '']);
  };

  const remove = (i: number) => {
    keys.current.splice(i, 1);
    onChange(names.filter((_, idx) => idx !== i));
  };

  return (
    <div className="space-y-1.5">
      {names.map((name, i) => (
        <div key={keys.current[i]} className="flex items-center gap-1.5">
          <input
            className={inputSmClass}
            value={name}
            placeholder={`Name ${i + 1}`}
            disabled={disabled}
            onChange={(e) => setAt(i, e.target.value)}
          />
          <IconButton label={`Remove ${name || `name ${i + 1}`}`} disabled={disabled} onClick={() => remove(i)}>
            ✕
          </IconButton>
        </div>
      ))}
      <button
        onClick={add}
        disabled={disabled}
        className="text-[0.8125rem] font-medium text-pine outline-none hover:text-pine-deep focus-visible:ring-2 focus-visible:ring-pine/40 disabled:opacity-40"
      >
        + Add name
      </button>
    </div>
  );
}
