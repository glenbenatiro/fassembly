// Types shared across the main process, preload, and renderer.

export type ModelId = 'universal-3-pro' | 'universal-3-5-pro' | 'universal-2';

export interface Settings {
  hasApiKey: boolean; // the raw key is never sent to the renderer
  provider: string; // currently always 'assemblyai'
  defaultModel: ModelId;
  defaultOutputDir: string; // where transcripts are saved by default ('' if not set)
  filenamePattern: string; // tokens: {date}
  defaultParticipants: string; // comma separated
}

export type SettingsPatch = Partial<
  Pick<
    Settings,
    'provider' | 'defaultModel' | 'defaultOutputDir' | 'filenamePattern' | 'defaultParticipants'
  >
>;

export interface TranscriptionRequest {
  filePath: string;
  model: ModelId;
  speakersExpected: number | null;
  speakerNames: string[]; // fed to AssemblyAI Speaker Identification (known_values)
}

export interface Utterance {
  speaker: string;
  text: string;
  start: number; // ms
  end: number; // ms
}

export interface TranscriptionResult {
  id: string;
  text: string;
  utterances: Utterance[];
  speakers: string[]; // distinct speaker labels in order of appearance
  audioDurationSec: number | null;
  modelUsed: string | null;
}

export interface SaveRequest {
  outputDir: string; // resolved by the renderer (default folder or a picked folder)
  sourceFileName: string;
  model: string;
  isoDate: string; // yyyy-mm-dd
  participants: string[];
  utterances: Utterance[]; // already remapped to final speaker names
}

export interface SaveResult {
  filePath: string;
}

export type TranscribeStage = 'extract' | 'upload' | 'transcribe' | 'done' | 'error';

export interface TranscribeProgress {
  stage: TranscribeStage;
  message: string;
  percent: number | null;
}

// The surface exposed to the renderer via contextBridge as window.api.
export interface Api {
  pickFile(): Promise<string | null>;
  pickDirectory(): Promise<string | null>;
  getPathForFile(file: File): string | null;
  getSettings(): Promise<Settings>;
  saveSettings(patch: SettingsPatch): Promise<Settings>;
  setApiKey(key: string): Promise<Settings>;
  clearApiKey(): Promise<Settings>;
  transcribe(req: TranscriptionRequest): Promise<TranscriptionResult>;
  onProgress(cb: (e: TranscribeProgress) => void): () => void; // returns an unsubscribe fn
  saveMarkdown(req: SaveRequest): Promise<SaveResult>;
  openPath(p: string): Promise<void>;
  showInFolder(p: string): Promise<void>;
}
