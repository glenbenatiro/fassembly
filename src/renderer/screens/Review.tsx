import { useMemo, useState } from 'react';
import type { Session } from '../App';
import type { SaveRequest } from '../../shared/types';
import { Button, Card, Field, StepHeader, inputClass } from '../components/ui';
import { SpeakerRemapEditor } from '../components/SpeakerRemapEditor';
import { TranscriptView } from '../components/TranscriptView';

export function Review({
  session,
  update,
  onBack,
}: {
  session: Session;
  update: (patch: Partial<Session>) => void;
  onBack: () => void;
}) {
  const result = session.result;
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const remappedUtterances = useMemo(
    () =>
      (result?.utterances ?? []).map((u) => ({
        ...u,
        speaker: session.remap[u.speaker] || u.speaker,
      })),
    [result, session.remap],
  );

  if (!result) return null;

  const pickFolder = async () => {
    const dir = await window.api.pickDirectory();
    if (dir) update({ outputDir: dir });
  };

  const save = async () => {
    if (!session.outputDir) {
      setError('Choose an output folder first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const participants = session.participants
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const req: SaveRequest = {
        outputDir: session.outputDir,
        sourceFileName: session.fileName,
        model: result.modelUsed || session.model,
        isoDate: session.isoDate,
        participants,
        utterances: remappedUtterances,
      };
      const res = await window.api.saveMarkdown(req);
      update({ savedPath: res.filePath, step: 'done' });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Final pass"
        title="Review and save"
        subtitle={`${result.utterances.length} segments · ${result.speakers.length} speakers`}
      />

      <Card>
        <div className="mb-1 text-[0.8125rem] font-medium text-ink-soft">Speaker names</div>
        <p className="mb-3 text-xs text-ink-faint">
          Rename any that came back wrong. Changes apply across the whole transcript.
        </p>
        <SpeakerRemapEditor
          speakers={result.speakers}
          remap={session.remap}
          onChange={(remap) => update({ remap })}
        />
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Date">
          <input
            className={inputClass}
            value={session.isoDate}
            onChange={(e) => update({ isoDate: e.target.value })}
          />
        </Field>
        <Field label="Participants" hint="Comma separated">
          <input
            className={inputClass}
            value={session.participants}
            onChange={(e) => update({ participants: e.target.value })}
          />
        </Field>
      </div>

      <Field label="Output folder" hint="Defaults to the recording's folder. Pick another to save elsewhere.">
        <div className="flex gap-2">
          <input
            className={inputClass}
            value={session.outputDir}
            placeholder="Choose where to save the markdown"
            onChange={(e) => update({ outputDir: e.target.value })}
          />
          <Button variant="ghost" onClick={pickFolder}>
            Browse
          </Button>
        </div>
      </Field>

      <Card>
        <div className="mb-3 text-[0.8125rem] font-medium text-ink-soft">Preview</div>
        <TranscriptView utterances={remappedUtterances} />
      </Card>

      {error && (
        <div className="rounded-lg border border-brick/30 bg-brick-wash px-4 py-3 text-sm text-brick">
          {error}
        </div>
      )}

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save markdown'}
        </Button>
      </div>
    </div>
  );
}
