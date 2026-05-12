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
