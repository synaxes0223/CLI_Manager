import React, { useState, useCallback, useEffect } from 'react';
import { useTerminals } from './hooks/useTerminals';
import { usePageSize } from './hooks/usePageSize';
import { TopBar } from './components/TopBar';
import { TerminalGrid } from './components/TerminalGrid';
import { MaximizeOverlay } from './components/MaximizeOverlay';
import { NewTerminalDialog } from './components/NewTerminalDialog';
import type { TerminalState } from '../types';

function autoColumns(count: number): number {
  return Math.min(4, Math.ceil(Math.sqrt(Math.max(1, count))));
}

export function App() {
  const { terminals, createTerminal, destroyTerminal, renameTerminal, reorderTerminals } = useTerminals();
  const [columns, setColumns]         = useState<number | 'auto'>('auto');
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showDialog, setShowDialog]   = useState(false);
  const [lastPath, setLastPath]       = useState('C:\\');
  const [page, setPage]               = useState(0);
  const [draggedId, setDraggedId]     = useState<string | null>(null);
  const [gridEl, setGridEl]           = useState<HTMLDivElement | null>(null);

  // Callback ref — triggers usePageSize to re-run when the grid element mounts
  const gridRef = useCallback((el: HTMLDivElement | null) => setGridEl(el), []);

  const pendingCount     = terminals.filter(t => t.status === 'pending').length;
  const maximizedTerm    = terminals.find(t => t.id === maximizedId);
  const effectiveColumns = columns === 'auto' ? autoColumns(terminals.length) : columns;
  const pageSize         = usePageSize(effectiveColumns, gridEl);
  const totalPages       = Math.max(1, Math.ceil(terminals.length / pageSize));

  // Clamp page when terminals or pageSize change (e.g. terminal closed, window resized)
  useEffect(() => {
    setPage(p => Math.min(p, Math.max(0, totalPages - 1)));
  }, [totalPages]);

  // Arrow key page navigation when no terminal is maximized
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (maximizedId) return;
      if (e.key === 'ArrowLeft')  setPage(p => Math.max(0, p - 1));
      if (e.key === 'ArrowRight') setPage(p => Math.min(totalPages - 1, p + 1));
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [maximizedId, totalPages]);

  // Slice terminals for current page and pad with nulls for ghost slots
  const pageStart = page * pageSize;
  const pageSlice = terminals.slice(pageStart, pageStart + pageSize);
  const padded: (TerminalState | null)[] = [
    ...pageSlice,
    ...Array(pageSize - pageSlice.length).fill(null),
  ];

  async function handleCreate(path: string, title?: string) {
    setLastPath(path);
    setShowDialog(false);
    const newIndex = terminals.length; // index the new terminal will occupy
    try {
      await createTerminal(path, title);
      setPage(Math.floor(newIndex / pageSize));
    } catch (err) {
      alert(`Failed to create terminal: ${err instanceof Error ? err.message : String(err)}`);
      setShowDialog(true);
    }
  }

  function handleClose(id: string) {
    if (maximizedId === id) setMaximizedId(null);
    destroyTerminal(id);
  }

  function handleDrop(toId: string) {
    if (draggedId && draggedId !== toId) reorderTerminals(draggedId, toId);
    setDraggedId(null);
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <TopBar
        columns={columns}
        onColumnsChange={setColumns}
        onNewTerminal={() => setShowDialog(true)}
        pendingCount={pendingCount}
        totalCount={terminals.length}
      />
      <TerminalGrid
        gridRef={gridRef}
        terminals={padded}
        columns={effectiveColumns}
        page={page}
        totalPages={totalPages}
        onPageChange={setPage}
        draggedId={draggedId}
        onDragStart={setDraggedId}
        onDrop={handleDrop}
        onMaximize={setMaximizedId}
        onClose={handleClose}
        onRename={renameTerminal}
      />
      {maximizedTerm && (
        <MaximizeOverlay
          terminal={maximizedTerm}
          onMinimize={() => setMaximizedId(null)}
          onClose={handleClose}
        />
      )}
      {showDialog && (
        <NewTerminalDialog
          lastPath={lastPath}
          onCreate={handleCreate}
          onCancel={() => setShowDialog(false)}
        />
      )}
    </div>
  );
}
