import React, { useState } from 'react';
import { useTerminals } from './hooks/useTerminals';
import { TopBar } from './components/TopBar';
import { TerminalGrid } from './components/TerminalGrid';
import { MaximizeOverlay } from './components/MaximizeOverlay';
import { NewTerminalDialog } from './components/NewTerminalDialog';

export function App() {
  const { terminals, createTerminal, destroyTerminal, renameTerminal } = useTerminals();
  const [columns, setColumns]         = useState(2);
  const [maximizedId, setMaximizedId] = useState<string | null>(null);
  const [showDialog, setShowDialog]   = useState(false);
  const [lastPath, setLastPath]       = useState('C:\\');

  const pendingCount  = terminals.filter(t => t.status === 'pending').length;
  const maximizedTerm = terminals.find(t => t.id === maximizedId);

  async function handleCreate(path: string, title?: string) {
    setLastPath(path);
    setShowDialog(false);
    await createTerminal(path, title);
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
        columns={columns}
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
