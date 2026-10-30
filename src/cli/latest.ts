import fs from 'node:fs';
import path from 'node:path';
import { isMediaPath } from '../shared/media';

/** Where the Windows Snipping Tool saves screen recordings, inside Videos. */
export const SCREEN_RECORDINGS = 'Screen Recordings';

/** The folder --latest looks in when not told: Screen Recordings if it exists, else Videos. */
export async function defaultLatestDir(videosDir: string): Promise<string> {
  const candidate = path.join(videosDir, SCREEN_RECORDINGS);
  const stat = await fs.promises.stat(candidate).catch(() => null);
  return stat?.isDirectory() ? candidate : videosDir;
}

/**
 * The most recently modified recording directly inside `dir`, or null if there
 * is none. Subfolders are not searched: "latest" should mean the file the user
 * can see at the top of that folder, not something buried three levels down.
 */
export async function newestRecording(dir: string): Promise<string | null> {
  const entries = await fs.promises.readdir(dir, { withFileTypes: true });
  let newest: { filePath: string; mtimeMs: number } | null = null;
  for (const entry of entries) {
    if (!entry.isFile() || !isMediaPath(entry.name)) continue;
    const filePath = path.join(dir, entry.name);
    const stat = await fs.promises.stat(filePath).catch(() => null);
    if (!stat || stat.size === 0) continue;
    if (!newest || stat.mtimeMs > newest.mtimeMs) newest = { filePath, mtimeMs: stat.mtimeMs };
  }
  return newest?.filePath ?? null;
}
