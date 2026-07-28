import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const TEMP_PREFIX = 'fassembly-';
// The extracted-audio naming used before the queue existed. Swept too, so an
// upgrade cleans up whatever the previous version left behind.
const LEGACY_TEMP_PREFIX = 'mt-';

/**
 * Where a job's extracted audio lives. The job id is in the name because the old
 * scheme (basename + pid + timestamp) collided when two files with the same
 * basename, from different folders, started in the same millisecond.
 */
export function tempAudioPath(jobId: string, inputPath: string): string {
  const base = path
    .basename(inputPath, path.extname(inputPath))
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 40);
  return path.join(os.tmpdir(), `${TEMP_PREFIX}${base}-${jobId}.mp3`);
}

/**
 * Delete, tolerating the brief window where Windows still holds the handle after
 * we kill ffmpeg or abort a fetch whose body was a read stream. Best-effort: a
 * leftover temp file is not worth failing a finished job over, and the startup
 * sweep will catch it.
 */
export async function removeWithRetry(filePath: string, attempts = 5): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      await fs.promises.unlink(filePath);
      return;
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
      if (attempt === attempts - 1) return;
      await new Promise((resolve) => setTimeout(resolve, 200 * (attempt + 1)));
    }
  }
}

/**
 * Write to `target`, or to `target-2`, `target-3`, ... if taken. Returns the path
 * actually written.
 *
 * The 'wx' flag is what makes this safe under concurrency: it fails if the file
 * exists, so two jobs racing on the same name cannot both believe they won. The
 * previous check-then-write let one silently overwrite the other, which mattered
 * because the default filename pattern produced the same name for every file in
 * a batch.
 */
export async function writeFileUnique(target: string, contents: string): Promise<string> {
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  await fs.promises.mkdir(dir, { recursive: true });

  for (let n = 1; n < 1000; n++) {
    const candidate = n === 1 ? target : path.join(dir, `${base}-${n}${ext}`);
    let handle: fs.promises.FileHandle | undefined;
    try {
      handle = await fs.promises.open(candidate, 'wx');
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code === 'EEXIST') continue;
      throw err;
    }
    try {
      await handle.writeFile(contents, 'utf8');
    } finally {
      await handle.close();
    }
    return candidate;
  }
  throw new Error(`Could not find a free filename next to ${base}${ext}`);
}

/**
 * Delete stale extracted audio left behind by a crash or a hard quit. Runs once
 * at startup; a few hundred MB of orphaned mp3 per crashed batch adds up.
 */
export async function sweepOldTemps(maxAgeMs: number): Promise<void> {
  const dir = os.tmpdir();
  let entries: string[];
  try {
    entries = await fs.promises.readdir(dir);
  } catch {
    return;
  }
  const cutoff = Date.now() - maxAgeMs;
  await Promise.all(
    entries
      .filter(
        (name) =>
          name.endsWith('.mp3') &&
          (name.startsWith(TEMP_PREFIX) || name.startsWith(LEGACY_TEMP_PREFIX)),
      )
      .map(async (name) => {
        const full = path.join(dir, name);
        try {
          const stat = await fs.promises.stat(full);
          if (stat.mtimeMs < cutoff) await removeWithRetry(full, 2);
        } catch {
          // Raced with something else deleting it, or no permission. Skip.
        }
      }),
  );
}
