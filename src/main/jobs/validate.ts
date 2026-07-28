import fs from 'node:fs';
import path from 'node:path';
import type { JobSpec, ModelId } from '../../shared/types';
import { isMediaPath } from '../../shared/media';
import { MODELS } from '../../shared/models';

const MODEL_IDS = new Set<string>(MODELS.map((m) => m.id));
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const LANGUAGE_CODE = /^[a-z]{2}(?:[-_][A-Za-z]{2,4})?$/;

export const MAX_BATCH = 200;
export const MAX_SPEAKER_NAMES = 26; // AssemblyAI labels speakers A..Z

/**
 * jobs:enqueue is the first handler taking a structured, batched payload from the
 * renderer, so validate it here rather than trusting it. Same discipline as the
 * existing path checks around shell.openPath.
 */
export async function validateJobSpec(raw: unknown): Promise<JobSpec> {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid job.');
  const spec = raw as Record<string, unknown>;

  const filePath = requireString(spec.filePath, 'filePath');
  const resolved = path.resolve(filePath);
  if (!isMediaPath(resolved)) {
    throw new Error(`${path.basename(resolved)} is not a supported audio or video file.`);
  }
  const stat = await fs.promises.stat(resolved).catch(() => null);
  if (!stat?.isFile()) throw new Error(`${path.basename(resolved)} could not be read.`);
  if (stat.size === 0) throw new Error(`${path.basename(resolved)} is empty.`);

  const model = String(spec.model ?? '');
  if (!MODEL_IDS.has(model)) throw new Error(`Unknown model: ${model}`);

  let outputDir = typeof spec.outputDir === 'string' ? spec.outputDir.trim() : '';
  if (outputDir) {
    outputDir = path.resolve(outputDir);
    const dirStat = await fs.promises.stat(outputDir).catch(() => null);
    // A folder that does not exist yet is fine: it is created on save. A path
    // that exists but is a file is not.
    if (dirStat && !dirStat.isDirectory()) throw new Error(`${outputDir} is not a folder.`);
  }

  const speakersExpected = normaliseSpeakerCount(spec.speakersExpected);

  const speakerNames = Array.isArray(spec.speakerNames)
    ? spec.speakerNames
        .filter((n): n is string => typeof n === 'string')
        .map((n) => n.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, MAX_SPEAKER_NAMES)
    : [];

  const language =
    typeof spec.language === 'string' && spec.language.trim()
      ? spec.language.trim()
      : null;
  if (language && !LANGUAGE_CODE.test(language)) {
    throw new Error(`Invalid language code: ${language}`);
  }

  const isoDate =
    typeof spec.isoDate === 'string' && ISO_DATE.test(spec.isoDate)
      ? spec.isoDate
      : new Date().toISOString().slice(0, 10);

  const participants = Array.isArray(spec.participants)
    ? spec.participants
        .filter((p): p is string => typeof p === 'string')
        .map((p) => p.trim().slice(0, 100))
        .filter(Boolean)
        .slice(0, 100)
    : [];

  return {
    filePath: resolved,
    model: model as ModelId,
    speakersExpected,
    speakerNames,
    language,
    outputDir,
    isoDate,
    participants,
    autoSave: spec.autoSave === true,
  };
}

function normaliseSpeakerCount(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.min(20, Math.round(n));
}

function requireString(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Missing ${field}.`);
  return value;
}
