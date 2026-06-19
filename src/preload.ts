import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type {
  Api,
  SaveRequest,
  SettingsPatch,
  TranscribeProgress,
  TranscriptionRequest,
} from './shared/types';

const api: Api = {
  pickFile: () => ipcRenderer.invoke('dialog:pickFile'),
  pickDirectory: () => ipcRenderer.invoke('dialog:pickDirectory'),
  getPathForFile: (file: File) => {
    try {
      return webUtils.getPathForFile(file);
    } catch {
      return null;
    }
  },
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (patch: SettingsPatch) => ipcRenderer.invoke('settings:save', patch),
  setApiKey: (key: string) => ipcRenderer.invoke('settings:setApiKey', key),
  clearApiKey: () => ipcRenderer.invoke('settings:clearApiKey'),
  transcribe: (req: TranscriptionRequest) => ipcRenderer.invoke('transcribe:run', req),
  onProgress: (cb: (e: TranscribeProgress) => void) => {
    const listener = (_e: unknown, payload: TranscribeProgress) => cb(payload);
    ipcRenderer.on('transcribe:progress', listener);
    return () => ipcRenderer.removeListener('transcribe:progress', listener);
  },
  saveMarkdown: (req: SaveRequest) => ipcRenderer.invoke('file:saveMarkdown', req),
  openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p),
  showInFolder: (p: string) => ipcRenderer.invoke('shell:showInFolder', p),
};

contextBridge.exposeInMainWorld('api', api);
