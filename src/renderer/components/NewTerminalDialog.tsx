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
    const selected = await window.api.browseFolder();
    if (selected) setPath(selected);
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
