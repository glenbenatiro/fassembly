import type { Tab } from '../App';

const TABS: { id: Tab; label: string }[] = [
  { id: 'transcribe', label: 'Transcribe' },
  { id: 'record', label: 'Record' },
  { id: 'settings', label: 'Settings' },
];

// Three voices converging into one assembled record.
function Mark() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M5 6 H17 M5 13 H20 M5 20 H17"
        stroke="#2F5D50"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="5" cy="6" r="2.4" fill="#9B4722" />
      <circle cx="5" cy="13" r="2.4" fill="#3A4A7A" />
      <circle cx="5" cy="20" r="2.4" fill="#6D3B5E" />
      <circle cx="21" cy="13" r="3" fill="#2F5D50" />
    </svg>
  );
}

export function Nav({
  tab,
  onChange,
  hasApiKey,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
  hasApiKey: boolean;
}) {
  return (
    <header className="flex items-center justify-between border-b border-line bg-paper-raised/80 px-6 py-3 backdrop-blur">
      <div className="flex items-center gap-2.5">
        <Mark />
        <span className="font-display text-lg font-semibold tracking-tight text-ink">Fassembly</span>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              tab === t.id
                ? 'bg-pine-wash text-pine-deep'
                : 'text-ink-soft hover:bg-paper hover:text-ink'
            }`}
          >
            {t.label}
            {t.id === 'settings' && !hasApiKey && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber align-middle" />
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}
