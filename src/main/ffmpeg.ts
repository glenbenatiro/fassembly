import ffmpeg from 'fluent-ffmpeg';
import ffmpegStatic from 'ffmpeg-static';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { TranscribeProgress } from '../shared/types';

// ffmpeg-static's default export is the absolute path to the bundled binary.
// In packaged builds that path lives inside app.asar, so point at the unpacked
// copy (see the asar.unpack glob in forge.config.ts).
const ffmpegPath = String(ffmpegStatic).replace('app.asar', 'app.asar.unpacked');
ffmpeg.setFfmpegPath(ffmpegPath);

// Strip the video track and downmix to mono 16 kHz mp3. AssemblyAI converts
// everything to 16 kHz internally anyway, so this keeps uploads small with no
// meaningful loss for speech.
export async function extractAudio(
  inputPath: string,
  onProgress?: (e: TranscribeProgress) => void,
): Promise<string> {
  const base = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(app.getPath('temp'), `mt-${base}-${process.pid}-${Date.now()}.mp3`);

  return new Promise<string>((resolve, reject) => {
    ffmpeg(inputPath)
      .noVideo()
      .audioChannels(1)
      .audioFrequency(16000)
      .audioCodec('libmp3lame')
      .audioBitrate('96k')
      .format('mp3')
      .on('progress', (p) => {
        const percent =
          typeof p.percent === 'number' && isFinite(p.percent)
            ? Math.max(0, Math.min(100, Math.round(p.percent)))
            : null;
        onProgress?.({
          stage: 'extract',
          message: percent !== null ? `Extracting audio (${percent}%)` : 'Extracting audio',
          percent,
        });
      })
      .on('error', (err) => reject(new Error(`Audio extraction failed: ${err.message}`)))
      .on('end', () => resolve(outPath))
      .save(outPath);
  });
}

export function cleanupTemp(filePath: string): void {
  fs.promises.unlink(filePath).catch(() => undefined);
}
