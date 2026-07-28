import { app, BrowserWindow, session, shell } from 'electron';
import path from 'node:path';
import started from 'electron-squirrel-startup';
import { registerIpc } from './main/ipc';
import { JobQueue } from './main/jobs/queue';
import { getApiKey, getSettings } from './main/settings';
import { sweepOldTemps } from './main/util/files';
import { MEDIA_SCHEME, handleMediaProtocol, registerMediaScheme } from './main/mediaProtocol';

// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (started) {
  app.quit();
}

const isDev = !!MAIN_WINDOW_VITE_DEV_SERVER_URL;

// Must happen before 'ready'.
registerMediaScheme();

const startupSettings = getSettings();
const queue = new JobQueue({
  concurrency: startupSettings.concurrency,
  extractConcurrency: startupSettings.extractConcurrency,
  providerId: startupSettings.provider,
  // Read per attempt rather than caching: the key can be added or changed in
  // Settings while jobs are sitting in the queue.
  getApiKey,
  getFilenamePattern: () => getSettings().filenamePattern,
});

const createWindow = () => {
  const mainWindow = new BrowserWindow({
    width: 1240,
    height: 820,
    minWidth: 1040,
    minHeight: 640,
    backgroundColor: '#F4EDE0',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  });

  // Defense-in-depth: the renderer only ever loads local app content. Deny any
  // attempt to open a new in-app window, and route real web links to the user's
  // default browser instead.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      void shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  // Block navigation away from the app's own content. The only legitimate
  // navigations are the initial load and (in dev) Vite HMR reloads of the dev
  // server URL; everything else is refused.
  mainWindow.webContents.on('will-navigate', (event, url) => {
    const devUrl = MAIN_WINDOW_VITE_DEV_SERVER_URL;
    const sameAsCurrent = url === mainWindow.webContents.getURL();
    const isDevServer = !!devUrl && url.startsWith(devUrl);
    if (!sameAsCurrent && !isDevServer) {
      event.preventDefault();
    }
  });

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

// Lock down what the renderer is allowed to load and connect to. The renderer
// never talks to AssemblyAI directly (the main process does), so connect-src can
// stay tight in production. media-src additionally allows the custom scheme that
// serves a job's extracted audio for speaker identification. Dev needs the Vite
// HMR allowances.
function applyContentSecurityPolicy(): void {
  const policy = isDev
    ? "default-src 'self' data: blob:; " +
      "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data: blob:; " +
      `media-src 'self' blob: ${MEDIA_SCHEME}:; ` +
      "connect-src 'self' ws: wss: http://localhost:*;"
    : "default-src 'self'; " +
      "script-src 'self'; " +
      "style-src 'self' 'unsafe-inline'; " +
      "img-src 'self' data:; " +
      "font-src 'self' data:; " +
      `media-src 'self' ${MEDIA_SCHEME}:; ` +
      "connect-src 'self';";

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
}

app.on('ready', () => {
  applyContentSecurityPolicy();
  handleMediaProtocol((jobId) => queue.audioPath(jobId));
  // Clean up extracted audio orphaned by a crash or a hard quit.
  void sweepOldTemps(24 * 60 * 60_000);
  registerIpc(queue);
  createWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Closing the window ends the run: the queue lives in memory and jobs do not
// survive a restart. Shut down deliberately so ffmpeg children are killed and
// temp audio is cleaned up, rather than left orphaned.
let shuttingDown = false;
app.on('will-quit', (event) => {
  if (shuttingDown) return;
  shuttingDown = true;
  event.preventDefault();
  void queue.shutdown().finally(() => app.quit());
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
