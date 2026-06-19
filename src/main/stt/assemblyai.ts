import fs from 'node:fs';
import type { SttOptions, SttProvider } from './types';
import type { TranscriptionResult, Utterance } from '../../shared/types';

const BASE_URL = 'https://api.assemblyai.com';

interface AaiTranscript {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'error';
  error?: string;
  text?: string;
  audio_duration?: number;
  speech_model_used?: string;
  utterances?: Array<{ speaker: string; text: string; start: number; end: number }>;
}

async function uploadFile(apiKey: string, audioPath: string): Promise<string> {
  const data = await fs.promises.readFile(audioPath);
  const res = await fetch(`${BASE_URL}/v2/upload`, {
    method: 'POST',
    headers: { authorization: apiKey, 'content-type': 'application/octet-stream' },
    body: data,
  });
  if (!res.ok) throw new Error(`Upload failed (${res.status}): ${await safeText(res)}`);
  const json = (await res.json()) as { upload_url: string };
  return json.upload_url;
}

function buildBody(uploadUrl: string, options: SttOptions): Record<string, unknown> {
  const body: Record<string, unknown> = {
    audio_url: uploadUrl,
    speech_models: [options.model], // plural; the singular speech_model is deprecated
    language_detection: true,
    speaker_labels: true,
  };
  if (options.speakersExpected && options.speakersExpected > 0) {
    body.speakers_expected = options.speakersExpected;
  }
  const names = options.speakerNames.map((n) => n.trim()).filter(Boolean);
  if (names.length > 0) {
    // Speaker Identification: resolve generic "Speaker A/B" to the names we know.
    body.speech_understanding = {
      request: {
        speaker_identification: { speaker_type: 'name', known_values: names },
      },
    };
  }
  return body;
}

export const assemblyAiProvider: SttProvider = {
  id: 'assemblyai',
  async transcribe(audioPath, apiKey, options, onProgress) {
    if (!apiKey) throw new Error('Missing AssemblyAI API key. Add it in Settings.');

    onProgress({ stage: 'upload', message: 'Uploading audio to AssemblyAI', percent: null });
    const uploadUrl = await uploadFile(apiKey, audioPath);

    onProgress({ stage: 'transcribe', message: 'Submitting transcription', percent: null });
    const submitRes = await fetch(`${BASE_URL}/v2/transcript`, {
      method: 'POST',
      headers: { authorization: apiKey, 'content-type': 'application/json' },
      body: JSON.stringify(buildBody(uploadUrl, options)),
    });
    if (!submitRes.ok) {
      throw new Error(`Submit failed (${submitRes.status}): ${await safeText(submitRes)}`);
    }
    const submitted = (await submitRes.json()) as AaiTranscript;

    const pollUrl = `${BASE_URL}/v2/transcript/${submitted.id}`;
    for (;;) {
      await delay(3000);
      const pollRes = await fetch(pollUrl, { headers: { authorization: apiKey } });
      if (!pollRes.ok) {
        throw new Error(`Polling failed (${pollRes.status}): ${await safeText(pollRes)}`);
      }
      const t = (await pollRes.json()) as AaiTranscript;
      if (t.status === 'completed') return toResult(t);
      if (t.status === 'error') throw new Error(t.error || 'Transcription failed');
      onProgress({ stage: 'transcribe', message: `Transcribing (${t.status})`, percent: null });
    }
  },
};

function toResult(t: AaiTranscript): TranscriptionResult {
  const utterances: Utterance[] = (t.utterances ?? []).map((u) => ({
    speaker: u.speaker,
    text: u.text,
    start: u.start,
    end: u.end,
  }));
  return {
    id: t.id,
    text: t.text ?? utterances.map((u) => `${u.speaker}: ${u.text}`).join('\n'),
    utterances,
    speakers: Array.from(new Set(utterances.map((u) => u.speaker))),
    audioDurationSec: t.audio_duration ?? null,
    modelUsed: t.speech_model_used ?? null,
  };
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function safeText(res: Response): Promise<string> {
  try {
    return await res.text();
  } catch {
    return '';
  }
}
