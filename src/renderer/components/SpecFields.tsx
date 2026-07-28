import type { ModelId } from '../../shared/types';
import { MODELS } from '../../shared/models';
import { Field, inputClass } from './ui';
import { SpeakerNameList } from './SpeakerNameList';

/** The editable half of a JobSpec, as the form holds it (counts stay text). */
export interface SpecValues {
  model: ModelId;
  speakersExpected: string;
  speakerNames: string[];
  language: string; // '' => auto-detect
}

// Universal-3.5 Pro's supported languages. Anything else falls back to
// Universal-2, which covers 99, so leaving this on Auto is usually right.
const LANGUAGES: { code: string; label: string }[] = [
  { code: '', label: 'Auto-detect' },
  { code: 'en', label: 'English' },
  { code: 'es', label: 'Spanish' },
  { code: 'fr', label: 'French' },
  { code: 'de', label: 'German' },
  { code: 'it', label: 'Italian' },
  { code: 'pt', label: 'Portuguese' },
  { code: 'nl', label: 'Dutch' },
  { code: 'ja', label: 'Japanese' },
  { code: 'ko', label: 'Korean' },
  { code: 'zh', label: 'Chinese' },
  { code: 'hi', label: 'Hindi' },
  { code: 'ru', label: 'Russian' },
  { code: 'pl', label: 'Polish' },
  { code: 'tr', label: 'Turkish' },
  { code: 'uk', label: 'Ukrainian' },
  { code: 'vi', label: 'Vietnamese' },
  { code: 'id', label: 'Indonesian' },
  { code: 'tl', label: 'Tagalog' },
];

export function SpecFields({
  values,
  onChange,
  disabled = false,
}: {
  values: SpecValues;
  onChange: (patch: Partial<SpecValues>) => void;
  disabled?: boolean;
}) {
  const modelHint = MODELS.find((m) => m.id === values.model)?.hint;

  return (
    <div className="space-y-4">
      <Field label="Model" hint={modelHint}>
        <select
          className={inputClass}
          value={values.model}
          disabled={disabled}
          onChange={(e) => onChange({ model: e.target.value as ModelId })}
        >
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Expected speakers" hint="Leave blank unless you are certain.">
          <input
            type="number"
            min={1}
            max={20}
            className={inputClass}
            value={values.speakersExpected}
            placeholder="Auto"
            disabled={disabled}
            onChange={(e) => onChange({ speakersExpected: e.target.value })}
          />
        </Field>

        <Field label="Language">
          <select
            className={inputClass}
            value={values.language}
            disabled={disabled}
            onChange={(e) => onChange({ language: e.target.value })}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.code}>
                {l.label}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field
        label="Who is in the room"
        hint="Sent to Speaker Identification, and offered as suggestions when you confirm who is who after transcribing."
      >
        <SpeakerNameList
          names={values.speakerNames}
          disabled={disabled}
          onChange={(speakerNames) => onChange({ speakerNames })}
        />
      </Field>
    </div>
  );
}
