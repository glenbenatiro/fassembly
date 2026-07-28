import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { ModelId, Settings, SettingsPatch } from '../shared/types';
import { DEFAULT_MODEL } from '../shared/models';
import { DEFAULT_FILENAME_PATTERN } from './util/filename';
import { clampInt } from './util/async';

// A tiny JSON settings store kept in the app's userData folder. Hand-rolled on
// purpose: it has no dependencies, so it bundles cleanly into the packaged app
// (unlike electron-store, whose ajv/conf chain cannot be bundled by Vite).
interface Persisted {
  provider: string;
  defaultModel: ModelId;
  defaultOutputDir: string;
  filenamePattern: string;
  defaultParticipants: string;
  defaultSpeakerNames: string[];
  defaultLanguage: string;
  concurrency: number;
  extractConcurrency: number;
  autoSave: boolean;
  modelDefaultMigrated: boolean; // see migrate()
  apiKeyEnc: string | null; // base64 of a safeStorage-encrypted key
  apiKeyPlain: string | null; // fallback only when OS encryption is unavailable
}

// ffmpeg already threads its own decoding, so two or three concurrent encodes
// saturate a typical machine. Ten would only thrash.
function defaultExtractConcurrency(): number {
  return Math.max(1, Math.min(4, Math.floor((os.cpus()?.length ?? 4) / 4)));
}

const DEFAULTS: Persisted = {
  provider: 'assemblyai',
  defaultModel: DEFAULT_MODEL,
  defaultOutputDir: '',
  filenamePattern: DEFAULT_FILENAME_PATTERN,
  defaultParticipants: '',
  defaultSpeakerNames: [],
  defaultLanguage: '',
  concurrency: 3,
  extractConcurrency: defaultExtractConcurrency(),
  autoSave: false,
  modelDefaultMigrated: false,
  apiKeyEnc: null,
  apiKeyPlain: null,
};

function storePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

/**
 * Move existing installs off Universal-3 Pro, which is now legacy: Universal-3.5
 * Pro is more accurate, faster, and is the API's own default. Guarded by a flag
 * rather than applied on every read, so deliberately choosing the legacy model
 * afterwards is never silently undone.
 */
function migrate(data: Persisted): Persisted {
  if (data.modelDefaultMigrated) return data;
  if (data.defaultModel === 'universal-3-pro') data.defaultModel = DEFAULT_MODEL;
  data.modelDefaultMigrated = true;
  write(data);
  return data;
}

function read(): Persisted {
  let data: Persisted;
  try {
    data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) } as Persisted;
  } catch {
    return { ...DEFAULTS, modelDefaultMigrated: true };
  }
  if (!Array.isArray(data.defaultSpeakerNames)) data.defaultSpeakerNames = [];
  data.concurrency = clampInt(data.concurrency, 1, 10, DEFAULTS.concurrency);
  data.extractConcurrency = clampInt(data.extractConcurrency, 1, 4, DEFAULTS.extractConcurrency);
  return migrate(data);
}

function write(data: Persisted): void {
  try {
    fs.mkdirSync(path.dirname(storePath()), { recursive: true });
    fs.writeFileSync(storePath(), JSON.stringify(data, null, 2), 'utf8');
  } catch {
    // Ignore write failures; settings are best-effort.
  }
}

// Remove the orphaned store from the previous electron-store version. It may
// contain old data, including the removed job names, so clear it out.
try {
  fs.unlinkSync(path.join(app.getPath('userData'), 'config.json'));
} catch {
  // not present, nothing to do
}

export function getSettings(): Settings {
  const d = read();
  return {
    hasApiKey: getApiKey() !== null,
    provider: d.provider,
    defaultModel: d.defaultModel,
    defaultOutputDir: d.defaultOutputDir,
    filenamePattern: d.filenamePattern,
    defaultParticipants: d.defaultParticipants,
    defaultSpeakerNames: d.defaultSpeakerNames,
    defaultLanguage: d.defaultLanguage,
    concurrency: d.concurrency,
    extractConcurrency: d.extractConcurrency,
    autoSave: d.autoSave,
  };
}

export function saveSettings(patch: SettingsPatch): Settings {
  const d = read();
  if (patch.provider !== undefined) d.provider = patch.provider;
  if (patch.defaultModel !== undefined) d.defaultModel = patch.defaultModel;
  if (patch.defaultOutputDir !== undefined) d.defaultOutputDir = patch.defaultOutputDir;
  if (patch.filenamePattern !== undefined) d.filenamePattern = patch.filenamePattern;
  if (patch.defaultParticipants !== undefined) d.defaultParticipants = patch.defaultParticipants;
  if (patch.defaultSpeakerNames !== undefined) {
    d.defaultSpeakerNames = patch.defaultSpeakerNames
      .filter((n): n is string => typeof n === 'string')
      .map((n) => n.trim())
      .filter(Boolean)
      .slice(0, 26);
  }
  if (patch.defaultLanguage !== undefined) d.defaultLanguage = patch.defaultLanguage;
  if (patch.concurrency !== undefined) {
    d.concurrency = clampInt(patch.concurrency, 1, 10, DEFAULTS.concurrency);
  }
  if (patch.extractConcurrency !== undefined) {
    d.extractConcurrency = clampInt(patch.extractConcurrency, 1, 4, DEFAULTS.extractConcurrency);
  }
  if (patch.autoSave !== undefined) d.autoSave = patch.autoSave === true;
  write(d);
  return getSettings();
}

export function setApiKey(key: string): Settings {
  const trimmed = key.trim();
  if (!trimmed) return clearApiKey();
  const d = read();
  if (safeStorage.isEncryptionAvailable()) {
    d.apiKeyEnc = safeStorage.encryptString(trimmed).toString('base64');
    d.apiKeyPlain = null;
  } else {
    // No OS keychain available (rare, e.g. some Linux setups). Store plainly as a
    // last resort so the app still works. The store file itself is gitignored.
    d.apiKeyPlain = trimmed;
    d.apiKeyEnc = null;
  }
  write(d);
  return getSettings();
}

export function clearApiKey(): Settings {
  const d = read();
  d.apiKeyEnc = null;
  d.apiKeyPlain = null;
  write(d);
  return getSettings();
}

// Internal use only. The decrypted key never crosses the IPC boundary.
export function getApiKey(): string | null {
  const d = read();
  if (d.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(d.apiKeyEnc, 'base64'));
    } catch {
      return null;
    }
  }
  return d.apiKeyPlain ?? null;
}
