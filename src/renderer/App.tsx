import { useCallback, useEffect, useState } from 'react';
import type { ModelId, Settings, TranscribeProgress, TranscriptionResult } from '../shared/types';
import { Nav } from './components/Nav';
import { SelectFile } from './screens/SelectFile';
import { Configure } from './screens/Configure';
import { ProgressScreen } from './screens/Progress';
import { Review } from './screens/Review';
import { ExportDone } from './screens/Export';
import { RecordScreen } from './screens/Record';
import { SettingsScreen } from './screens/Settings';
import { Stepper } from './components/Stepper';
import { todayIso } from './util';

export type Tab = 'transcribe' | 'record' | 'settings';
export type Step = 'select' | 'configure' | 'progress' | 'review' | 'done';

export interface Session {
  step: Step;
  filePath: string | null;
  fileName: string;
  model: ModelId;
  speakersExpected: string;
  speakerNames: string[];
  running: boolean;
  progress: TranscribeProgress | null;
  error: string | null;
  result: TranscriptionResult | null;
  remap: Record<string, string>;
  participants: string;
  isoDate: string;
  outputDir: string;
  savedPath: string | null;
}

function freshSession(settings: Settings): Session {
  return {
    step: 'select',
    filePath: null,
    fileName: '',
    model: settings.defaultModel,
    speakersExpected: '',
    speakerNames: [],
    running: false,
    progress: null,
    error: null,
    result: null,
    remap: {},
    participants: settings.defaultParticipants,
    isoDate: todayIso(),
    outputDir: settings.defaultOutputDir,
    savedPath: null,
  };
}

export function App() {
  const [tab, setTab] = useState<Tab>('transcribe');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [session, setSession] = useState<Session | null>(null);

  const refreshSettings = useCallback(async () => {
    const s = await window.api.getSettings();
    setSettings(s);
    return s;
  }, []);

  useEffect(() => {
    void refreshSettings().then((s) => setSession((prev) => prev ?? freshSession(s)));
  }, [refreshSettings]);

  const update = useCallback((patch: Partial<Session>) => {
    setSession((prev) => (prev ? { ...prev, ...patch } : prev));
  }, []);

  const resetFlow = useCallback(() => {
    if (settings) setSession(freshSession(settings));
  }, [settings]);

  const runTranscription = useCallback(async () => {
    if (!session || !session.filePath) return;
    update({ running: true, error: null, progress: null, step: 'progress' });

    const unsubscribe = window.api.onProgress((p) => {
      setSession((prev) => (prev ? { ...prev, progress: p } : prev));
    });

    try {
      const parsed = session.speakersExpected
        ? Number.parseInt(session.speakersExpected, 10)
        : NaN;
      const result = await window.api.transcribe({
        filePath: session.filePath,
        model: session.model,
        speakersExpected: Number.isFinite(parsed) && parsed > 0 ? parsed : null,
        speakerNames: session.speakerNames,
      });

      const remap: Record<string, string> = {};
      result.speakers.forEach((s) => {
        remap[s] = s;
      });

      setSession((prev) =>
        prev
          ? {
              ...prev,
              running: false,
              result,
              remap,
              participants: prev.participants || result.speakers.join(', '),
              step: 'review',
            }
          : prev,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setSession((prev) => (prev ? { ...prev, running: false, error: message } : prev));
    } finally {
      unsubscribe();
    }
  }, [session, update]);

  if (!settings || !session) {
    return <div className="grid h-full place-items-center bg-paper text-ink-faint">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <Nav tab={tab} onChange={setTab} hasApiKey={settings.hasApiKey} />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-8">
          {tab === 'transcribe' && (
            <TranscribeFlow
              session={session}
              settings={settings}
              update={update}
              runTranscription={runTranscription}
              resetFlow={resetFlow}
              goSettings={() => setTab('settings')}
            />
          )}
          {tab === 'record' && <RecordScreen />}
          {tab === 'settings' && <SettingsScreen settings={settings} onSaved={refreshSettings} />}
        </div>
      </main>
    </div>
  );
}

function TranscribeFlow({
  session,
  settings,
  update,
  runTranscription,
  resetFlow,
  goSettings,
}: {
  session: Session;
  settings: Settings;
  update: (patch: Partial<Session>) => void;
  runTranscription: () => void;
  resetFlow: () => void;
  goSettings: () => void;
}) {
  const screen = () => {
    switch (session.step) {
      case 'select':
        return (
          <SelectFile session={session} update={update} onNext={() => update({ step: 'configure' })} />
        );
      case 'configure':
        return (
          <Configure
            session={session}
            settings={settings}
            update={update}
            runTranscription={runTranscription}
            onBack={() => update({ step: 'select' })}
            goSettings={goSettings}
          />
        );
      case 'progress':
        return (
          <ProgressScreen
            session={session}
            onRetry={runTranscription}
            onBack={() => update({ step: 'configure', error: null })}
          />
        );
      case 'review':
        return (
          <Review session={session} update={update} onBack={() => update({ step: 'configure' })} />
        );
      case 'done':
        return <ExportDone session={session} onReset={resetFlow} />;
      default:
        return null;
    }
  };

  return (
    <div>
      {session.step !== 'done' && <Stepper step={session.step} />}
      <div key={session.step} className="animate-fade-rise">
        {screen()}
      </div>
    </div>
  );
}
