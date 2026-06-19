import { ipcMain, dialog, shell } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import {
  getSettings,
  saveSettings,
  setApiKey,
  clearApiKey,
  getApiKey,
} from './settings';
import { extractAudio, cleanupTemp } from './ffmpeg';
import { getProvider } from './stt';
import { renderMarkdown } from './markdown';
import type {
  SaveRequest,
  SettingsPatch,
  TranscribeProgress,
  TranscriptionRequest,
} from '../shared/types';

const MEDIA_EXTENSIONS = [
  'mp4', 'm4v', 'mov', 'webm', 'mkv', 'avi', 'mts', 'm2ts',
  'mp3', 'm4a', 'wav', 'aac', 'flac', 'ogg', 'oga', 'opus', 'wma', 'aiff',
];

export function registerIpc(): void {
  ipcMain.handle('dialog:pickFile', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose a meeting recording',
      properties: ['openFile'],
      filters: [
        { name: 'Audio or video', extensions: MEDIA_EXTENSIONS },
        { name: 'All files', extensions: ['*'] },
      ],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  ipcMain.handle('dialog:pickDirectory', async () => {
    const res = await dialog.showOpenDialog({
      title: 'Choose an output folder',
      properties: ['openDirectory', 'createDirectory'],
    });
    return res.canceled || res.filePaths.length === 0 ? null : res.filePaths[0];
  });

  ipcMain.handle('settings:get', async () => getSettings());
  ipcMain.handle('settings:save', async (_e, patch: SettingsPatch) => saveSettings(patch));
  ipcMain.handle('settings:setApiKey', async (_e, key: string) => setApiKey(key));
  ipcMain.handle('settings:clearApiKey', async () => clearApiKey());

  ipcMain.handle('transcribe:run', async (event, req: TranscriptionRequest) => {
    const send = (p: TranscribeProgress) => {
      if (!event.sender.isDestroyed()) event.sender.send('transcribe:progress', p);
    };
    const settings = getSettings();
    const apiKey = getApiKey();
    if (!apiKey) throw new Error('No API key set. Add your AssemblyAI key in Settings.');

    let audioPath: string | null = null;
    try {
      audioPath = await extractAudio(req.filePath, send);
      const provider = getProvider(settings.provider);
      const result = await provider.transcribe(
        audioPath,
        apiKey,
        {
          model: req.model,
          speakersExpected: req.speakersExpected,
          speakerNames: req.speakerNames,
        },
        send,
      );
      send({ stage: 'done', message: 'Transcription complete', percent: 100 });
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      send({ stage: 'error', message, percent: null });
      throw new Error(message);
    } finally {
      if (audioPath) cleanupTemp(audioPath);
    }
  });

  ipcMain.handle('file:saveMarkdown', async (_e, req: SaveRequest) => {
    if (!req.outputDir) throw new Error('No output folder chosen.');
    await fs.promises.mkdir(req.outputDir, { recursive: true });

    const filename = buildFilename(getSettings().filenamePattern, req.isoDate);
    const filePath = await uniquePath(path.join(req.outputDir, filename));
    await fs.promises.writeFile(filePath, renderMarkdown(req), 'utf8');

    // Remember this folder so it is the default next time.
    saveSettings({ defaultOutputDir: req.outputDir });
    return { filePath };
  });

  ipcMain.handle('shell:openPath', async (_e, p: string) => {
    await shell.openPath(p);
  });
  ipcMain.handle('shell:showInFolder', async (_e, p: string) => {
    shell.showItemInFolder(p);
  });
}

function buildFilename(pattern: string, isoDate: string): string {
  const safePattern = pattern && pattern.trim() ? pattern : '{date}-meeting.md';
  // Support {date}, and strip any legacy {job} token (with a trailing separator).
  const name = safePattern.replace(/\{date\}/g, isoDate).replace(/\{job\}-?/g, '');
  return name.replace(/[<>:"/\\|?*]/g, '-');
}

// Avoid clobbering an existing file by appending -2, -3, and so on.
async function uniquePath(target: string): Promise<string> {
  const dir = path.dirname(target);
  const ext = path.extname(target);
  const base = path.basename(target, ext);
  let candidate = target;
  let i = 2;
  for (;;) {
    try {
      await fs.promises.access(candidate);
      candidate = path.join(dir, `${base}-${i}${ext}`);
      i += 1;
    } catch {
      return candidate;
    }
  }
}
