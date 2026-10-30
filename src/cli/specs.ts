import type { JobSpec, Settings } from '../shared/types';
import { parentDir } from '../shared/paths';
import type { TranscribeOptions } from './args';

export type SpecDefaults = Pick<
  Settings,
  'defaultModel' | 'defaultLanguage' | 'defaultOutputDir' | 'defaultParticipants' | 'defaultSpeakerNames'
>;

/**
 * Turn command-line options into job specs, falling back to the app's Settings
 * exactly as the batch defaults in the renderer do (see toSpec in App.tsx), so a
 * file transcribed from the terminal lands where it would from the app.
 *
 * Two differences, both because nobody is there to click: the transcript is
 * always saved, and --names fills both the identification roster and the
 * participants list, which the app asks for separately.
 *
 * `files` must already be absolute.
 */
export function buildSpecs(
  files: readonly string[],
  options: TranscribeOptions,
  defaults: SpecDefaults,
  isoDate: string,
): JobSpec[] {
  const participants =
    options.names ??
    defaults.defaultParticipants
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

  return files.map((filePath) => ({
    filePath,
    model: options.model ?? defaults.defaultModel,
    speakersExpected: options.speakers,
    speakerNames: options.names ?? defaults.defaultSpeakerNames,
    language: options.language ?? (defaults.defaultLanguage || null),
    outputDir: options.out ?? (defaults.defaultOutputDir || parentDir(filePath)),
    isoDate,
    participants,
    autoSave: true,
  }));
}
