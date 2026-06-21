import { app, safeStorage } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import type { ModelId, Settings, SettingsPatch } from '../shared/types';

// A tiny JSON settings store kept in the app's userData folder. Hand-rolled on
// purpose: it has no dependencies, so it bundles cleanly into the packaged app
// (unlike electron-store, whose ajv/conf chain cannot be bundled by Vite).
interface Persisted {
  provider: string;
  defaultModel: ModelId;
  defaultOutputDir: string;
  filenamePattern: string;
  defaultParticipants: string;
  apiKeyEnc: string | null; // base64 of a safeStorage-encrypted key
  apiKeyPlain: string | null; // fallback only when OS encryption is unavailable
}

const DEFAULTS: Persisted = {
  provider: 'assemblyai',
  defaultModel: 'universal-3-pro',
  defaultOutputDir: '',
  filenamePattern: '{date}-meeting.md',
  defaultParticipants: '',
  apiKeyEnc: null,
  apiKeyPlain: null,
};

function storePath(): string {
  return path.join(app.getPath('userData'), 'settings.json');
}

function read(): Persisted {
  try {
    const data = { ...DEFAULTS, ...JSON.parse(fs.readFileSync(storePath(), 'utf8')) } as Persisted;
    if (data.filenamePattern?.includes('{job}')) data.filenamePattern = DEFAULTS.filenamePattern;
    return data;
  } catch {
    return { ...DEFAULTS };
  }
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
  };
}

export function saveSettings(patch: SettingsPatch): Settings {
  const d = read();
  if (patch.provider !== undefined) d.provider = patch.provider;
  if (patch.defaultModel !== undefined) d.defaultModel = patch.defaultModel;
  if (patch.defaultOutputDir !== undefined) d.defaultOutputDir = patch.defaultOutputDir;
  if (patch.filenamePattern !== undefined) d.filenamePattern = patch.filenamePattern;
  if (patch.defaultParticipants !== undefined) d.defaultParticipants = patch.defaultParticipants;
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
