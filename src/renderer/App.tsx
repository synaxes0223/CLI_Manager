import React, { useState } from 'react';
import { useTerminals } from './hooks/useTerminals';
import { TopBar } from './components/TopBar';
import { TerminalGrid } from './components/TerminalGrid';
import { MaximizeOverlay } from './components/MaximizeOverlay';
import { NewTerminalDialog } from './components/NewTerminalDialog';

function autoColumns(count: number): number {
  return Math.min(4, Math.ceil(Math.sqrt(Math.max(1, count))));
}

export function App() {
  const { terminals, createTerminal, destroyTerminal, renameTerminal } = useTerminals();
  const [columns, setColumns]         = useState<number | 'auto'>('auto');
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showDialog, setShowDialog]   = useState(false);
  const [lastPath, setLastPath]       = useState('C:\\');

  const pendingCount    = terminals.filter(t => t.status === 'pending').length;
  const maximizedTerm   = terminals.find(t => t.id === maximizedId);
  const effectiveColumns = columns === 'auto' ? autoColumns(terminals.length) : columns;

  async function handleCreate(path: string, title?: string) {
    setLastPath(path);
    setShowDialog(false);
    try {
      await createTerminal(path, title);
    } catch (err) {
      // Re-open dialog with error visible (simplest: just alert for now)
      alert(`Failed to create terminal: ${err instanceof Error ? err.message : String(err)}`);
      setShowDialog(true);
    }
  }

  function handleClose(id: string) {
    if (maximizedId === id) setMaximizedId(null);
    destroyTerminal(id);
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
        terminals={terminals}
        columns={effectiveColumns}
        onMaximize={setMaximizedId}
        onClose={handleClose}
        onRename={renameTerminal}
        onNew={() => setShowDialog(true)}
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
