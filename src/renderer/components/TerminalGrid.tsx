import React from 'react';
import type { TerminalState } from '../../types';
import { TerminalCell } from './TerminalCell';
import { GhostCell } from './GhostCell';
import styles from './TerminalGrid.module.css';

interface Props {
  gridRef: React.Ref<HTMLDivElement>;
  terminals: (TerminalState | null)[];  // pre-sliced and padded with null for ghosts
  columns: number;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  draggedId: string | null;
  onDragStart: (id: string) => void;
  onDrop: (toId: string) => void;
  onMaximize: (id: string) => void;
  onClose: (id: string) => void;
  onRename: (id: string, title: string) => void;
}

export function TerminalGrid({
  gridRef, terminals, columns, page, totalPages, onPageChange,
  draggedId, onDragStart, onDrop, onMaximize, onClose, onRename,
}: Props) {
  const realCount = terminals.filter(Boolean).length;
  // 3-terminal special layout: first cell spans both rows
  const isThreeLayout = realCount === 3 && columns === 2;
  const items = isThreeLayout
    ? (terminals.filter(Boolean) as TerminalState[])
    : terminals;
  const rows = Math.ceil(terminals.length / columns);

  return (
    <div className={styles.wrapper}>
      <div
        ref={gridRef}
        className={styles.grid}
        style={{
          gridTemplateColumns: `repeat(${columns}, 1fr)`,
          gridTemplateRows: `repeat(${rows}, 1fr)`,
        }}
      >
        {items.map((t, i) =>
          t === null
            ? <GhostCell key={`ghost-${i}`} />
            : <TerminalCell
                key={t.id}
                terminal={t}
                style={isThreeLayout && i === 0 ? { gridRow: 'span 2', gridColumn: '1' } : undefined}
                onMaximize={onMaximize}
                onClose={onClose}
                onRename={onRename}
                onDragStart={onDragStart}
                onDrop={onDrop}
              />
        )}
      </div>
      {totalPages > 1 && (
        <div className={styles.dots}>
          {Array.from({ length: totalPages }, (_, i) => (
            <button
              key={i}
              className={`${styles.dot} ${i === page ? styles.dotActive : ''}`}
              onClick={() => onPageChange(i)}
              aria-label={`Page ${i + 1}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
