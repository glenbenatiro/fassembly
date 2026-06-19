import type { Tab } from '../App';

const TABS: { id: Tab; label: string }[] = [
  { id: 'transcribe', label: 'Transcribe' },
  { id: 'record', label: 'Record' },
  { id: 'settings', label: 'Settings' },
];

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
    <header className="flex items-center justify-between border-b border-slate-800 bg-slate-900/60 px-6 py-3">
      <div className="flex items-center gap-2">
        <span className="text-lg">🎙️</span>
        <span className="font-semibold text-white">Meeting Transcriber</span>
      </div>
      <nav className="flex items-center gap-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
              tab === t.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label}
            {t.id === 'settings' && !hasApiKey && (
              <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-amber-400 align-middle" />
            )}
          </button>
        ))}
      </nav>
    </header>
  );
}
