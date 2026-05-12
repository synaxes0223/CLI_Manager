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
