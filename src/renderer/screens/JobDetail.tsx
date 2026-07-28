import { useEffect, useMemo, useRef, useState } from 'react';
import type { JobRecord, JobSpec, TranscriptionResult } from '../../shared/types';
import { modelLabel } from '../../shared/models';
import { Banner, Button, Card, Eyebrow, Field, PageTitle, ProgressBar, inputClass } from '../components/ui';
import { SpecFields, type SpecValues } from '../components/SpecFields';
import { JobStages } from '../components/JobStages';
import { AssignVoices } from '../components/AssignVoices';
import { TranscriptView } from '../components/TranscriptView';
import { formatDuration, isRunning, statusLabel } from '../jobState';

export function JobDetail({
  job,
  overriddenFields,
  roster,
  onUpdateSpec,
  onResetSpec,
  onCancel,
  onRetry,
}: {
  job: JobRecord;
  overriddenFields: string[];
  roster: string[];
  onUpdateSpec: (patch: Partial<JobSpec>, fields: string[]) => void;
  onResetSpec: () => void;
  onCancel: () => void;
  onRetry: () => void;
}) {
  const [result, setResult] = useState<TranscriptionResult | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [remap, setRemap] = useState<Record<string, string>>({});
  const [participants, setParticipants] = useState('');
  const [isoDate, setIsoDate] = useState(job.spec.isoDate);
  const [outputDir, setOutputDir] = useState(job.spec.outputDir);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [savedPath, setSavedPath] = useState<string | null>(job.savedPath);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Reset the per-job editing state whenever the selection changes, and move
  // focus so keyboard and screen-reader users land in the new pane. Keyed on
  // job.id alone on purpose: this seeds the form, so re-running it on every
  // job update would overwrite what the user is typing.
  useEffect(() => {
    setResult(null);
    setAudioUrl(null);
    setRemap({});
    setParticipants(job.spec.participants.join(', '));
    setIsoDate(job.spec.isoDate);
    setOutputDir(job.spec.outputDir);
    setSaveError(null);
    setSavedPath(job.savedPath);
    headingRef.current?.focus();
  }, [job.id]);

  // The transcript is fetched on demand rather than pushed on the event stream,
  // which would mean re-serialising thousands of utterances on every tick.
  useEffect(() => {
    if (job.status !== 'done') return;
    let cancelled = false;
    void (async () => {
      const [r, url] = await Promise.all([
        window.api.jobsResult(job.id),
        job.hasAudio ? window.api.jobsAudioUrl(job.id) : Promise.resolve(null),
      ]);
      if (cancelled) return;
      setResult(r);
      setAudioUrl(url);
      if (r) {
        // When identification succeeds the names are already in
        // utterances[].speaker; the mapping covers any label left as-is.
        const named = (s: string) => r.speakerMapping?.[s] ?? s;
        setRemap(Object.fromEntries(r.speakers.map((s) => [s, named(s)])));
        setParticipants((p) => p || r.speakers.map(named).join(', '));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [job.id, job.status, job.hasAudio]);

  const remapped = useMemo(
    () => (result?.utterances ?? []).map((u) => ({ ...u, speaker: remap[u.speaker] || u.speaker })),
    [result, remap],
  );

  const specValues: SpecValues = {
    model: job.spec.model,
    speakersExpected: job.spec.speakersExpected ? String(job.spec.speakersExpected) : '',
    speakerNames: job.spec.speakerNames,
    language: job.spec.language ?? '',
  };

  const applySpec = (patch: Partial<SpecValues>) => {
    const specPatch: Partial<JobSpec> = {};
    const fields: string[] = [];
    if (patch.model !== undefined) {
      specPatch.model = patch.model;
      fields.push('model');
    }
    if (patch.speakersExpected !== undefined) {
      const n = Number.parseInt(patch.speakersExpected, 10);
      specPatch.speakersExpected = Number.isFinite(n) && n > 0 ? n : null;
      fields.push('speakersExpected');
    }
    if (patch.speakerNames !== undefined) {
      specPatch.speakerNames = patch.speakerNames;
      fields.push('speakerNames');
    }
    if (patch.language !== undefined) {
      specPatch.language = patch.language || null;
      fields.push('language');
    }
    onUpdateSpec(specPatch, fields);
  };

  const save = async () => {
    if (!result) return;
    if (!outputDir) {
      setSaveError('Choose a folder to save into.');
      return;
    }
    setSaving(true);
    setSaveError(null);
    try {
      const res = await window.api.saveMarkdown({
        outputDir,
        sourceFileName: job.fileName,
        model: result.modelUsed || job.spec.model,
        isoDate,
        participants: participants.split(',').map((s) => s.trim()).filter(Boolean),
        utterances: remapped,
      });
      setSavedPath(res.filePath);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const pickFolder = async () => {
    const dir = await window.api.pickDirectory();
    if (dir) setOutputDir(dir);
  };

  return (
    <div className="space-y-5 p-6">
      <header>
        <Eyebrow>{statusLabel(job.status)}</Eyebrow>
        <PageTitle className="mt-1 break-all outline-none">
          <span ref={headingRef} tabIndex={-1}>
            {job.fileName}
          </span>
        </PageTitle>
        <p className="mt-1 text-sm text-ink-soft">
          {modelLabel(job.spec.model)}
          {job.summary?.modelUsed && job.summary.modelUsed !== job.spec.model && (
            <> · ran as {job.summary.modelUsed}</>
          )}
          {job.summary?.audioDurationSec != null && (
            <> · {formatDuration(job.summary.audioDurationSec)}</>
          )}
          {job.attempt > 1 && <> · attempt {job.attempt}</>}
        </p>
      </header>

      {job.status !== 'queued' && <JobStages status={job.status} />}

      {/* Queued: still editable ------------------------------------------ */}
      {job.status === 'queued' && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-[0.8125rem] font-medium text-ink-soft">Settings for this file</span>
            {overriddenFields.length > 0 ? (
              <button
                onClick={onResetSpec}
                className="text-xs font-medium text-pine outline-none hover:text-pine-deep focus-visible:ring-2 focus-visible:ring-pine/40"
              >
                Reset to batch defaults
              </button>
            ) : (
              <span className="text-xs text-ink-soft">Using batch defaults</span>
            )}
          </div>
          <SpecFields values={specValues} onChange={applySpec} />
        </Card>
      )}

      {/* Running ---------------------------------------------------------- */}
      {isRunning(job.status) && (
        <Card className="space-y-3">
          <ProgressBar percent={job.percent} />
          <p className="text-sm text-ink-soft" aria-live="polite">
            {job.message}
          </p>
          <Button variant="ghost" onClick={onCancel}>
            Stop this one
          </Button>
        </Card>
      )}

      {/* Failed or stopped ------------------------------------------------ */}
      {(job.status === 'error' || job.status === 'cancelled') && (
        <div className="space-y-3">
          <Banner tone={job.status === 'error' ? 'brick' : 'amber'}>
            {job.error ?? job.message}
          </Banner>
          <Button onClick={onRetry}>Try again</Button>
        </div>
      )}

      {/* Done ------------------------------------------------------------- */}
      {job.status === 'done' && !result && <p className="text-sm text-ink-soft">Loading transcript…</p>}

      {job.status === 'done' && result && (
        <>
          <Card>
            <div className="mb-1 text-[0.8125rem] font-medium text-ink-soft">Assign voices</div>
            <p className="mb-3 text-xs text-ink-soft">
              {audioUrl
                ? 'Play a sample to check who is who. Names apply to the preview and the saved file.'
                : 'Names apply to the preview and the saved file.'}
            </p>
            <AssignVoices
              speakers={result.speakers}
              utterances={result.utterances}
              roster={roster}
              remap={remap}
              audioUrl={audioUrl}
              identification={result.identification}
              note={result.identificationNote}
              onChange={setRemap}
            />
          </Card>

          <Card>
            <div className="mb-3 text-[0.8125rem] font-medium text-ink-soft">
              Preview · {result.utterances.length} segments
            </div>
            <TranscriptView utterances={remapped} />
          </Card>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Date">
              <input className={inputClass} value={isoDate} onChange={(e) => setIsoDate(e.target.value)} />
            </Field>
            <Field label="Participants" hint="Comma separated">
              <input
                className={inputClass}
                value={participants}
                onChange={(e) => setParticipants(e.target.value)}
              />
            </Field>
          </div>

          <Field label="Output folder" hint="Defaults to the recording's own folder.">
            <div className="flex gap-2">
              <input
                className={inputClass}
                value={outputDir}
                placeholder="Choose where to save the markdown"
                onChange={(e) => setOutputDir(e.target.value)}
              />
              <Button variant="ghost" onClick={pickFolder}>
                Browse
              </Button>
            </div>
          </Field>

          {saveError && <Banner tone="brick">{saveError}</Banner>}

          {savedPath ? (
            <Card className="space-y-3">
              <div>
                <div className="text-[0.8125rem] font-medium text-ink">Saved</div>
                <div className="mt-0.5 break-all font-mono text-xs text-ink-soft">{savedPath}</div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button variant="ghost" onClick={() => void window.api.openPath(savedPath)}>
                  Open file
                </Button>
                <Button variant="ghost" onClick={() => void window.api.showInFolder(savedPath)}>
                  Show in folder
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : 'Save again'}
                </Button>
              </div>
            </Card>
          ) : (
            <div className="flex justify-end">
              <Button onClick={save} disabled={saving}>
                {saving ? 'Saving…' : 'Save markdown'}
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
