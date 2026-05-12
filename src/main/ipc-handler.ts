import { ipcMain, BrowserWindow, dialog } from 'electron';
import { createPtyManager } from './pty-manager';
import { IPC } from '../types';
import type { PtyCreatePayload, PtyInputPayload, PtyResizePayload, PtyDestroyPayload } from '../types';

export function setupIpc(win: BrowserWindow): () => void {
  const mgr = createPtyManager({
    onData:   (id, data)   => { if (!win.isDestroyed()) win.webContents.send(IPC.PTY_DATA,   { id, data }); },
    onStatus: (id, status) => { if (!win.isDestroyed()) win.webContents.send(IPC.PTY_STATUS, { id, status }); },
    onExit:   (id, code)   => { if (!win.isDestroyed()) win.webContents.send(IPC.PTY_EXIT,   { id, code }); },
  });

  ipcMain.handle(IPC.PTY_CREATE, (_e, p: PtyCreatePayload) => {
    try {
      const id = mgr.create(p.path, p.title);
      return { id };
    } catch (err) {
      return { error: err instanceof Error ? err.message : String(err) };
    }
  });

  const onInput   = (_e: Electron.IpcMainEvent, p: PtyInputPayload)   => mgr.write(p.id, p.data);
  const onResize  = (_e: Electron.IpcMainEvent, p: PtyResizePayload)  => mgr.resize(p.id, p.cols, p.rows);
  const onDestroy = (_e: Electron.IpcMainEvent, p: PtyDestroyPayload) => mgr.destroy(p.id);

  ipcMain.on(IPC.PTY_INPUT,   onInput);
  ipcMain.on(IPC.PTY_RESIZE,  onResize);
  ipcMain.on(IPC.PTY_DESTROY, onDestroy);

  ipcMain.handle(IPC.DIALOG_BROWSE, async () => {
    const result = await dialog.showOpenDialog(win, {
      properties: ['openDirectory'],
      title: 'Select Working Directory',
    });
    return result.canceled ? null : result.filePaths[0];
  });

  return () => {
    mgr.destroyAll();
    ipcMain.removeHandler(IPC.PTY_CREATE);
    ipcMain.removeHandler(IPC.DIALOG_BROWSE);
    ipcMain.removeListener(IPC.PTY_INPUT,   onInput);
    ipcMain.removeListener(IPC.PTY_RESIZE,  onResize);
    ipcMain.removeListener(IPC.PTY_DESTROY, onDestroy);
  };
}
