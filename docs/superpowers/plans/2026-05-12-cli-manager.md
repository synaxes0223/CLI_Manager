# CLI Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a local Electron desktop app that shows all open terminal sessions in a live grid, highlights those waiting for user input (e.g., Claude Code prompts), and lets you click any terminal to interact with it full-screen.

**Architecture:** Electron main process owns all `node-pty` PTY instances and runs the pending-detection engine; the renderer is a React app that owns `xterm.js` instances and renders the grid. Communication is via Electron IPC. The grid shows all terminals as read-only live previews (scaled to fit their cells); clicking one moves the xterm DOM element into a full-screen overlay and enables keyboard input.

**Tech Stack:** Electron 28, React 18, TypeScript, xterm.js 5 (`@xterm/xterm`), `@xterm/addon-fit`, `node-pty`, `electron-vite`, Vitest

---

## File Map

```
cli-manager/
├── electron.vite.config.ts        — electron-vite build config
├── package.json
├── tsconfig.json
├── src/
│   ├── types.ts                   — shared TerminalState, IPC constants, payload types
│   ├── main/
│   │   ├── index.ts               — Electron app entry, BrowserWindow creation
│   │   ├── ipc-handler.ts         — ipcMain channel setup, bridges renderer ↔ PTY manager
│   │   ├── pty-manager.ts         — node-pty lifecycle (create, write, resize, destroy)
│   │   ├── pending-detector.ts    — pattern matching + idle timeout detection
│   │   └── __tests__/
│   │       ├── pending-detector.test.ts
│   │       └── pty-manager.test.ts
│   ├── preload/
│   │   └── index.ts               — contextBridge API exposed to renderer
│   └── renderer/
│       ├── index.html
│       ├── main.tsx               — React entry point
│       ├── env.d.ts               — Window.api type declarations
│       ├── App.tsx                — root component (terminal list, maximizedId, columns)
│       ├── lib/
│       │   ├── pty-bus.ts         — singleton IPC data dispatcher (routes pty:data per terminal)
│       │   └── xterm-store.ts     — module-level map of Terminal + FitAddon instances
│       ├── hooks/
│       │   └── useTerminals.ts    — terminal list state + status/exit IPC listeners
│       └── components/
│           ├── TopBar.tsx         — app header: New button, columns selector, pending badge
│           ├── TopBar.module.css
│           ├── TerminalGrid.tsx   — CSS grid container, renders TerminalCell per terminal
│           ├── TerminalGrid.module.css
│           ├── TerminalCell.tsx   — single cell: mounts xterm, status badge, title, rename
│           ├── TerminalCell.module.css
│           ├── MaximizeOverlay.tsx — full-screen overlay: moves xterm DOM, enables input
│           ├── MaximizeOverlay.module.css
│           ├── NewTerminalDialog.tsx — modal: path picker, optional title, create button
│           ├── NewTerminalDialog.module.css
│           └── global.css         — dark theme base, xterm overrides, pending animation
```

> **IPC surface** (extends spec to add `pty:resize`):
>
> | Channel | Direction | Payload |
> |---|---|---|
> | `pty:create` | renderer → main | `{ path, title? }` |
> | `pty:created` | main → renderer | `{ id }` (invoke response) |
> | `pty:input` | renderer → main | `{ id, data }` |
> | `pty:resize` | renderer → main | `{ id, cols, rows }` |
> | `pty:destroy` | renderer → main | `{ id }` |
> | `pty:data` | main → renderer | `{ id, data }` |
> | `pty:status` | main → renderer | `{ id, status }` |
> | `pty:exit` | main → renderer | `{ id, code }` |

---

## Task 1: Project Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `electron.vite.config.ts`
- Create: `src/renderer/index.html`
- Create: `src/main/index.ts` (stub)
- Create: `src/preload/index.ts` (stub)
- Create: `src/renderer/main.tsx` (stub)
- Create: `.gitignore`

- [ ] **Step 1: Write `package.json`**

```json
{
  "name": "cli-manager",
  "version": "0.1.0",
  "description": "Local terminal session manager",
  "main": "dist/main/index.js",
  "scripts": {
    "dev": "electron-vite dev",
    "build": "electron-vite build",
    "start": "electron .",
    "test": "vitest run src/main/__tests__"
  },
  "dependencies": {
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/xterm": "^5.5.0",
    "node-pty": "^1.0.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.2.0",
    "electron": "^28.0.0",
    "electron-builder": "^24.9.0",
    "electron-vite": "^2.0.0",
    "typescript": "^5.3.0",
    "vite": "^5.0.0",
    "vitest": "^1.2.0"
  }
}
```

