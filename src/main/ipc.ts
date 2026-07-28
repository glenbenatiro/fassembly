import { BrowserWindow, ipcMain, dialog, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { getSettings, saveSettings, setApiKey, clearApiKey } from './settings';
import { renderMarkdown } from './markdown';
import { buildFilename } from './util/filename';
import { writeFileUnique } from './util/files';
import { MEDIA_EXTENSIONS } from '../shared/media';
import { mediaUrlFor } from './mediaProtocol';
import type { JobQueue } from './jobs/queue';
import { MAX_BATCH, validateJobSpec } from './jobs/validate';
import type { JobEvent, JobSpec, SaveRequest, SettingsPatch } from '../shared/types';

export function registerIpc(queue: JobQueue): void {
  // -- dialogs ------------------------------------------------------------

  ipcMain.handle('dialog:pickFiles', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose meeting recordings',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: 'Audio or video', extensions: MEDIA_EXTENSIONS },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    return res.canceled ? [] : res.filePaths;
  });

  ipcMain.handle('dialog:pickDirectory', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose an output folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  // -- settings -----------------------------------------------------------

  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:save', async (_e, patch: SettingsPatch) => {
    const next = saveSettings(patch);
    // Keep the live queue in step with the persisted limits.
    if (patch.concurrency !== undefined) queue.setConcurrency(next.concurrency);
    if (patch.extractConcurrency !== undefined) {
      queue.setExtractConcurrency(next.extractConcurrency);
    }
    return next;
  });
  ipcMain.handle('settings:setApiKey', async (_e, key: string) => setApiKey(key));
  ipcMain.handle('settings:clearApiKey', async () => clearApiKey());

  // -- jobs ---------------------------------------------------------------

  ipcMain.handle('jobs:list', async () => queue.list());
  ipcMain.handle('jobs:queueState', async () => queue.queueState());

  ipcMain.handle('jobs:enqueue', async (_e, specs: unknown) => {
    if (!Array.isArray(specs)) throw new Error('Expected a list of jobs.');
    if (specs.length > MAX_BATCH) {
      throw new Error(`Too many files at once (max ${MAX_BATCH}).`);
    }
    const validated: JobSpec[] = [];
    for (const raw of specs) validated.push(await validateJobSpec(raw));
    return queue.enqueue(validated);
  });

  ipcMain.handle('jobs:updateSpec', async (_e, jobId: string, patch: Partial<JobSpec>) => {
    queue.updateSpec(jobId, patch);
  });
  ipcMain.handle('jobs:start', async () => queue.start());
  ipcMain.handle('jobs:cancel', async (_e, jobId: string) => queue.cancel(jobId));
  ipcMain.handle('jobs:cancelAll', async () => queue.cancelAll());
  ipcMain.handle('jobs:retry', async (_e, jobId: string) => queue.retry(jobId));
  ipcMain.handle('jobs:remove', async (_e, jobId: string) => queue.remove(jobId));
  ipcMain.handle('jobs:clearFinished', async () => queue.clearFinished());
  ipcMain.handle('jobs:result', async (_e, jobId: string) => queue.result(jobId));
  ipcMain.handle('jobs:audioUrl', async (_e, jobId: string) =>
    queue.audioPath(jobId) ? mediaUrlFor(jobId) : null,
  );

  // Broadcast rather than replying to one sender: the queue outlives any single
  // invoke, and the renderer is replaced wholesale on a Vite HMR reload.
  queue.on((event: JobEvent) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && !win.webContents.isDestroyed()) {
        win.webContents.send('jobs:event', event);
      }
    }
  });

  // -- saving -------------------------------------------------------------

  ipcMain.handle('file:saveMarkdown', async (_e, req: SaveRequest) => {
    if (!req.outputDir) throw new Error('No output folder chosen.');
    const filename = buildFilename(getSettings().filenamePattern, req.isoDate, req.sourceFileName);
    // writeFileUnique creates exclusively, so two jobs finishing together cannot
    // both decide the same name is free and have one silently overwrite the other.
    const filePath = await writeFileUnique(path.join(req.outputDir, filename), renderMarkdown(req));
    return { filePath };
  });

  // -- shell --------------------------------------------------------------

  ipcMain.handle('shell:openPath', async (_e, p: string) => {
    const file = await resolveExistingFile(p);
    if (!file) return;
    // shell.openPath launches the file via the OS shell. The app only ever opens
    // saved transcript documents, so refuse executable/script types even if such
    // a path reaches here (e.g. a compromised renderer).
    if (UNSAFE_OPEN_EXTENSIONS.has(path.extname(file).toLowerCase())) return;
    await shell.openPath(file);
  });
  ipcMain.handle('shell:showInFolder', async (_e, p: string) => {
    const file = await resolveExistingFile(p);
    if (!file) return;
    shell.showItemInFolder(file);
  });
}

// Windows-executable / script extensions that shell.openPath would *run* rather
// than open in a viewer. Never hand these to the OS shell.
const UNSAFE_OPEN_EXTENSIONS = new Set([
  '.exe', '.msi', '.bat', '.cmd', '.com', '.scr', '.pif', '.lnk',
  '.ps1', '.vbs', '.vbe', '.js', '.jse', '.wsf', '.wsh', '.hta',
  '.cpl', '.jar', '.reg', '.msc',
]);

// Validate a renderer-supplied path before handing it to the OS shell: it must
// be a non-empty string pointing at an existing regular file. Returns the
// resolved absolute path, or null if it should be ignored.
async function resolveExistingFile(p: string): Promise<string | null> {
  if (typeof p !== 'string' || !p.trim()) return null;
  try {
    const resolved = path.resolve(p);
    const stat = await fs.promises.stat(resolved);
    return stat.isFile() ? resolved : null;
  } catch {
    return null;
  }
}
