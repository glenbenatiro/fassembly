import type { ModelId } from './types';

/**
 * The models offered in the UI. Single source of truth: this list was previously
 * duplicated between the Configure screen and Settings, and the two had drifted.
 *
 * Prices and capabilities per AssemblyAI's docs as of July 2026. Universal-3.5 Pro
 * is their current flagship and the API's default.
 */
export const MODELS: { id: ModelId; label: string; hint: string }[] = [
  {
    id: 'universal-3-5-pro',
    label: 'Universal-3.5 Pro (recommended)',
    hint: 'Highest accuracy and fastest. 18 languages. $0.21/hr.',
  },
  {
    id: 'auto',
    label: 'Auto',
    hint: 'Universal-3.5 Pro where it supports the language, Universal-2 otherwise.',
  },
  {
    id: 'universal-2',
    label: 'Universal-2',
    hint: 'Broadest language coverage: 99 languages. $0.15/hr.',
  },
  {
    id: 'universal-3-pro',
    label: 'Universal-3 Pro (legacy)',
    hint: 'The previous flagship. Superseded by Universal-3.5 Pro.',
  },
];

export const DEFAULT_MODEL: ModelId = 'universal-3-5-pro';

export function modelLabel(id: ModelId): string {
  return MODELS.find((m) => m.id === id)?.label ?? id;
}

/** Compact form for the job rows, where space is tight. */
export function modelShortLabel(id: ModelId): string {
  switch (id) {
    case 'universal-3-5-pro':
      return 'U-3.5';
    case 'universal-3-pro':
      return 'U-3';
    case 'universal-2':
      return 'U-2';
    case 'auto':
      return 'Auto';
    default:
      return id;
  }
}

/** What actually goes on the wire as `speech_models`, in priority order. */
export function speechModelsFor(id: ModelId): string[] {
  return id === 'auto' ? ['universal-3-5-pro', 'universal-2'] : [id];
}
