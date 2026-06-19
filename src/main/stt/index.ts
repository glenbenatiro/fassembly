import type { SttProvider } from './types';
import { assemblyAiProvider } from './assemblyai';

const providers: Record<string, SttProvider> = {
  [assemblyAiProvider.id]: assemblyAiProvider,
};

export function getProvider(id: string): SttProvider {
  const provider = providers[id];
  if (!provider) throw new Error(`Unknown transcription provider: ${id}`);
  return provider;
}
