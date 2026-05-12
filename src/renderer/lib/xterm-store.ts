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
