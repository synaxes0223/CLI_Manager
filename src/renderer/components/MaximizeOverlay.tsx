import React, { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';
import { xtermStore } from '../lib/xterm-store';
import { ptyBus } from '../lib/pty-bus';
import type { TerminalState } from '../../types';
import styles from './MaximizeOverlay.module.css';

interface Props {
  terminal: TerminalState;
  onMinimize: () => void;
  onClose: (id: string) => void;
}

export function MaximizeOverlay({ terminal, onMinimize, onClose }: Props) {
  const { id, path, title, status } = terminal;
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Fresh terminal at the overlay's actual size — avoids reflow of old narrow-width content
    const term = new Terminal({
      theme: { background: '#0d1117', foreground: '#c9d1d9', cursor: '#c9d1d9' },
      fontSize: 11,
      fontFamily: 'Consolas, "Courier New", monospace',
      scrollback: 5000,
      disableStdin: false,
      copyOnSelect: true,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    term.open(container);
    fit.fit();

    // Replay buffered output at the correct column width before subscribing to live data
    const buffer = ptyBus.getBuffer(id);
    if (buffer) term.write(buffer);

    window.api.resizePty({ id, cols: term.cols, rows: term.rows });

    const unsub = ptyBus.subscribe(id, data => term.write(data));
    const inputDisposable = term.onData(data => window.api.sendInput({ id, data }));

    // Bridge copy/paste to Electron's native clipboard (navigator.clipboard is blocked by default)
    term.attachCustomKeyEventHandler(e => {
      if (e.type !== 'keydown') return true;
      if (e.ctrlKey && e.shiftKey && e.key === 'C') {
        const sel = term.getSelection();
        if (sel) window.api.writeClipboard(sel);
        return false;
      }
      if (e.ctrlKey && e.shiftKey && e.key === 'V') {
        window.api.readClipboard().then(text => {
          if (text) window.api.sendInput({ id, data: text });
        });
        return false;
      }
      return true;
    });

    term.focus();

    const observer = new ResizeObserver(() => {
      fit.fit();
      window.api.resizePty({ id, cols: term.cols, rows: term.rows });
    });
    observer.observe(container);

    return () => {
      unsub();
      observer.disconnect();
      inputDisposable.dispose();
      term.dispose();
      // Restore PTY to the fixed preview size used by the grid cell
      const cellEntry = xtermStore.get(id);
      if (cellEntry) {
        window.api.resizePty({ id, cols: cellEntry.term.cols, rows: cellEntry.term.rows });
      }
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
