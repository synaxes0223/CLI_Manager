import { useState, useEffect, useCallback } from 'react';
import type { TerminalState } from '../../types';

export function useTerminals() {
  const [terminals, setTerminals] = useState<TerminalState[]>([]);

  useEffect(() => {
    const offStatus = window.api.onStatus(({ id, status }) =>
      setTerminals(prev => prev.map(t => t.id === id ? { ...t, status } : t))
    );
    const offExit = window.api.onExit(({ id, code }) =>
      setTerminals(prev => prev.map(t => t.id === id ? { ...t, status: 'idle', exitCode: code } : t))
    );
    return () => { offStatus(); offExit(); };
  }, []);

  const createTerminal = useCallback(async (path: string, title?: string) => {
    const { id } = await window.api.createPty({ path, title });
    setTerminals(prev => [...prev, { id, path, title, status: 'running' }]);
    return id;
  }, []);

  const destroyTerminal = useCallback((id: string) => {
    window.api.destroyPty({ id });
    setTerminals(prev => prev.filter(t => t.id !== id));
  }, []);

  const renameTerminal = useCallback((id: string, title: string) => {
    setTerminals(prev =>
      prev.map(t => t.id === id ? { ...t, title: title.trim() || undefined } : t)
    );
  }, []);

  return { terminals, createTerminal, destroyTerminal, renameTerminal };
}
