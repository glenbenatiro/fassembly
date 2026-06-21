import type { Session } from '../App';
import type { ModelId, Settings } from '../../shared/types';
import { Button, Card, Field, StepHeader, inputClass } from '../components/ui';
import { SpeakerNameList } from '../components/SpeakerNameList';

const MODELS: { id: ModelId; label: string }[] = [
  { id: 'universal-3-pro', label: 'Universal-3 Pro (recommended)' },
  { id: 'universal-3-5-pro', label: 'Universal-3.5 Pro (preview)' },
  { id: 'universal-2', label: 'Universal-2' },
];

export function Configure({
  session,
  settings,
  update,
  runTranscription,
  onBack,
  goSettings,
}: {
  session: Session;
  settings: Settings;
  update: (patch: Partial<Session>) => void;
  runTranscription: () => void;
  onBack: () => void;
  goSettings: () => void;
}) {
  return (
    <div className="space-y-6">
      <StepHeader
        eyebrow="Before we start"
        title="Set up the transcription"
        subtitle="These match the options you would pick in the AssemblyAI web app."
      />

      {!settings.hasApiKey && (
        <div className="rounded-lg border border-amber/30 bg-amber-wash px-4 py-3 text-sm text-amber">
          No AssemblyAI API key yet.{' '}
          <button
            onClick={goSettings}
            className="font-medium text-pine underline hover:text-pine-deep"
          >
            Add it in Settings
          </button>{' '}
          to transcribe.
        </div>
      )}

      <Card className="space-y-4">
        <Field label="Model">
          <select
            className={inputClass}
            value={session.model}
            onChange={(e) => update({ model: e.target.value as ModelId })}
          >
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Expected speakers" hint="Optional. Improves accuracy when you know the count.">
          <input
            type="number"
            min={1}
            max={20}
            className={inputClass}
            value={session.speakersExpected}
            placeholder="e.g. 3"
            onChange={(e) => update({ speakersExpected: e.target.value })}
          />
        </Field>

        <Field
          label="Speaker names"
          hint="Optional. Passed to Speaker Identification so the transcript comes back named."
        >
          <SpeakerNameList
            names={session.speakerNames}
            onChange={(names) => update({ speakerNames: names })}
          />
        </Field>
      </Card>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={runTranscription} disabled={!settings.hasApiKey || session.running}>
          {session.running ? 'Working…' : 'Transcribe'}
        </Button>
      </div>
    </div>
  );
}