- [ ] **Step 2: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "esModuleInterop": true,
    "skipLibCheck": true,
    "types": ["node", "vite/client"]
  },
  "include": ["src/**/*", "electron.vite.config.ts"]
}
```

- [ ] **Step 3: Write `electron.vite.config.ts`**

```typescript
import { defineConfig, externalizeDepsPlugin } from 'electron-vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
  },
  renderer: {
    plugins: [react()],
  },
});
```

- [ ] **Step 4: Write `src/renderer/index.html`**

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="UTF-8" />
    <title>CLI Manager</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/renderer/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 5: Write stub entry files**

`src/main/index.ts`:
```typescript
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
```

`src/preload/index.ts`:
```typescript
// stub — filled in Task 2
```

`src/renderer/main.tsx`:
```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><div style={{ color: '#fff', background: '#0d1117', height: '100vh' }}>CLI Manager scaffold</div></React.StrictMode>
);
```

- [ ] **Step 6: Write `.gitignore`**

```
node_modules/
dist/
dist-electron/
out/
.superpowers/
```

- [ ] **Step 7: Install dependencies**

```
npm install
```

Expected: node_modules populated, no errors.

- [ ] **Step 8: Rebuild node-pty for Electron**

```
npx electron-rebuild -f -w node-pty
```

Expected: `✓ Rebuild Complete` with no errors. If `electron-rebuild` is not found, install it first: `npm install --save-dev electron-rebuild`.

- [ ] **Step 9: Verify dev server starts**

```
npm run dev
```

Expected: Electron window opens showing "CLI Manager scaffold" on a dark background. Close it.

- [ ] **Step 10: Commit**

```
git add package.json tsconfig.json electron.vite.config.ts src/ .gitignore
git commit -m "feat: project scaffold with electron-vite"
```

---

## Task 2: Shared Types + Preload Bridge

**Files:**
- Create: `src/types.ts`
- Modify: `src/preload/index.ts`
- Create: `src/renderer/env.d.ts`

- [ ] **Step 1: Write `src/types.ts`**

```typescript
export type TerminalStatus = 'idle' | 'running' | 'pending';

export interface TerminalState {
  id: string;
  path: string;
  title?: string;
  status: TerminalStatus;
  exitCode?: number;
}

export const IPC = {
  PTY_CREATE:  'pty:create',
  PTY_CREATED: 'pty:created',
  PTY_INPUT:   'pty:input',
  PTY_RESIZE:  'pty:resize',
  PTY_DESTROY: 'pty:destroy',
  PTY_DATA:    'pty:data',
  PTY_STATUS:  'pty:status',
  PTY_EXIT:    'pty:exit',
} as const;

export interface PtyCreatePayload  { path: string; title?: string }
export interface PtyCreatedPayload { id: string }
export interface PtyInputPayload   { id: string; data: string }
export interface PtyResizePayload  { id: string; cols: number; rows: number }
export interface PtyDestroyPayload { id: string }
export interface PtyDataPayload    { id: string; data: string }
export interface PtyStatusPayload  { id: string; status: TerminalStatus }
export interface PtyExitPayload    { id: string; code: number }
```

- [ ] **Step 2: Write `src/preload/index.ts`**

```typescript
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
```

- [ ] **Step 3: Write `src/renderer/env.d.ts`**

```typescript
import type {
  PtyCreatePayload, PtyCreatedPayload,
  PtyInputPayload, PtyResizePayload, PtyDestroyPayload,
  PtyDataPayload, PtyStatusPayload, PtyExitPayload,
} from '../types';

declare global {
  interface Window {
    api: {
      createPty:  (p: PtyCreatePayload)  => Promise<PtyCreatedPayload>;
      sendInput:  (p: PtyInputPayload)   => void;
      resizePty:  (p: PtyResizePayload)  => void;
      destroyPty: (p: PtyDestroyPayload) => void;
      onData:   (cb: (p: PtyDataPayload)   => void) => () => void;
      onStatus: (cb: (p: PtyStatusPayload) => void) => () => void;
      onExit:   (cb: (p: PtyExitPayload)   => void) => () => void;
    };
  }
}
```

- [ ] **Step 4: Commit**

```
git add src/types.ts src/preload/index.ts src/renderer/env.d.ts
git commit -m "feat: shared types and preload contextBridge"
```

---

## Task 3: Pending Detector (TDD)

**Files:**
- Create: `src/main/pending-detector.ts`
- Create: `src/main/__tests__/pending-detector.test.ts`

- [ ] **Step 1: Write the failing tests**

`src/main/__tests__/pending-detector.test.ts`:
```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPendingDetector } from '../pending-detector';

