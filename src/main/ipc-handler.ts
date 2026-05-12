import { ipcMain, BrowserWindow } from 'electron';
import { createPtyManager } from './pty-manager';
import { IPC } from '../types';
import type { PtyCreatePayload, PtyInputPayload, PtyResizePayload, PtyDestroyPayload } from '../types';

export function setupIpc(win: BrowserWindow): () => void {
  const mgr = createPtyManager({
    onData:   (id, data)   => win.webContents.send(IPC.PTY_DATA,   { id, data }),
    onStatus: (id, status) => win.webContents.send(IPC.PTY_STATUS, { id, status }),
    onExit:   (id, code)   => win.webContents.send(IPC.PTY_EXIT,   { id, code }),
  });

  ipcMain.handle(IPC.PTY_CREATE, (_e, p: PtyCreatePayload) => {
    const id = mgr.create(p.path, p.title);
    return { id };
  });

  ipcMain.on(IPC.PTY_INPUT,   (_e, p: PtyInputPayload)   => mgr.write(p.id, p.data));
  ipcMain.on(IPC.PTY_RESIZE,  (_e, p: PtyResizePayload)  => mgr.resize(p.id, p.cols, p.rows));
  ipcMain.on(IPC.PTY_DESTROY, (_e, p: PtyDestroyPayload) => mgr.destroy(p.id));

  return () => {
    mgr.destroyAll();
    ipcMain.removeHandler(IPC.PTY_CREATE);
    ipcMain.removeAllListeners(IPC.PTY_INPUT);
    ipcMain.removeAllListeners(IPC.PTY_RESIZE);
    ipcMain.removeAllListeners(IPC.PTY_DESTROY);
  };
}
