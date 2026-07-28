import { useCallback, useEffect, useMemo, useState } from 'react';
import type { JobRecord, JobSpec, QueueState, Settings } from '../shared/types';
import { Nav } from './components/Nav';
import { Queue } from './screens/Queue';
import { JobDetail } from './screens/JobDetail';
import { RecordScreen } from './screens/Record';
import { SettingsScreen } from './screens/Settings';
import type { BatchValues } from './components/BatchDefaults';
import { parentDir, todayIso } from './util';

export type Tab = 'transcribe' | 'record' | 'settings';

/** Batch fields that map onto a JobSpec. */
const BATCH_FIELDS = [
  'model',
  'speakersExpected',
  'speakerNames',
  'language',
  'outputDir',
  'autoSave',
] as const;
type BatchField = (typeof BATCH_FIELDS)[number];

function batchFromSettings(settings: Settings): BatchValues {
  return {
    model: settings.defaultModel,
    speakersExpected: '',
    speakerNames: settings.defaultSpeakerNames,
    language: settings.defaultLanguage,
    outputDir: settings.defaultOutputDir,
    autoSave: settings.autoSave,
  };
}

function parseCount(value: string): number | null {
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Translate a batch-level change into the per-job fields it affects. */
function specPatchFor(
  patch: Partial<BatchValues>,
  fields: readonly BatchField[],
  filePath: string,
): Partial<JobSpec> {
  const out: Partial<JobSpec> = {};
  for (const field of fields) {
    switch (field) {
      case 'model':
        if (patch.model !== undefined) out.model = patch.model;
        break;
      case 'speakersExpected':
        if (patch.speakersExpected !== undefined) {
          out.speakersExpected = parseCount(patch.speakersExpected);
        }
        break;
      case 'speakerNames':
        if (patch.speakerNames !== undefined) {
          out.speakerNames = patch.speakerNames.map((n) => n.trim()).filter(Boolean);
        }
        break;
      case 'language':
        if (patch.language !== undefined) out.language = patch.language || null;
        break;
      case 'outputDir':
        // An empty batch folder means "beside the recording", resolved per file.
        if (patch.outputDir !== undefined) {
          out.outputDir = patch.outputDir || parentDir(filePath);
        }
        break;
      case 'autoSave':
        if (patch.autoSave !== undefined) out.autoSave = patch.autoSave;
        break;
    }
  }
  return out;
}

function toSpec(batch: BatchValues, filePath: string, participants: string): JobSpec {
  return {
    filePath,
    model: batch.model,
    speakersExpected: parseCount(batch.speakersExpected),
    speakerNames: batch.speakerNames.map((n) => n.trim()).filter(Boolean),
    language: batch.language || null,
    outputDir: batch.outputDir || parentDir(filePath),
    isoDate: todayIso(),
    participants: participants.split(',').map((p) => p.trim()).filter(Boolean),
    autoSave: batch.autoSave,
  };
}

export function App() {
  const [tab, setTab] = useState<Tab>('transcribe');
  const [settings, setSettings] = useState<Settings | null>(null);
  const [batch, setBatch] = useState<BatchValues | null>(null);
  const [jobs, setJobs] = useState<JobRecord[]>([]);
  const [queueState, setQueueState] = useState<QueueState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  // Which fields the user changed on an individual row. Those stop following the
  // batch defaults, so editing a default never undoes a deliberate per-file choice.
  const [overrides, setOverrides] = useState<Record<string, string[]>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const refreshSettings = useCallback(async () => {
    const s = await window.api.getSettings();
    setSettings(s);
    return s;
  }, []);

  // The queue lives in the main process, so re-sync on mount. This is what lets
  // a renderer reload (Vite HMR) pick up jobs that are already running.
  useEffect(() => {
    void (async () => {
      const s = await refreshSettings();
      setBatch((prev) => prev ?? batchFromSettings(s));
      const [list, qs] = await Promise.all([window.api.jobsList(), window.api.jobsQueueState()]);
      setJobs(list);
      setQueueState(qs);
      setSelectedId((cur) => cur ?? list[0]?.id ?? null);
    })();
  }, [refreshSettings]);

  useEffect(() => {
    return window.api.onJobEvent((event) => {
      switch (event.type) {
        case 'added':
          setJobs((prev) => [...prev, event.job]);
          setSelectedId((cur) => cur ?? event.job.id);
          break;
        case 'updated':
          setJobs((prev) => prev.map((j) => (j.id === event.job.id ? event.job : j)));
          break;
        case 'removed':
          setJobs((prev) => prev.filter((j) => j.id !== event.jobId));
          setOverrides((prev) => {
            const next = { ...prev };
            delete next[event.jobId];
            return next;
          });
          setSelectedId((cur) => (cur === event.jobId ? null : cur));
          break;
        case 'queue':
          setQueueState(event.state);
          break;
      }
    });
  }, []);

  const selected = useMemo(() => jobs.find((j) => j.id === selectedId) ?? null, [jobs, selectedId]);

  const addFiles = useCallback(
    async (paths: string[]) => {
      if (!batch || !settings) return;
      const specs = paths.map((p) => toSpec(batch, p, settings.defaultParticipants));
      try {
        await window.api.jobsEnqueue(specs);
      } catch (err) {
        setNotice(err instanceof Error ? err.message : String(err));
      }
    },
    [batch, settings],
  );

  const changeBatch = useCallback(
    (patch: Partial<BatchValues>) => {
      setBatch((prev) => (prev ? { ...prev, ...patch } : prev));
      const fields = Object.keys(patch).filter((f): f is BatchField =>
        (BATCH_FIELDS as readonly string[]).includes(f),
      );
      if (fields.length === 0) return;
      for (const job of jobs) {
        if (job.status !== 'queued') continue;
        const owned = overrides[job.id] ?? [];
        const free = fields.filter((f) => !owned.includes(f));
        if (free.length === 0) continue;
        const specPatch = specPatchFor(patch, free, job.spec.filePath);
        if (Object.keys(specPatch).length > 0) void window.api.jobsUpdateSpec(job.id, specPatch);
      }
    },
    [jobs, overrides],
  );

  const updateJobSpec = useCallback((jobId: string, patch: Partial<JobSpec>, fields: string[]) => {
    setOverrides((prev) => ({
      ...prev,
      [jobId]: Array.from(new Set([...(prev[jobId] ?? []), ...fields])),
    }));
    void window.api.jobsUpdateSpec(jobId, patch);
  }, []);

  const resetJobSpec = useCallback(
    (jobId: string) => {
      const job = jobs.find((j) => j.id === jobId);
      if (!job || !batch) return;
      setOverrides((prev) => {
        const next = { ...prev };
        delete next[jobId];
        return next;
      });
      void window.api.jobsUpdateSpec(jobId, specPatchFor(batch, BATCH_FIELDS, job.spec.filePath));
    },
    [jobs, batch],
  );

  const setConcurrency = useCallback((n: number) => {
    setQueueState((prev) => (prev ? { ...prev, concurrency: n } : prev));
    void window.api.saveSettings({ concurrency: n }).then(setSettings);
  }, []);

  const rejectFiles = useCallback((names: string[]) => {
    setNotice(
      names.length === 1
        ? `${names[0]} is not a supported audio or video file.`
        : `${names.length} files were skipped: not supported audio or video.`,
    );
  }, []);

  if (!settings || !batch) {
    return <div className="grid h-full place-items-center bg-paper text-ink-soft">Loading…</div>;
  }

  return (
    <div className="flex h-full flex-col bg-paper text-ink">
      <Nav tab={tab} onChange={setTab} hasApiKey={settings.hasApiKey} />
      <main className="min-h-0 flex-1">
        {tab === 'transcribe' && (
          <div className="flex h-full">
            <aside className="flex w-[26rem] shrink-0 flex-col border-r border-line">
              <Queue
                jobs={jobs}
                queueState={queueState}
                batch={batch}
                overrides={overrides}
                selectedId={selectedId}
                notice={notice}
                hasApiKey={settings.hasApiKey}
                onBatchChange={changeBatch}
                onAddFiles={(paths) => void addFiles(paths)}
                onRejected={rejectFiles}
                onSelect={setSelectedId}
                onStart={() => void window.api.jobsStart()}
                onCancelAll={() => void window.api.jobsCancelAll()}
                onCancel={(id) => void window.api.jobsCancel(id)}
                onRetry={(id) => void window.api.jobsRetry(id)}
                onRemove={(id) => void window.api.jobsRemove(id)}
                onClearFinished={() => void window.api.jobsClearFinished()}
                onConcurrency={setConcurrency}
                onDismissNotice={() => setNotice(null)}
                goSettings={() => setTab('settings')}
              />
            </aside>

            <section className="min-w-0 flex-1 overflow-y-auto">
              {selected ? (
                <div key={selected.id} className="animate-fade-rise">
                  <JobDetail
                    job={selected}
                    overriddenFields={overrides[selected.id] ?? []}
                    roster={batch.speakerNames.filter(Boolean)}
                    onUpdateSpec={(patch, fields) => updateJobSpec(selected.id, patch, fields)}
                    onResetSpec={() => resetJobSpec(selected.id)}
                    onCancel={() => void window.api.jobsCancel(selected.id)}
                    onRetry={() => void window.api.jobsRetry(selected.id)}
                  />
                </div>
              ) : (
                <div className="grid h-full place-items-center px-8 text-center">
                  <div>
                    <p className="font-display text-lg text-ink">Nothing selected</p>
                    <p className="mt-1 text-sm text-ink-soft">
                      {jobs.length === 0
                        ? 'Add some recordings to get started.'
                        : 'Pick a recording on the left to see its settings and transcript.'}
                    </p>
                  </div>
                </div>
              )}
            </section>
          </div>
        )}

        {tab === 'record' && (
          <div className="mx-auto w-full max-w-3xl px-6 py-8">
            <RecordScreen />
          </div>
        )}

        {tab === 'settings' && (
          <div className="mx-auto h-full w-full max-w-3xl overflow-y-auto px-6 py-8">
            <SettingsScreen settings={settings} onSaved={refreshSettings} />
          </div>
        )}
      </main>
    </div>
  );
}
