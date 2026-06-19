import Store from 'electron-store';
import { safeStorage } from 'electron';
import type { ModelId, Settings, SettingsPatch } from '../shared/types';

interface StoreShape {
  provider: string;
  defaultModel: ModelId;
  defaultOutputDir: string;
  filenamePattern: string;
  defaultParticipants: string;
  apiKeyEnc: string | null; // base64 of a safeStorage-encrypted key
  apiKeyPlain: string | null; // fallback only when OS encryption is unavailable
}

const store = new Store<StoreShape>({
  defaults: {
    provider: 'assemblyai',
    defaultModel: 'universal-3-pro',
    defaultOutputDir: '',
    filenamePattern: '{date}-meeting.md',
    defaultParticipants: '',
    apiKeyEnc: null,
    apiKeyPlain: null,
  },
});

// One-time cleanup for stores written by an earlier version that kept a list of
// named jobs and a {job} token in the filename pattern. Removes that data from
// the on-device store so nothing personal lingers.
(store as unknown as { delete(key: string): void }).delete('jobs');
if (store.get('filenamePattern')?.includes('{job}')) {
  store.set('filenamePattern', '{date}-meeting.md');
}

export function getSettings(): Settings {
  return {
    hasApiKey: getApiKey() !== null,
    provider: store.get('provider'),
    defaultModel: store.get('defaultModel'),
    defaultOutputDir: store.get('defaultOutputDir'),
    filenamePattern: store.get('filenamePattern'),
    defaultParticipants: store.get('defaultParticipants'),
  };
}

export function saveSettings(patch: SettingsPatch): Settings {
  if (patch.provider !== undefined) store.set('provider', patch.provider);
  if (patch.defaultModel !== undefined) store.set('defaultModel', patch.defaultModel);
  if (patch.defaultOutputDir !== undefined) store.set('defaultOutputDir', patch.defaultOutputDir);
  if (patch.filenamePattern !== undefined) store.set('filenamePattern', patch.filenamePattern);
  if (patch.defaultParticipants !== undefined) {
    store.set('defaultParticipants', patch.defaultParticipants);
  }
  return getSettings();
}

export function setApiKey(key: string): Settings {
  const trimmed = key.trim();
  if (!trimmed) return clearApiKey();
  if (safeStorage.isEncryptionAvailable()) {
    store.set('apiKeyEnc', safeStorage.encryptString(trimmed).toString('base64'));
    store.set('apiKeyPlain', null);
  } else {
    // No OS keychain available (rare, e.g. some Linux setups). Store plainly as a
    // last resort so the app still works. The store file itself is gitignored.
    store.set('apiKeyPlain', trimmed);
    store.set('apiKeyEnc', null);
  }
  return getSettings();
}

export function clearApiKey(): Settings {
  store.set('apiKeyEnc', null);
  store.set('apiKeyPlain', null);
  return getSettings();
}

// Internal use only. The decrypted key never crosses the IPC boundary.
export function getApiKey(): string | null {
  const enc = store.get('apiKeyEnc');
  if (enc && safeStorage.isEncryptionAvailable()) {
    try {
      return safeStorage.decryptString(Buffer.from(enc, 'base64'));
    } catch {
      return null;
    }
  }
  return store.get('apiKeyPlain') ?? null;
}
