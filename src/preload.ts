import { contextBridge, ipcRenderer, webUtils } from 'electron';
import type { Api, JobEvent, JobSpec, SaveRequest, SettingsPatch } from './shared/types';

const api: Api = {
  pickFiles: () => ipcRenderer.invoke('dialog:pickFiles'),
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

  jobsList: () => ipcRenderer.invoke('jobs:list'),
  jobsQueueState: () => ipcRenderer.invoke('jobs:queueState'),
  jobsEnqueue: (specs: JobSpec[]) => ipcRenderer.invoke('jobs:enqueue', specs),
  jobsUpdateSpec: (jobId: string, patch: Partial<JobSpec>) =>
    ipcRenderer.invoke('jobs:updateSpec', jobId, patch),
  jobsStart: () => ipcRenderer.invoke('jobs:start'),
  jobsCancel: (jobId: string) => ipcRenderer.invoke('jobs:cancel', jobId),
  jobsCancelAll: () => ipcRenderer.invoke('jobs:cancelAll'),
  jobsRetry: (jobId: string) => ipcRenderer.invoke('jobs:retry', jobId),
  jobsRemove: (jobId: string) => ipcRenderer.invoke('jobs:remove', jobId),
  jobsClearFinished: () => ipcRenderer.invoke('jobs:clearFinished'),
  jobsResult: (jobId: string) => ipcRenderer.invoke('jobs:result', jobId),
  jobsAudioUrl: (jobId: string) => ipcRenderer.invoke('jobs:audioUrl', jobId),
  onJobEvent: (cb: (e: JobEvent) => void) => {
    const listener = (_e: unknown, payload: JobEvent) => cb(payload);
    ipcRenderer.on('jobs:event', listener);
    return () => ipcRenderer.removeListener('jobs:event', listener);
  },

  saveMarkdown: (req: SaveRequest) => ipcRenderer.invoke('file:saveMarkdown', req),
  openPath: (p: string) => ipcRenderer.invoke('shell:openPath', p),
  showInFolder: (p: string) => ipcRenderer.invoke('shell:showInFolder', p),
};

contextBridge.exposeInMainWorld('api', api);