describe('createPendingDetector', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('emits running on first data', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('some output\n');
    expect(cb).toHaveBeenCalledWith('running');
  });

  it('emits pending on claude prompt', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('claude >');
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('emits pending on [y/N]', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('Continue? [y/N]');
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('emits pending on ? prefix', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('? Select an option');
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('emits pending after idle timeout', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('watching...\n');
    vi.advanceTimersByTime(10000);
    expect(cb).toHaveBeenLastCalledWith('pending');
  });

  it('does not emit pending before idle timeout elapses', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('watching...\n');
    vi.advanceTimersByTime(5000);
    expect(cb).not.toHaveBeenCalledWith('pending');
  });

  it('resets to running when new data arrives after pending', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('claude >');
    det.feed('yes\n');
    expect(cb).toHaveBeenLastCalledWith('running');
  });

  it('does not emit duplicate status', () => {
    const det = createPendingDetector();
    const cb = vi.fn();
    det.onStatusChange(cb);
    det.feed('claude >');
    det.feed('claude >'); // same status — should not re-emit
    expect(cb).toHaveBeenCalledTimes(2); // running then pending (only once each)
  });

  it('destroy clears timer', () => {
    const det = createPendingDetector();
    det.feed('some output\n');
    det.destroy();
    // should not throw or emit after destroy
    vi.advanceTimersByTime(15000);
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test
```

Expected: all tests fail with "Cannot find module '../pending-detector'"

- [ ] **Step 3: Write `src/main/pending-detector.ts`**

```typescript
export interface PendingDetector {
  feed(data: string): void;
  onStatusChange(cb: (status: 'running' | 'pending') => void): void;
  destroy(): void;
}

const DEFAULT_PATTERNS: RegExp[] = [
  /claude\s*>\s*$/m,
  /^\?\s+.+/m,
  /\[y\/[Nn]\]\s*$/im,
  /\[Y\/n\]\s*$/m,
  /Password:\s*$/im,
  /Enter passphrase:\s*$/im,
];

const IDLE_TIMEOUT_MS = 10_000;

export function createPendingDetector(patterns = DEFAULT_PATTERNS): PendingDetector {
  let cb: ((s: 'running' | 'pending') => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let current: 'running' | 'pending' | null = null;

  function emit(s: 'running' | 'pending') {
    if (current === s) return;
    current = s;
    cb?.(s);
  }

  function resetTimer() {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => emit('pending'), IDLE_TIMEOUT_MS);
  }

  return {
    feed(data) {
      emit('running');
      resetTimer();
      if (patterns.some(p => p.test(data))) {
        if (timer) clearTimeout(timer);
        timer = null;
        emit('pending');
      }
    },
    onStatusChange(handler) {
      cb = handler;
    },
    destroy() {
      if (timer) clearTimeout(timer);
      timer = null;
      cb = null;
    },
  };
}
```

- [ ] **Step 4: Run tests to confirm they pass**

```
npm test
```

Expected: all 9 tests pass.

- [ ] **Step 5: Commit**

```
git add src/main/pending-detector.ts src/main/__tests__/pending-detector.test.ts
git commit -m "feat: pending detector with pattern matching and idle timeout"
```

---

## Task 4: PTY Manager + IPC Handler + Main Entry

**Files:**
- Create: `src/main/pty-manager.ts`
- Create: `src/main/ipc-handler.ts`
- Modify: `src/main/index.ts`
- Create: `src/main/__tests__/pty-manager.test.ts`

- [ ] **Step 1: Write the failing PTY manager tests**

`src/main/__tests__/pty-manager.test.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { createPtyManager } from '../pty-manager';

// node-pty is not available in the test runner (native module).
// Mock it at the module level.
vi.mock('node-pty', () => ({
  spawn: vi.fn(() => ({
    onData: vi.fn(cb => { (cb as Function)('hello'); }),
    onExit: vi.fn(),
    write: vi.fn(),
    resize: vi.fn(),
    kill: vi.fn(),
  })),
}));

describe('createPtyManager', () => {
  it('create returns a string id', () => {
    const mgr = createPtyManager({ onData: vi.fn(), onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('create calls onData when PTY emits', () => {
    const onData = vi.fn();
    const mgr = createPtyManager({ onData, onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    expect(onData).toHaveBeenCalledWith(id, 'hello');
  });

  it('write calls pty.write', async () => {
    const { spawn } = await import('node-pty');
    const mgr = createPtyManager({ onData: vi.fn(), onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    mgr.write(id, 'ls\n');
    const mockPty = (spawn as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(mockPty.write).toHaveBeenCalledWith('ls\n');
  });

  it('destroy calls pty.kill', async () => {
    const { spawn } = await import('node-pty');
    const mgr = createPtyManager({ onData: vi.fn(), onStatus: vi.fn(), onExit: vi.fn() });
    const id = mgr.create('C:\\', undefined);
    mgr.destroy(id);
    const mockPty = (spawn as ReturnType<typeof vi.fn>).mock.results.at(-1)?.value;
    expect(mockPty.kill).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```
npm test
```

Expected: PTY manager tests fail with "Cannot find module '../pty-manager'".

- [ ] **Step 3: Write `src/main/pty-manager.ts`**

```typescript
import { spawn } from 'node-pty';
import { randomUUID } from 'crypto';
import { createPendingDetector } from './pending-detector';
import type { TerminalStatus } from '../types';

export interface PtyManagerCallbacks {
  onData:   (id: string, data: string) => void;
  onStatus: (id: string, status: TerminalStatus) => void;
  onExit:   (id: string, code: number) => void;
}

export function createPtyManager(callbacks: PtyManagerCallbacks) {
  type Entry = {
    pty: ReturnType<typeof spawn>;
    detector: ReturnType<typeof createPendingDetector>;
  };
  const map = new Map<string, Entry>();

  return {
    create(path: string, title: string | undefined): string {
      const id = randomUUID();
      const shell = process.platform === 'win32' ? 'powershell.exe' : 'bash';
      const args  = process.platform === 'win32' ? ['-NoLogo'] : [];

      const pty = spawn(shell, args, {
        name: 'xterm-color',
        cwd: path,
        env: { ...process.env } as Record<string, string>,
        cols: 80,
        rows: 24,
      });

      const detector = createPendingDetector();
      detector.onStatusChange(status => callbacks.onStatus(id, status));

      pty.onData(data => {
        detector.feed(data);
        callbacks.onData(id, data);
      });

      pty.onExit(({ exitCode }) => {
        detector.destroy();
        map.delete(id);
        callbacks.onExit(id, exitCode ?? 0);
      });

      map.set(id, { pty, detector });
      return id;
    },

    write(id: string, data: string) {
      map.get(id)?.pty.write(data);
    },

    resize(id: string, cols: number, rows: number) {
      map.get(id)?.pty.resize(cols, rows);
    },

    destroy(id: string) {
      const entry = map.get(id);
      if (!entry) return;
      entry.detector.destroy();
      entry.pty.kill();
      map.delete(id);
    },

    destroyAll() {
      for (const [id] of map) this.destroy(id);
    },
  };
}
```

- [ ] **Step 4: Write `src/main/ipc-handler.ts`**

```typescript
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
```

- [ ] **Step 5: Rewrite `src/main/index.ts`**

```typescript
import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { setupIpc } from './ipc-handler';

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    backgroundColor: '#0d1117',
    titleBarStyle: 'hiddenInset',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  const cleanup = setupIpc(win);
  win.on('closed', cleanup);

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => app.quit());
```

- [ ] **Step 6: Run all tests**

```
npm test
```

Expected: all 13 tests pass (9 pending-detector + 4 pty-manager).

- [ ] **Step 7: Commit**

```
git add src/main/pty-manager.ts src/main/ipc-handler.ts src/main/index.ts src/main/__tests__/pty-manager.test.ts
git commit -m "feat: PTY manager, IPC handler, and Electron main entry"
```

---

## Task 5: Renderer Infrastructure

**Files:**
- Create: `src/renderer/lib/pty-bus.ts`
- Create: `src/renderer/lib/xterm-store.ts`
- Create: `src/renderer/hooks/useTerminals.ts`

- [ ] **Step 1: Write `src/renderer/lib/pty-bus.ts`**

Singleton module that calls `window.api.onData` exactly once and routes data to per-terminal handlers.

```typescript
type DataHandler = (data: string) => void;
const handlers = new Map<string, DataHandler>();
let initialized = false;

function ensureListening() {
  if (initialized) return;
  initialized = true;
  window.api.onData(({ id, data }) => handlers.get(id)?.(data));
}

export const ptyBus = {
  subscribe(id: string, handler: DataHandler): () => void {
    ensureListening();
    handlers.set(id, handler);
    return () => handlers.delete(id);
  },
};
```

- [ ] **Step 2: Write `src/renderer/lib/xterm-store.ts`**

Module-level map that holds the live xterm Terminal + FitAddon for each terminal ID. Both `TerminalCell` (which creates the xterm) and `MaximizeOverlay` (which moves it) read from this store.

```typescript
import type { Terminal } from '@xterm/xterm';
import type { FitAddon } from '@xterm/addon-fit';

export interface XtermEntry {
  term: Terminal;
  fit: FitAddon;
}

const store = new Map<string, XtermEntry>();

export const xtermStore = {
  set(id: string, entry: XtermEntry): void {
    store.set(id, entry);
  },
  get(id: string): XtermEntry | undefined {
    return store.get(id);
  },
  remove(id: string): void {
    const entry = store.get(id);
    entry?.term.dispose();
    store.delete(id);
  },
};
```

- [ ] **Step 3: Write `src/renderer/hooks/useTerminals.ts`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import type { TerminalState } from '../../types';

export function useTerminals() {
  const [terminals, setTerminals] = useState<TerminalState[]>([]);

  useEffect(() => {
    const offStatus = window.api.onStatus(({ id, status }) =>
      setTerminals(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    );
    const offExit = window.api.onExit(({ id, code }) =>
      setTerminals(prev => prev.map(t => t.id === id ? { ...t, status: 'idle', exitCode: code } : t))
    );
    return () => { offStatus(); offExit(); };
  }, []);

  const createTerminal = useCallback(async (path: string, title?: string) => {
    const { id } = await window.api.createPty({ path, title });
    setTerminals(prev => [...prev, { id, path, title, status: 'running' }]);
    return id;
  }, []);

  const destroyTerminal = useCallback((id: string) => {
    window.api.destroyPty({ id });
    setTerminals(prev => prev.filter(t => t.id !== id));
  }, []);

  const renameTerminal = useCallback((id: string, title: string) => {
    setTerminals(prev =>
      prev.map(t => t.id === id ? { ...t, title: title.trim() || undefined } : t)
    );
  }, []);

  return { terminals, createTerminal, destroyTerminal, renameTerminal };
}
```

- [ ] **Step 4: Commit**

```
git add src/renderer/lib/pty-bus.ts src/renderer/lib/xterm-store.ts src/renderer/hooks/useTerminals.ts
git commit -m "feat: renderer pty-bus, xterm-store, and useTerminals hook"
```

---

## Task 6: TerminalCell Component

**Files:**
- Create: `src/renderer/components/TerminalCell.tsx`
- Create: `src/renderer/components/TerminalCell.module.css`

- [ ] **Step 1: Write `src/renderer/components/TerminalCell.module.css`**

```css
.cell {
  display: flex;
  flex-direction: column;
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 6px;
  padding: 6px;
  cursor: pointer;
  overflow: hidden;
  transition: border-color 0.15s;
}

.cell:hover {
  border-color: #58a6ff;
}

.cell.pending {
  border: 2px solid #da3633;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(218, 54, 51, 0.4); }
  50%       { box-shadow: 0 0 0 5px rgba(218, 54, 51, 0); }
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 2px;
  flex-shrink: 0;
}

.status {
  font-size: 10px;
  font-family: monospace;
}

.status.running { color: #3fb950; }
.status.pending { color: #da3633; font-weight: bold; }
.status.idle    { color: #8b949e; }

.close {
  background: none;
  border: none;
  color: #8b949e;
  font-size: 12px;
  cursor: pointer;
  padding: 0 2px;
  line-height: 1;
}
.close:hover { color: #da3633; }

.title {
  font-size: 11px;
  font-weight: bold;
  color: #e6edf3;
  font-family: system-ui, sans-serif;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex-shrink: 0;
}

.titleInput {
  font-size: 11px;
  font-weight: bold;
  font-family: system-ui, sans-serif;
  background: #0d1117;
  border: 1px solid #388bfd;
  border-radius: 3px;
  color: #e6edf3;
  padding: 1px 4px;
  width: 100%;
  box-sizing: border-box;
  flex-shrink: 0;
}

.path {
  font-size: 9px;
  color: #58a6ff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 3px;
  flex-shrink: 0;
}

.path.dimmed { opacity: 0.6; }

.xtermContainer {
  flex: 1;
  overflow: hidden;
  border-radius: 3px;
  background: #0d1117;
  pointer-events: none;
}

.exited {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: #8b949e;
  font-family: monospace;
}
```

- [ ] **Step 2: Write `src/renderer/components/TerminalCell.tsx`**

```typescript
import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { ptyBus } from '../lib/pty-bus';
import { xtermStore } from '../lib/xterm-store';
import type { TerminalState } from '../../types';
import styles from './TerminalCell.module.css';

interface Props {
  terminal: TerminalState;
  onMaximize: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function TerminalCell({ terminal, onMaximize, onClose, onRename }: Props) {
  const { id, path, title, status, exitCode } = terminal;
  const containerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title ?? '');

  useEffect(() => {
    if (!containerRef.current) return;

    const term = new Terminal({
      theme: { background: '#0d1117', foreground: '#c9d1d9', cursor: '#c9d1d9' },
      fontSize: 11,
      fontFamily: 'Consolas, "Courier New", monospace',
      scrollback: 1000,
      disableStdin: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(containerRef.current);
    fit.fit();

    xtermStore.set(id, { term, fit });

    const unsub = ptyBus.subscribe(id, data => term.write(data));
    const observer = new ResizeObserver(() => fit.fit());
    observer.observe(containerRef.current);

    return () => {
      unsub();
      observer.disconnect();
      xtermStore.remove(id);
    };
  }, [id]);

  function commitRename() {
    setEditing(false);
    onRename(id, draft);
  }

  const statusLabel =
    status === 'pending' ? '● PENDING' :
    status === 'running' ? '● running' : '○ idle';

  return (
    <div
      className={`${styles.cell} ${status === 'pending' ? styles.pending : ''}`}
      onClick={() => !editing && onMaximize(id)}
    >
      <div className={styles.header}>
        <span className={`${styles.status} ${styles[status]}`}>{statusLabel}</span>
        <button
          className={styles.close}
          onClick={e => { e.stopPropagation(); onClose(id); }}
        >✕</button>
      </div>

      {editing ? (
        <input
          className={styles.titleInput}
          value={draft}
          autoFocus
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') commitRename();
            if (e.key === 'Escape') { setEditing(false); setDraft(title ?? ''); }
          }}
          onBlur={commitRename}
          onClick={e => e.stopPropagation()}
        />
      ) : title ? (
        <div
          className={styles.title}
          onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(title); }}
        >{title}</div>
      ) : null}

      <div
        className={`${styles.path} ${title ? styles.dimmed : ''}`}
        onDoubleClick={e => { e.stopPropagation(); setEditing(true); setDraft(title ?? ''); }}
      >{path}</div>

      {exitCode !== undefined ? (
        <div className={styles.exited}>exited ({exitCode})</div>
      ) : (
        <div ref={containerRef} className={styles.xtermContainer} id={`cell-xterm-${id}`} />
      )}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/renderer/components/TerminalCell.tsx src/renderer/components/TerminalCell.module.css
git commit -m "feat: TerminalCell component with live xterm preview and inline rename"
```

---

## Task 7: MaximizeOverlay Component

**Files:**
- Create: `src/renderer/components/MaximizeOverlay.tsx`
- Create: `src/renderer/components/MaximizeOverlay.module.css`

- [ ] **Step 1: Write `src/renderer/components/MaximizeOverlay.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: #0d1117;
  display: flex;
  flex-direction: column;
  z-index: 100;
}

.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
}

.header.pending {
  border-bottom-color: #da3633;
}

.status {
  font-size: 11px;
  font-family: monospace;
}
.status.running { color: #3fb950; }
.status.pending { color: #da3633; font-weight: bold; }
.status.idle    { color: #8b949e; }

.name {
  font-size: 13px;
  font-weight: bold;
  color: #e6edf3;
  font-family: system-ui, sans-serif;
}

.path {
  font-size: 11px;
  color: #58a6ff;
  font-family: monospace;
}

.actions {
  margin-left: auto;
  display: flex;
  gap: 8px;
}

.btn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
}
.btn:hover { background: #30363d; }
.btnClose:hover { background: #5a1d1d; border-color: #da3633; color: #ffa0a0; }

.xtermContainer {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

.hint {
  font-size: 10px;
  color: #484f58;
  text-align: center;
  padding: 3px;
  font-family: monospace;
  flex-shrink: 0;
}
```

- [ ] **Step 2: Write `src/renderer/components/MaximizeOverlay.tsx`**

The overlay moves the xterm DOM element from the cell container into itself on open, then back on close. It enables `disableStdin: false` and wires keyboard input to the PTY.

```typescript
import React, { useEffect, useRef } from 'react';
import { xtermStore } from '../lib/xterm-store';
import type { TerminalState } from '../../types';
import type { IDisposable } from '@xterm/xterm';
import styles from './MaximizeOverlay.module.css';

interface Props {
  terminal: TerminalState;
  onMinimize: () => void;
  onClose: (id: string) => void;
}

export function MaximizeOverlay({ terminal, onMinimize, onClose }: Props) {
  const { id, path, title, status } = terminal;
  const containerRef = useRef<HTMLDivElement>(null);
  const inputDisposable = useRef<IDisposable | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    const entry = xtermStore.get(id);
    if (!container || !entry) return;

    // Move xterm DOM element into the overlay container
    container.appendChild(entry.term.element);
    entry.term.options.disableStdin = false;
    entry.fit.fit();
    window.api.resizePty({ id, cols: entry.term.cols, rows: entry.term.rows });

    // Wire keyboard input to PTY
    inputDisposable.current = entry.term.onData(data =>
      window.api.sendInput({ id, data })
    );

    // Refocus xterm so keystrokes register immediately
    entry.term.focus();

    return () => {
      // Move element back to the cell container
      const cellContainer = document.getElementById(`cell-xterm-${id}`);
      if (cellContainer && entry.term.element.parentNode === container) {
        cellContainer.appendChild(entry.term.element);
      }
      entry.term.options.disableStdin = true;
      inputDisposable.current?.dispose();
      inputDisposable.current = null;
      entry.fit.fit();
      window.api.resizePty({ id, cols: entry.term.cols, rows: entry.term.rows });
    };
  }, [id]);

  const statusLabel =
    status === 'pending' ? '● PENDING' :
    status === 'running' ? '● running' : '○ idle';

  return (
    <div className={styles.overlay}>
      <div className={`${styles.header} ${status === 'pending' ? styles.pending : ''}`}>
        <span className={`${styles.status} ${styles[status]}`}>{statusLabel}</span>
        {title && <span className={styles.name}>{title}</span>}
        <span className={styles.path}>{path}</span>
        <div className={styles.actions}>
          <button className={styles.btn} onClick={onMinimize}>⛶ Minimize</button>
          <button className={`${styles.btn} ${styles.btnClose}`} onClick={() => onClose(id)}>✕ Close</button>
        </div>
      </div>
      <div ref={containerRef} className={styles.xtermContainer} />
      <div className={styles.hint}>Input active — type your response and press Enter</div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/renderer/components/MaximizeOverlay.tsx src/renderer/components/MaximizeOverlay.module.css
git commit -m "feat: MaximizeOverlay with DOM-moved xterm and interactive input"
```

---

## Task 8: NewTerminalDialog Component

**Files:**
- Create: `src/renderer/components/NewTerminalDialog.tsx`
- Create: `src/renderer/components/NewTerminalDialog.module.css`

- [ ] **Step 1: Write `src/renderer/components/NewTerminalDialog.module.css`**

```css
.backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 200;
}

.dialog {
  background: #161b22;
  border: 1px solid #30363d;
  border-radius: 8px;
  padding: 20px;
  width: 480px;
  display: flex;
  flex-direction: column;
  gap: 14px;
}

.dialog h2 {
  margin: 0;
  font-size: 15px;
  font-weight: 600;
  color: #e6edf3;
  font-family: system-ui, sans-serif;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.label {
  font-size: 11px;
  color: #8b949e;
  font-family: system-ui, sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.inputRow {
  display: flex;
  gap: 6px;
}

.input {
  flex: 1;
  background: #0d1117;
  border: 1px solid #30363d;
  border-radius: 4px;
  color: #c9d1d9;
  font-size: 13px;
  padding: 6px 10px;
  font-family: monospace;
}
.input:focus { outline: none; border-color: #388bfd; }

.browseBtn {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 12px;
  padding: 6px 12px;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
}
.browseBtn:hover { background: #30363d; }

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 4px;
}

.cancelBtn {
  background: none;
  border: 1px solid #30363d;
  color: #8b949e;
  font-size: 13px;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
}
.cancelBtn:hover { background: #21262d; }

.createBtn {
  background: #238636;
  border: 1px solid #2ea043;
  color: #fff;
  font-size: 13px;
  padding: 6px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.createBtn:hover { background: #2ea043; }
.createBtn:disabled { opacity: 0.5; cursor: not-allowed; }
```

- [ ] **Step 2: Write `src/renderer/components/NewTerminalDialog.tsx`**

```typescript
import React, { useState } from 'react';
import styles from './NewTerminalDialog.module.css';

interface Props {
  lastPath: string;
  onCreate: (path: string, title?: string) => void;
  onCancel: () => void;
}

export function NewTerminalDialog({ lastPath, onCreate, onCancel }: Props) {
  const [path, setPath]   = useState(lastPath);
  const [title, setTitle] = useState('');

  async function handleBrowse() {
    // electron showOpenDialog is exposed via api if needed;
    // for now, the user types the path manually.
    // Future: add window.api.browseFolder() to preload.
  }

  function handleCreate() {
    const trimmed = path.trim();
    if (!trimmed) return;
    onCreate(trimmed, title.trim() || undefined);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter') handleCreate();
    if (e.key === 'Escape') onCancel();
  }

  return (
    <div className={styles.backdrop} onClick={onCancel}>
      <div className={styles.dialog} onClick={e => e.stopPropagation()} onKeyDown={handleKeyDown}>
        <h2>New Terminal</h2>

        <div className={styles.field}>
          <label className={styles.label}>Working Directory</label>
          <div className={styles.inputRow}>
            <input
              className={styles.input}
              value={path}
              onChange={e => setPath(e.target.value)}
              placeholder="C:\Users\you\project"
              autoFocus
            />
            <button className={styles.browseBtn} onClick={handleBrowse}>Browse…</button>
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Title <span style={{ color: '#484f58' }}>(optional)</span></label>
          <input
            className={styles.input}
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Frontend Dev"
          />
        </div>

        <div className={styles.actions}>
          <button className={styles.cancelBtn} onClick={onCancel}>Cancel</button>
          <button className={styles.createBtn} onClick={handleCreate} disabled={!path.trim()}>
            Create
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```
git add src/renderer/components/NewTerminalDialog.tsx src/renderer/components/NewTerminalDialog.module.css
git commit -m "feat: NewTerminalDialog modal with path and optional title"
```

---

## Task 9: TopBar + TerminalGrid + App + Global Styles

**Files:**
- Create: `src/renderer/components/TopBar.tsx`
- Create: `src/renderer/components/TopBar.module.css`
- Create: `src/renderer/components/TerminalGrid.tsx`
- Create: `src/renderer/components/TerminalGrid.module.css`
- Modify: `src/renderer/App.tsx`
- Create: `src/renderer/components/global.css`
- Modify: `src/renderer/main.tsx`

- [ ] **Step 1: Write `src/renderer/components/TopBar.module.css`**

```css
.bar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 12px;
  height: 44px;
  background: #161b22;
  border-bottom: 1px solid #30363d;
  flex-shrink: 0;
  -webkit-app-region: drag;
}

.title {
  font-size: 13px;
  font-weight: 700;
  color: #58a6ff;
  font-family: system-ui, sans-serif;
  -webkit-app-region: no-drag;
}

.controls {
  display: flex;
  gap: 6px;
  -webkit-app-region: no-drag;
}

.newBtn {
  background: #238636;
  border: 1px solid #2ea043;
  color: #fff;
  font-size: 12px;
  padding: 3px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-weight: 600;
}
.newBtn:hover { background: #2ea043; }

.layoutSelect {
  background: #21262d;
  border: 1px solid #30363d;
  color: #c9d1d9;
  font-size: 12px;
  padding: 3px 6px;
  border-radius: 4px;
  cursor: pointer;
}

.right {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 8px;
  -webkit-app-region: no-drag;
}

.pendingBadge {
  background: #da3633;
  color: #fff;
  font-size: 11px;
  padding: 1px 8px;
  border-radius: 10px;
  font-family: monospace;
  animation: fadein 0.2s;
}

.openCount {
  color: #8b949e;
  font-size: 11px;
  font-family: monospace;
}
```

- [ ] **Step 2: Write `src/renderer/components/TopBar.tsx`**

```typescript
import React from 'react';
import styles from './TopBar.module.css';

interface Props {
  columns: number;
  onColumnsChange: (n: number) => void;
  onNewTerminal: () => void;
  pendingCount: number;
  totalCount: number;
}

export function TopBar({ columns, onColumnsChange, onNewTerminal, pendingCount, totalCount }: Props) {
  return (
    <div className={styles.bar}>
      <span className={styles.title}>CLI Manager</span>
      <div className={styles.controls}>
        <button className={styles.newBtn} onClick={onNewTerminal}>+ New</button>
        <select
          className={styles.layoutSelect}
          value={columns}
          onChange={e => onColumnsChange(Number(e.target.value))}
        >
          <option value={1}>1 column</option>
          <option value={2}>2 columns</option>
          <option value={3}>3 columns</option>
          <option value={4}>4 columns</option>
        </select>
      </div>
      <div className={styles.right}>
        {pendingCount > 0 && (
          <span className={styles.pendingBadge}>● {pendingCount} pending</span>
        )}
        <span className={styles.openCount}>{totalCount} open</span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write `src/renderer/components/TerminalGrid.module.css`**

```css
.grid {
  display: grid;
  gap: 6px;
  padding: 8px;
  overflow-y: auto;
  flex: 1;
  align-content: start;
}

.addCell {
  display: flex;
  align-items: center;
  justify-content: center;
  background: #161b22;
  border: 1px dashed #30363d;
  border-radius: 6px;
  height: 160px;
  cursor: pointer;
  color: #484f58;
  font-size: 24px;
  transition: border-color 0.15s, color 0.15s;
}
.addCell:hover { border-color: #58a6ff; color: #58a6ff; }
```

- [ ] **Step 4: Write `src/renderer/components/TerminalGrid.tsx`**

```typescript
import React from 'react';
import type { TerminalState } from '../../types';
import { TerminalCell } from './TerminalCell';
import styles from './TerminalGrid.module.css';

interface Props {
  terminals: TerminalState[];
  columns: number;
  onMaximize: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onNew: () => void;
}

export function TerminalGrid({ terminals, columns, onMaximize, onClose, onRename, onNew }: Props) {
  return (
    <div
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)`, gridAutoRows: '160px' }}
    >
      {terminals.map(t => (
        <TerminalCell
          key={t.id}
          terminal={t}
          onMaximize={onMaximize}
          onClose={onClose}
          onRename={onRename}
        />
      ))}
      <div className={styles.addCell} onClick={onNew}>+</div>
    </div>
  );
}
```

- [ ] **Step 5: Write `src/renderer/components/global.css`**

```css
*, *::before, *::after { box-sizing: border-box; }

html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #0d1117;
  color: #c9d1d9;
  font-family: system-ui, -apple-system, sans-serif;
  overflow: hidden;
}

/* xterm.js overrides */
.xterm { height: 100%; }
.xterm-viewport { overflow: hidden !important; }

button { font-family: inherit; }
select { font-family: inherit; }
input  { font-family: inherit; }
```

- [ ] **Step 6: Write `src/renderer/App.tsx`**

```typescript
import React, { useState } from 'react';
import { useTerminals } from './hooks/useTerminals';
import { TopBar } from './components/TopBar';
import { TerminalGrid } from './components/TerminalGrid';
import { MaximizeOverlay } from './components/MaximizeOverlay';
import { NewTerminalDialog } from './components/NewTerminalDialog';

export function App() {
  const { terminals, createTerminal, destroyTerminal, renameTerminal } = useTerminals();
  const [columns, setColumns]         = useState(2);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showDialog, setShowDialog]   = useState(false);
  const [lastPath, setLastPath]       = useState('C:\\');

  const pendingCount  = terminals.filter(t => t.status === 'pending').length;
  const maximizedTerm = terminals.find(t => t.id === maximizedId);

  async function handleCreate(path: string, title?: string) {
    setLastPath(path);
    setShowDialog(false);
    await createTerminal(path, title);
  }

  function handleClose(id: string) {
    if (maximizedId === id) setMaximizedId(null);
    destroyTerminal(id);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar
        columns={columns}
        onColumnsChange={setColumns}
        onNewTerminal={() => setShowDialog(true)}
        pendingCount={pendingCount}
        totalCount={terminals.length}
      />
      <TerminalGrid
        terminals={terminals}
        columns={columns}
        onMaximize={setMaximizedId}
        onClose={handleClose}
        onRename={renameTerminal}
        onNew={() => setShowDialog(true)}
      />
      {maximizedTerm && (
        <MaximizeOverlay
          terminal={maximizedTerm}
          onMinimize={() => setMaximizedId(null)}
          onClose={handleClose}
        />
      )}
      {showDialog && (
        <NewTerminalDialog
          lastPath={lastPath}
          onCreate={handleCreate}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Rewrite `src/renderer/main.tsx`**

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import './components/global.css';
import { App } from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode><App /></React.StrictMode>
);
```

- [ ] **Step 8: Run the app and verify the full flow**

```
npm run dev
```

Verify the following golden path manually:
1. App opens with an empty grid and the `+ New` button
2. Click `+ New` → dialog opens
3. Enter a valid path (e.g., `C:\Users\<you>`) → click Create → terminal cell appears, shell starts
4. Terminal cell shows live output (shell prompt)
5. Click the cell → MaximizeOverlay opens full screen, cursor is active, you can type
6. Type `dir` and press Enter → output appears in the overlay xterm
7. Click Minimize → overlay closes, grid cell still shows the terminal
8. Open a second terminal → both cells visible in grid
9. Change layout to 4 columns → grid updates
10. Click `✕` on a cell → terminal closes and is removed from grid

- [ ] **Step 9: Commit**

```
git add src/renderer/
git commit -m "feat: TopBar, TerminalGrid, App root, and global styles — full UI complete"
```
