import { spawn } from 'node:child_process';
import { app } from 'electron';
import path from 'node:path';
import { CancelledError } from './util/async';

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

export interface ExtractProgress {
  percent: number | null;
  message: string;
}

export interface ExtractOptions {
  inputPath: string;
  /** Caller-owned so the job id can be embedded, avoiding cross-job collisions. */
  outPath: string;
  signal: AbortSignal;
  onProgress(p: ExtractProgress): void;
  /** No output at all for this long means ffmpeg is wedged; kill it. */
  stallTimeoutMs?: number;
}

const DURATION_RE = /Duration:\s*(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?/;
const OUT_TIME_US_RE = /out_time_us=(\d+)/;
// ffmpeg reports out_time_ms in microseconds too. Kept only as a fallback.
const OUT_TIME_MS_RE = /out_time_ms=(\d+)/;

export class FfmpegError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'FfmpegError';
  }
}

/**
 * Strip the video track and downmix to mono 16 kHz mp3. AssemblyAI converts
 * everything to 16 kHz internally anyway, so this keeps uploads small with no
 * meaningful loss for speech.
 */
export async function extractAudio(opts: ExtractOptions): Promise<void> {
  const { inputPath, outPath, signal, onProgress } = opts;
  const stallTimeoutMs = opts.stallTimeoutMs ?? 5 * 60_000;
  signal.throwIfAborted();

  const args = [
    '-nostdin', // several ffmpeg processes run at once; don't contend for stdin
    '-hide_banner',
    '-y',
    '-i', inputPath,
    '-vn', // drop video
    '-ac', '1', // mono
    '-ar', '16000', // 16 kHz
    '-c:a', 'libmp3lame',
    '-b:a', '96k',
    '-progress', 'pipe:1', // machine-readable progress on stdout
    '-nostats',
    outPath,
  ];

  return new Promise<void>((resolve, reject) => {
    const proc = spawn(ffmpegBinaryPath(), args, {
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    let durationSec: number | null = null;
    let stderrTail = '';
    let settled = false;
    let lastOutputAt = Date.now();

    const finish = (fn: () => void) => {
      if (settled) return;
      settled = true;
      clearInterval(watchdog);
      signal.removeEventListener('abort', onAbort);
      fn();
    };

    const onAbort = () => {
      // ffmpeg-static spawns no children of its own, so a plain kill is enough.
      proc.kill();
      finish(() => reject(signal.reason ?? new CancelledError()));
    };

    const watchdog = setInterval(() => {
      if (Date.now() - lastOutputAt > stallTimeoutMs) {
        proc.kill();
        finish(() =>
          reject(new FfmpegError('Audio extraction stalled and was stopped. The file may be corrupt.')),
        );
      }
    }, 10_000);

    signal.addEventListener('abort', onAbort, { once: true });

    proc.stderr.on('data', (chunk) => {
      lastOutputAt = Date.now();
      const text = String(chunk);
      stderrTail = (stderrTail + text).slice(-2000);
      if (durationSec === null) {
        const m = DURATION_RE.exec(text);
        if (m) {
          durationSec =
            Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(`0.${m[4] ?? '0'}`);
        }
      }
    });

    proc.stdout.on('data', (chunk) => {
      lastOutputAt = Date.now();
      const text = String(chunk);
      const m = OUT_TIME_US_RE.exec(text) ?? OUT_TIME_MS_RE.exec(text);
      if (!m) return;
      const elapsedSec = Number(m[1]) / 1_000_000;
      if (durationSec && durationSec > 0) {
        const percent = Math.min(99.5, Math.max(0, (elapsedSec / durationSec) * 100));
        onProgress({ percent, message: `Extracting audio (${Math.round(percent)}%)` });
      } else {
        onProgress({ percent: null, message: `Extracting audio (${formatClock(elapsedSec)})` });
      }
    });

    proc.on('error', (err) =>
      finish(() => reject(new FfmpegError(`Could not start ffmpeg: ${err.message}`))),
    );

    proc.on('close', (code) => {
      if (signal.aborted) {
        finish(() => reject(signal.reason ?? new CancelledError()));
        return;
      }
      if (code === 0) finish(resolve);
      else
        finish(() =>
          reject(new FfmpegError(`Audio extraction failed (ffmpeg exit ${code}). ${stderrTail.slice(-400)}`)),
        );
    });
  });
}

function formatClock(totalSec: number): string {
  const s = Math.floor(totalSec % 60);
  const m = Math.floor(totalSec / 60) % 60;
  const h = Math.floor(totalSec / 3600);
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}
