import React from 'react';
import styles from './TopBar.module.css';

interface Props {
  columns: number | 'auto';
  onColumnsChange: (n: number | 'auto') => void;
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
          onChange={e => onColumnsChange(e.target.value === 'auto' ? 'auto' : Number(e.target.value))}
        >
          <option value="auto">Auto</option>
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
