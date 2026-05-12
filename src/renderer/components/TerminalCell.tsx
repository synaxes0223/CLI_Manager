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
