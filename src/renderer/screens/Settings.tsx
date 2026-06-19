import { useState } from 'react';
import type { ModelId, Settings } from '../../shared/types';
import { Button, Card, Field, inputClass } from '../components/ui';

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
      <h1 className="text-xl font-semibold text-white">Settings</h1>

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
          <span className={settings.hasApiKey ? 'text-emerald-400' : 'text-amber-400'}>
            {settings.hasApiKey ? '● Key saved' : '● No key set'}
          </span>
          {settings.hasApiKey && (
            <button onClick={clearKey} className="text-slate-400 underline hover:text-white">
              Clear key
            </button>
          )}
        </div>
      </Card>

      <Card className="space-y-4">
        <Field label="Default model">
          <select
            className={inputClass}
            value={model}
            onChange={(e) => setModel(e.target.value as ModelId)}
          >
            <option value="universal-3-pro">Universal-3 Pro (recommended)</option>
            <option value="universal-3-5-pro">Universal-3.5 Pro (preview)</option>
            <option value="universal-2">Universal-2</option>
          </select>
        </Field>

        <Field label="Default output folder" hint="Where transcripts are saved unless you change it per save.">
          <div className="flex gap-2">
            <input
              className={inputClass}
              value={outputDir}
              placeholder="No folder set"
              onChange={(e) => setOutputDir(e.target.value)}
            />
            <Button variant="ghost" onClick={browseOutputDir}>
              Browse
            </Button>
          </div>
        </Field>

        <Field label="Filename pattern" hint="Token: {date}">
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

      <div className="flex items-center justify-end gap-3">
        {status && <span className="text-sm text-slate-400">{status}</span>}
        <Button onClick={save} disabled={busy}>
          {busy ? 'Saving...' : 'Save settings'}
        </Button>
      </div>
    </div>
  );
}
