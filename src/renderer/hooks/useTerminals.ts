import { useState, useEffect, useCallback } from 'react';
import type { TerminalState } from '../../types';
import { reorder } from '../lib/reorder';

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
    const result = await window.api.createPty({ path, title });
    if ('error' in result) throw new Error(result.error as string);
    setTerminals(prev => [...prev, { id: result.id, path, title, status: 'running' }]);
    return result.id;
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

  const reorderTerminals = useCallback((fromId: string, toId: string) => {
    setTerminals(prev => {
      const from = prev.findIndex(t => t.id === fromId);
      const to   = prev.findIndex(t => t.id === toId);
      if (from === -1 || to === -1 || from === to) return prev;
      return reorder(prev, from, to);
    });
  }, []);

  return { terminals, createTerminal, destroyTerminal, renameTerminal, reorderTerminals };
}
