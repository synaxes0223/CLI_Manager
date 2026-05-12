import React, { useEffect, useRef, useState } from 'react';
import { Terminal } from '@xterm/xterm';
import '@xterm/xterm/css/xterm.css';
import { ptyBus } from '../lib/pty-bus';
import { xtermStore } from '../lib/xterm-store';
import type { TerminalState } from '../../types';
import styles from './TerminalCell.module.css';

const PREVIEW_COLS = 120;
const PREVIEW_ROWS = 24;

interface Props {
  terminal: TerminalState;
  style?: React.CSSProperties;
  onMaximize: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
  onDragStart: (id: string) => void;
  onDrop: (toId: string) => void;
}

export function TerminalCell({ terminal, style, onMaximize, onClose, onRename, onDragStart, onDrop }: Props) {
  const { id, path, title, status, exitCode } = terminal;
  const containerRef = useRef<HTMLDivElement>(null);
  const [editing, setEditing]     = useState(false);
  const [draft, setDraft]         = useState(title ?? '');
  const [isDragOver, setIsDragOver] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const term = new Terminal({
      theme: { background: '#0d1117', foreground: '#c9d1d9', cursor: '#c9d1d9' },
      fontSize: 11,
      fontFamily: 'Consolas, "Courier New", monospace',
      scrollback: 1000,
      disableStdin: true,
      copyOnSelect: true,
      cols: PREVIEW_COLS,
      rows: PREVIEW_ROWS,
    });

    term.open(container);
    xtermStore.set(id, { term });
    window.api.resizePty({ id, cols: PREVIEW_COLS, rows: PREVIEW_ROWS });

    const el = term.element;
    if (el) {
      el.style.position = 'absolute';
      el.style.bottom = '0';
      el.style.left = '0';
      el.style.transformOrigin = 'bottom left';
    }

    function updateScale() {
      if (!container || !el || !el.offsetWidth) return;
      const scale = container.clientWidth / el.offsetWidth;
      el.style.transform = `scale(${scale})`;
    }

    requestAnimationFrame(updateScale);

    const unsub = ptyBus.subscribe(id, data => term.write(data));
    const observer = new ResizeObserver(updateScale);
    observer.observe(container);

    return () => {
      unsub();
      observer.disconnect();
      xtermStore.remove(id);
    };
  }, [id]);

  useEffect(() => {
    if (!editing) setDraft(title ?? '');
  }, [title, editing]);

  function commitRename() {
    setEditing(false);
    onRename(id, draft);
  }

  const statusLabel =
    status === 'pending' ? '● PENDING' :
    status === 'running' ? '● running' : '○ idle';

  return (
    <div
      className={[
        styles.cell,
        status === 'pending' ? styles.pending : '',
        isDragOver ? styles.dragOver : '',
      ].join(' ')}
      style={style}
      onClick={() => !editing && onMaximize(id)}
      onDragOver={e => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={e => { e.preventDefault(); setIsDragOver(false); onDrop(id); }}
    >
      <div className={styles.header}>
        <span
          className={styles.grip}
          draggable
          onDragStart={e => { e.stopPropagation(); onDragStart(id); }}
          onClick={e => e.stopPropagation()}
        >⠿</span>
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
