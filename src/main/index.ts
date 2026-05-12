import { app, BrowserWindow } from 'electron';
import { join } from 'path';

app.whenReady().then(() => {
  const win = new BrowserWindow({ width: 1400, height: 900 });
  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
});
app.on('window-all-closed', () => app.quit());
