import { contextBridge, ipcRenderer } from 'electron';
import { IPC } from '../types';
import type {
  PtyCreatePayload, PtyCreatedPayload,
  PtyInputPayload, PtyResizePayload, PtyDestroyPayload,
  PtyDataPayload, PtyStatusPayload, PtyExitPayload,
} from '../types';

contextBridge.exposeInMainWorld('api', {
  createPty:  (p: PtyCreatePayload): Promise<PtyCreatedPayload> => ipcRenderer.invoke(IPC.PTY_CREATE, p),
  sendInput:  (p: PtyInputPayload)  => ipcRenderer.send(IPC.PTY_INPUT,   p),
  resizePty:  (p: PtyResizePayload) => ipcRenderer.send(IPC.PTY_RESIZE,  p),
  destroyPty: (p: PtyDestroyPayload)=> ipcRenderer.send(IPC.PTY_DESTROY, p),

  onData: (cb: (p: PtyDataPayload) => void) => {
    const fn = (_: Electron.IpcRendererEvent, p: PtyDataPayload) => cb(p);
    ipcRenderer.on(IPC.PTY_DATA, fn);
    return () => ipcRenderer.removeListener(IPC.PTY_DATA, fn);
  },
  onStatus: (cb: (p: PtyStatusPayload) => void) => {
    const fn = (_: Electron.IpcRendererEvent, p: PtyStatusPayload) => cb(p);
    ipcRenderer.on(IPC.PTY_STATUS, fn);
    return () => ipcRenderer.removeListener(IPC.PTY_STATUS, fn);
  },
  onExit: (cb: (p: PtyExitPayload) => void) => {
    const fn = (_: Electron.IpcRendererEvent, p: PtyExitPayload) => cb(p);
    ipcRenderer.on(IPC.PTY_EXIT, fn);
    return () => ipcRenderer.removeListener(IPC.PTY_EXIT, fn);
  },
});
