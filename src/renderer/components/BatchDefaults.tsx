import { useState } from 'react';
import { Button, Chip, Field, inputSmClass } from './ui';
import { SpecFields, type SpecValues } from './SpecFields';
import { modelShortLabel } from '../../shared/models';

export interface BatchValues extends SpecValues {
  /** '' means "next to each recording", which is the usual answer. */
  outputDir: string;
  autoSave: boolean;
}

/**
 * Set once, applies to everything you drop in. Rows that you edit individually
 * stop tracking these, so changing a default never silently undoes a per-file
 * choice you made on purpose.
 */
export function BatchDefaults({
  values,
  onChange,
  disabled,
}: {
  values: BatchValues;
  onChange: (patch: Partial<BatchValues>) => void;
  disabled: boolean;
}) {
  const [open, setOpen] = useState(false);

  const pickFolder = async () => {
    const dir = await window.api.pickDirectory();
    if (dir) onChange({ outputDir: dir });
  };

  const summary = [
    modelShortLabel(values.model),
    values.speakersExpected ? `${values.speakersExpected} speakers` : 'Auto speakers',
    values.speakerNames.filter(Boolean).length > 0
      ? `${values.speakerNames.filter(Boolean).length} named`
      : null,
  ].filter(Boolean) as string[];

  return (
    <section className="rounded-xl border border-line bg-paper-raised">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 px-3 py-2.5 text-left outline-none focus-visible:ring-2 focus-visible:ring-pine/40"
      >
        <span className="text-[0.8125rem] font-medium text-ink">Batch defaults</span>
        <span className="flex flex-1 flex-wrap gap-1">
          {summary.map((s) => (
            <Chip key={s}>{s}</Chip>
          ))}
        </span>
        <span className="text-ink-soft" aria-hidden="true">
          {open ? '▴' : '▾'}
        </span>
      </button>

      {open && (
        <div className="space-y-4 border-t border-line px-3 py-3">
          <SpecFields values={values} onChange={onChange} disabled={disabled} />

          <Field
            label="Save transcripts to"
            hint="Leave blank to save each transcript beside its own recording."
          >
            <div className="flex gap-1.5">
              <input
                className={inputSmClass}
                value={values.outputDir}
                placeholder="Next to each recording"
                onChange={(e) => onChange({ outputDir: e.target.value })}
              />
              <Button variant="ghost" className="shrink-0 px-2 py-1 text-xs" onClick={pickFolder}>
                Browse
              </Button>
            </div>
          </Field>

          <label className="flex items-start gap-2 text-[0.8125rem] text-ink">
            <input
              type="checkbox"
              className="mt-0.5 accent-pine"
              checked={values.autoSave}
              onChange={(e) => onChange({ autoSave: e.target.checked })}
            />
            <span>
              Save automatically when each one finishes
              <span className="block text-xs text-ink-soft">
                Skips confirming speaker names. Good for leaving a big batch running.
              </span>
            </span>
          </label>
        </div>
      )}
    </section>
  );
}
