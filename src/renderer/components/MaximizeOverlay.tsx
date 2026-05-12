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
