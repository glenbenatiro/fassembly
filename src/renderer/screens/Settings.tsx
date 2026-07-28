import { useState } from 'react';
import type { ModelId, Settings } from '../../shared/types';
import { MODELS } from '../../shared/models';
import { Button, Card, Field, PageTitle, inputClass } from '../components/ui';

export function SettingsScreen({
  settings,
  onSaved,
}: {
  settings: Settings;
  onSaved: () => Promise<Settings>;
}) {
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState<ModelId>(settings.defaultModel);
  const [outputDir, setOutputDir] = useState(settings.defaultOutputDir);
  const [pattern, setPattern] = useState(settings.filenamePattern);
  const [participants, setParticipants] = useState(settings.defaultParticipants);
  const [extract, setExtract] = useState(settings.extractConcurrency);
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const browseOutputDir = async () => {
    const dir = await window.api.pickDirectory();
    if (dir) setOutputDir(dir);
  };

  const save = async () => {
    setBusy(true);
    setStatus(null);
    try {
      if (apiKey.trim()) {
        await window.api.setApiKey(apiKey.trim());
        setApiKey('');
      }
      await window.api.saveSettings({
        defaultModel: model,
        defaultOutputDir: outputDir,
        filenamePattern: pattern,
        defaultParticipants: participants,
        extractConcurrency: extract,
      });
      await onSaved();
      setStatus('Saved');
    } catch (err) {
      setStatus(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  };

  const clearKey = async () => {
    await window.api.clearApiKey();
    await onSaved();
    setStatus('API key cleared');
  };

  return (
    <div className="space-y-6">
      <PageTitle>Settings</PageTitle>

      <Card className="space-y-3">
        <Field
          label="AssemblyAI API key"
          hint="Stored encrypted on this device with the OS keychain. Sent only to AssemblyAI."
        >
          <input
            type="password"
            className={inputClass}
            value={apiKey}
            placeholder={settings.hasApiKey ? '•••••••• (saved)' : 'Paste your key'}
            onChange={(e) => setApiKey(e.target.value)}
          />
        </Field>
        <div className="flex items-center gap-3 text-sm">
          <span className={settings.hasApiKey ? 'text-pine' : 'text-amber'}>
            {settings.hasApiKey ? '● Key saved' : '● No key set'}
          </span>
          {settings.hasApiKey && (
            <button onClick={clearKey} className="text-ink-soft underline hover:text-ink">
              Clear key
            </button>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <Field label="Default model" hint={MODELS.find((m) => m.id === model)?.hint}>
          <select
            className={inputClass}
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field
          label="Default output folder"
          hint="Leave blank to save each transcript beside its own recording."
        >
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={outputDir}
              placeholder="Next to each recording"
              onChange={(e) => setOutputDir(e.target.value)}
            />
            <Button variant="ghost" onClick={browseOutputDir}>
              Browse
            </Button>
          </div>
        </Field>

        <Field
          label="Filename pattern"
          hint="Tokens: {date} and {name}. Keep {name} so a batch does not collapse into one filename."
        >
          <input className={inputClass} value={pattern} onChange={(e) => setPattern(e.target.value)} />
        </Field>

        <Field label="Default participants" hint="Comma separated. Pre-fills the participants field.">
          <input
            className={inputClass}
            value={participants}
            onChange={(e) => setParticipants(e.target.value)}
          />
        </Field>
      </Card>

      <Card className="space-y-2">
        <Field
          label={`Simultaneous audio extractions: ${extract}`}
          hint="Separate from the parallel-transcription slider. Extraction is CPU-bound, so more than a few at once makes everything slower, not faster."
        >
          <input
            type="range"
            min={1}
            max={4}
            step={1}
            value={extract}
            onChange={(e) => setExtract(Number(e.target.value))}
            className="w-full accent-pine"
          />
        </Field>
      </Card>

      <div className="flex items-center justify-end gap-3">
        {status && <span className="text-sm text-ink-soft">{status}</span>}
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}
