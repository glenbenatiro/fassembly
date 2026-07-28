import type { SttOptions, SttProvider } from './types';
import type { TranscriptionResult, Utterance } from '../../shared/types';
import { speechModelsFor } from '../../shared/models';
import { jitter, sleep } from '../util/async';
import { aaiJson, ProviderError, TimeoutError } from './http';
import { resolveIdentification } from './identify';
import { uploadAudio } from './upload';

const BASE_URL = 'https://api.assemblyai.com';

const POLL_START_MS = 3_000;
const POLL_MAX_MS = 20_000;
const POLL_GROWTH = 1.4;
const DEFAULT_WALL_CLOCK_MS = 4 * 60 * 60_000;

interface AaiTranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error?: string;
  text?: string;
  audio_duration?: number;
  speech_model_used?: string;
  utterances?: Array<{ speaker: string; text: string; start: number; end: number }>;
  speech_understanding?: {
    response?: {
      speaker_identification?: {
        // Diarized label -> identified name, e.g. { A: 'Glen' }.
        mapping?: Record<string, string>;
        status?: string;
      };
    };
  };
}

function buildBody(uploadUrl: string, options: SttOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    audio_url: uploadUrl,
    // Plural; the singular speech_model is deprecated. 'auto' expands to
    // Universal-3.5 Pro then Universal-2, matching the API's own default.
    speech_models: speechModelsFor(options.model),
    speaker_labels: true,
  };

  // language_code and language_detection are mutually exclusive.
  if (options.language) body.language_code = options.language;
  else body.language_detection = true;

  if (options.speakersExpected && options.speakersExpected > 0) {
    body.speakers_expected = options.speakersExpected;
  }

  const names = options.speakerNames.map((n) => n.trim()).filter(Boolean);
  if (names.length > 0) {
    // Speaker Identification: resolve generic "Speaker A/B" to the names we know.
    //
    // Uses the `speakers` object form rather than the older flat `known_values`
    // array -- AssemblyAI documents it as the more accurate of the two, and it
    // leaves room to pass role/company hints later.
    //
    // Worth understanding what this can and cannot do: it reads the *transcript*
    // for contextual clues (someone introducing themselves, or being addressed
    // by name). It is not voice matching, so a recording where nobody says a
    // name will come back unresolved however good the roster is.
    body.speech_understanding = {
      request: {
        speaker_identification: {
          speaker_type: 'name',
          speakers: names.map((name) => ({ name })),
        },
      },
    };
  }
  return body;
}

export const assemblyAiProvider: SttProvider = {
  id: 'assemblyai',

  async upload({ apiKey, audioPath, signal, onProgress }) {
    if (!apiKey) throw new Error('Missing AssemblyAI API key. Add it in Settings.');
    return uploadAudio({ baseUrl: BASE_URL, apiKey, audioPath, signal, onProgress });
  },

  async transcribe({
    apiKey,
    uploadUrl,
    options,
    signal,
    onSubmitted,
    onPoll,
    existingTranscriptId,
    maxWallClockMs = DEFAULT_WALL_CLOCK_MS,
  }): Promise<TranscriptionResult> {
    if (!apiKey) throw new Error('Missing AssemblyAI API key. Add it in Settings.');

    let transcriptId = existingTranscriptId ?? null;
    if (!transcriptId) {
      const submitted = await aaiJson<AaiTranscript>(`${BASE_URL}/v2/transcript`, {
        apiKey,
        signal,
        method: 'POST',
        body: buildBody(uploadUrl, options),
      });
      transcriptId = submitted.id;
      onSubmitted(transcriptId);
    }

    const pollUrl = `${BASE_URL}/v2/transcript/${transcriptId}`;
    const startedAt = Date.now();
    let delayMs = POLL_START_MS;

    for (;;) {
      signal.throwIfAborted();
      const elapsedMs = Date.now() - startedAt;
      if (elapsedMs > maxWallClockMs) {
        throw new TimeoutError(
          `Gave up after ${Math.round(maxWallClockMs / 3_600_000)}h waiting for AssemblyAI.`,
        );
      }

      // Jittered so ten jobs started together do not poll in lockstep.
      await sleep(jitter(delayMs), signal);

      const t = await aaiJson<AaiTranscript>(pollUrl, {
        apiKey,
        signal,
        onRetry: ({ delayMs: waitMs, reason }) =>
          onPoll({
            status: 'waiting',
            elapsedMs: Date.now() - startedAt,
            note: `${reason}, retrying in ${Math.round(waitMs / 1000)}s`,
          }),
      });

      if (t.status === 'completed') return toResult(t, options);
      if (t.status === 'error') throw new ProviderError(t.error || 'Transcription failed');

      onPoll({ status: t.status, elapsedMs: Date.now() - startedAt });
      // Back off towards a 20s ceiling. The old fixed 3s loop meant ten jobs
      // generated ~200 requests/min against the account for the whole run.
      delayMs = Math.min(POLL_MAX_MS, Math.round(delayMs * POLL_GROWTH));
    }
  },
};

function toResult(t: AaiTranscript, options: SttOptions): TranscriptionResult {
  const roster = options.speakerNames.map((n) => n.trim()).filter(Boolean);

  // Read back what Speaker Identification actually did. This was previously
  // discarded entirely, so a roster that failed to resolve looked identical to
  // one that was never sent -- generic A/B labels either way, no explanation.
  const identified = t.speech_understanding?.response?.speaker_identification;
  const rawMapping = identified?.mapping ?? {};

  // The API rewrites utterance speakers with its own spelling of a resolved
  // name, so work from the raw labels and apply our own mapping afterwards.
  const raw: Utterance[] = (t.utterances ?? []).map((u) => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
  }));

  const { mapping, status, note } = resolveIdentification({
    rawMapping,
    utterances: raw,
    roster,
  });

  const utterances: Utterance[] = mapping
    ? raw.map((u) => ({ ...u, speaker: mapping[u.speaker] ?? u.speaker }))
    : raw;

  return {
    id: t.id,
    text: t.text ?? utterances.map((u) => `${u.speaker}: ${u.text}`).join('\n'),
    utterances,
    speakers: Array.from(new Set(utterances.map((u) => u.speaker))),
    audioDurationSec: t.audio_duration ?? null,
    modelUsed: t.speech_model_used ?? null,
    speakerMapping: mapping,
    identification: status,
    identificationNote: note,
  };
}
