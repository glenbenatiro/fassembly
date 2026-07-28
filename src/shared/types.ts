// Types shared across the main process, preload, and renderer.

// 'auto' sends both models in priority order and lets AssemblyAI pick: Universal-3.5
// Pro handles its 18 languages, anything else falls back to Universal-2. That is
// also the API's own default when speech_models is omitted.
export type ModelId = 'auto' | 'universal-3-5-pro' | 'universal-2' | 'universal-3-pro';

export interface Settings {
  hasApiKey: boolean; // the raw key is never sent to the renderer
  provider: string; // currently always 'assemblyai'
  defaultModel: ModelId;
  defaultOutputDir: string; // where transcripts are saved by default ('' if not set)
  filenamePattern: string; // tokens: {date} {name}
  defaultParticipants: string; // comma separated
  defaultSpeakerNames: string[]; // batch roster, seeds Speaker Identification
  defaultLanguage: string; // '' => auto-detect
  concurrency: number; // 1..10 jobs in flight
  extractConcurrency: number; // 1..4 simultaneous ffmpeg processes
  autoSave: boolean; // write the markdown as soon as a transcript lands
}

export type SettingsPatch = Partial<Omit<Settings, 'hasApiKey'>>;

export interface Utterance {
  speaker: string;
  text: string;
  start: number; // ms
  end: number; // ms
}

/**
 * Whether Speaker Identification managed to put real names to the diarized
 * speakers. It works by reading the transcript for contextual clues -- people
 * introducing themselves, or addressing each other by name -- not by matching
 * voices, so a recording where nobody says a name cannot be resolved no matter
 * how good the roster is.
 */
export type IdentificationStatus =
  | 'not-requested' // no roster was supplied
  | 'success' // names resolved and corroborated
  | 'uncertain' // names resolved, but the transcript disagrees - needs a human look
  | 'unresolved'; // ran, but the audio gave it nothing to go on

export interface TranscriptionResult {
  id: string;
  text: string;
  utterances: Utterance[];
  speakers: string[]; // distinct speaker labels in order of appearance
  audioDurationSec: number | null;
  modelUsed: string | null;
  /** Diarized label -> identified name, e.g. { A: 'Glen' }. Null when unresolved. */
  speakerMapping: Record<string, string> | null;
  identification: IdentificationStatus;
  /** Why, when identification is 'uncertain' or 'unresolved'. Null otherwise. */
  identificationNote: string | null;
}

// ---------------------------------------------------------------------------
// Jobs
// ---------------------------------------------------------------------------

export type JobStatus =
  | 'queued' // accepted, waiting for a slot
  | 'extracting' // ffmpeg (possibly still waiting for an encoder slot)
  | 'uploading' // streaming to AssemblyAI
  | 'transcribing' // submitted, polling
  | 'done'
  | 'error'
  | 'cancelled';

export type JobErrorKind =
  | 'auth'
  | 'rate-limit'
  | 'network'
  | 'ffmpeg'
  | 'provider'
  | 'timeout'
  | 'input'
  | 'unknown';

/** Everything the user chose for one file. Renderer-supplied, so validated in main. */
export interface JobSpec {
  filePath: string;
  model: ModelId;
  speakersExpected: number | null; // 1..20, or null to let the model decide
  speakerNames: string[]; // fed to AssemblyAI Speaker Identification (known_values)
  language: string | null; // null => language_detection
  outputDir: string; // '' disables autosave for this job
  isoDate: string; // yyyy-mm-dd, used in frontmatter and the filename
  participants: string[];
  autoSave: boolean;
}

export interface JobResultSummary {
  speakers: string[];
  utteranceCount: number;
  audioDurationSec: number | null;
  modelUsed: string | null;
}

/**
 * The serialisable view of a job - this is what crosses IPC.
 *
 * Note what is NOT here: the transcript. A finished TranscriptionResult can hold
 * thousands of utterances, and events fire several times a second per job. The
 * renderer fetches the transcript on demand with jobsResult(id) when the user
 * actually opens a row.
 */
export interface JobRecord {
  id: string;
  spec: JobSpec;
  fileName: string; // basename of spec.filePath, for convenience
  status: JobStatus;
  message: string; // human-readable text for the current status
  percent: number | null; // 0..100 within the current status, null when unknown
  bytesSent: number | null; // upload stage only
  bytesTotal: number | null; // upload stage only
  attempt: number; // 1-based, incremented by retry
  error: string | null;
  errorKind: JobErrorKind | null;
  queuedAt: number;
  startedAt: number | null;
  finishedAt: number | null;
  transcriptId: string | null; // AssemblyAI id once submitted; survives a retry
  savedPath: string | null; // set when autoSave wrote the markdown
  summary: JobResultSummary | null;
  hasAudio: boolean; // extracted audio still on disk, so snippets can be played
}

export interface QueueState {
  concurrency: number;
  extractConcurrency: number;
  running: number;
  queued: number;
  total: number;
}

/** One main->renderer channel. Discriminated, so the renderer just reduces over it. */
export type JobEvent =
  | { type: 'added'; job: JobRecord }
  | { type: 'updated'; job: JobRecord }
  | { type: 'removed'; jobId: string }
  | { type: 'queue'; state: QueueState };

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

export interface SaveRequest {
  outputDir: string;
  sourceFileName: string;
  model: string;
  isoDate: string; // yyyy-mm-dd
  participants: string[];
  utterances: Utterance[]; // already remapped to final speaker names
}

export interface SaveResult {
  filePath: string;
}

// The surface exposed to the renderer via contextBridge as window.api.
export interface Api {
  pickFiles(): Promise<string[]>;
  pickDirectory(): Promise<string | null>;
  getPathForFile(file: File): string | null;

  getSettings(): Promise<Settings>;
  saveSettings(patch: SettingsPatch): Promise<Settings>;
  setApiKey(key: string): Promise<Settings>;
  clearApiKey(): Promise<Settings>;

  jobsList(): Promise<JobRecord[]>;
  jobsQueueState(): Promise<QueueState>;
  jobsEnqueue(specs: JobSpec[]): Promise<string[]>; // returns ids, in order
  jobsUpdateSpec(jobId: string, patch: Partial<JobSpec>): Promise<void>;
  jobsStart(): Promise<void>;
  jobsCancel(jobId: string): Promise<void>;
  jobsCancelAll(): Promise<void>;
  jobsRetry(jobId: string): Promise<void>;
  jobsRemove(jobId: string): Promise<void>;
  jobsClearFinished(): Promise<void>;
  jobsResult(jobId: string): Promise<TranscriptionResult | null>;
  jobsAudioUrl(jobId: string): Promise<string | null>;
  onJobEvent(cb: (e: JobEvent) => void): () => void; // returns an unsubscribe fn

  saveMarkdown(req: SaveRequest): Promise<SaveResult>;
  openPath(p: string): Promise<void>;
  showInFolder(p: string): Promise<void>;
}
