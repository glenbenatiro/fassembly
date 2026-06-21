import { spawn } from 'node:child_process';
import { app } from 'electron';
import path from 'node:path';
import fs from 'node:fs';
import type { TranscribeProgress } from '../shared/types';

// Resolve the ffmpeg binary. In a packaged build it ships as an extra resource
// beside the app (see extraResource in forge.config.ts) and is found via
// process.resourcesPath. In dev it comes from the installed ffmpeg-static package.
function ffmpegBinaryPath(): string {
  const bin = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  if (app.isPackaged) {
    return path.join(process.resourcesPath, bin);
  }
  return path.join(app.getAppPath(), 'node_modules', 'ffmpeg-static', bin);
}

// Strip the video track and downmix to mono 16 kHz mp3. AssemblyAI converts
// everything to 16 kHz internally anyway, so this keeps uploads small with no
// meaningful loss for speech.
export async function extractAudio(
  inputPath: string,
  onProgress?: (e: TranscribeProgress) => void,
): Promise<string> {
  const base = path.basename(inputPath, path.extname(inputPath));
  const outPath = path.join(app.getPath('temp'), `mt-${base}-${process.pid}-${Date.now()}.mp3`);
  const args = [
    '-y',
    '-i', inputPath,
    '-vn', // drop video
    '-ac', '1', // mono
    '-ar', '16000', // 16 kHz
    '-c:a', 'libmp3lame',
    '-b:a', '96k',
    outPath,
  ];

  return new Promise<string>((resolve, reject) => {
    const proc = spawn(ffmpegBinaryPath(), args, { windowsHide: true });
    let stderr = '';

    proc.stderr.on('data', (chunk) => {
      const text = String(chunk);
      stderr += text;
      const m = /time=(\d{2}):(\d{2}):(\d{2})/.exec(text);
      if (m) {
        onProgress?.({
          stage: 'extract',
          message: `Extracting audio (${m[1]}:${m[2]}:${m[3]})`,
          percent: null,
        });
      }
    });

    proc.on('error', (err) => reject(new Error(`Could not start ffmpeg: ${err.message}`)));
    proc.on('close', (code) => {
      if (code === 0) resolve(outPath);
      else reject(new Error(`Audio extraction failed (ffmpeg exit ${code}). ${stderr.slice(-300)}`));
    });
  });
}

export function cleanupTemp(filePath: string): void {
  fs.promises.unlink(filePath).catch(() => undefined);
}
