# Grid Layout, Paging & Drag-to-Reorder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fixed-height terminal grid with a viewport-filling paginated layout, and add drag-to-reorder via a grip handle in the cell header.

**Architecture:** A `computePageSize` pure function (testable) powers a `usePageSize` hook that attaches a `ResizeObserver` to the grid container via a callback ref. `App.tsx` owns `page` and `draggedId` state and slices terminals into pages. `TerminalGrid` renders the current page (padded with `null` ghost slots), dot indicators, and passes drag props to `TerminalCell`. `TerminalCell` gains a draggable grip handle.

**Tech Stack:** React 18 hooks, HTML5 Drag and Drop API, ResizeObserver, CSS Grid `1fr` rows, Vitest

---

> **⚠️ Pairing note:** Tasks 4 and 5 change the `TerminalGrid` props interface simultaneously. After Task 4, TypeScript will report errors until Task 5 is complete. Run `npm run dev` only after both tasks are done.

---

### Task 1: Reorder utility + `reorderTerminals` hook method

**Files:**
- Create: `src/renderer/lib/reorder.ts`
- Create: `src/renderer/lib/__tests__/reorder.test.ts`
- Modify: `src/renderer/hooks/useTerminals.ts`

- [ ] **Step 1: Create the pure reorder utility**

`src/renderer/lib/reorder.ts`:
```ts
export function reorder<T>(list: T[], fromIndex: number, toIndex: number): T[] {
  if (fromIndex === toIndex) return list;
  const next = [...list];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}
```

- [ ] **Step 2: Write the failing test**

`src/renderer/lib/__tests__/reorder.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { reorder } from '../reorder';

describe('reorder', () => {
  it('moves an item forward', () => {
    expect(reorder([1, 2, 3, 4], 0, 2)).toEqual([2, 3, 1, 4]);
  });
  it('moves an item backward', () => {
    expect(reorder([1, 2, 3, 4], 3, 1)).toEqual([1, 4, 2, 3]);
  });
  it('returns the same reference when indices are equal', () => {
    const arr = [1, 2, 3];
    expect(reorder(arr, 1, 1)).toBe(arr);
  });
  it('handles a two-element swap', () => {
    expect(reorder(['a', 'b'], 0, 1)).toEqual(['b', 'a']);
  });
});
```

- [ ] **Step 3: Run the tests**

```
npx vitest run src/renderer/lib/__tests__/reorder.test.ts
```

Expected: all 4 pass.

- [ ] **Step 4: Add `reorderTerminals` to `useTerminals`**

`src/renderer/hooks/useTerminals.ts` — add the import and the new callback, and include it in the return value:

```ts
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
```

- [ ] **Step 5: Commit**

```
git add src/renderer/lib/reorder.ts src/renderer/lib/__tests__/reorder.test.ts src/renderer/hooks/useTerminals.ts
git commit -m "feat: reorder utility and reorderTerminals hook method"
```

---

### Task 2: `computePageSize` utility + `usePageSize` hook

**Files:**
- Create: `src/renderer/lib/compute-page-size.ts`
- Create: `src/renderer/lib/__tests__/compute-page-size.test.ts`
- Create: `src/renderer/hooks/usePageSize.ts`

- [ ] **Step 1: Create the pure page-size computation**

`src/renderer/lib/compute-page-size.ts`:
```ts
const GAP = 6; // matches the existing grid gap in px

export function computePageSize(availableW: number, availableH: number, cols: number): number {
  const cellH = (availableW / cols) / 2; // target 2:1 aspect ratio per cell
  const maxRows = Math.max(1, Math.floor((availableH + GAP) / (cellH + GAP)));
  return cols * maxRows;
}
```

- [ ] **Step 2: Write the failing tests**

`src/renderer/lib/__tests__/compute-page-size.test.ts`:
```ts
import { describe, it, expect } from 'vitest';
import { computePageSize } from '../compute-page-size';

describe('computePageSize', () => {
  it('returns 4 for a typical 1400×760 viewport with 2 cols', () => {
    // cellH = (1400/2)/2 = 350
    // maxRows = floor((760+6)/(350+6)) = floor(766/356) = 2
    // pageSize = 2*2 = 4
    expect(computePageSize(1400, 760, 2)).toBe(4);
  });

  it('enforces a minimum of 1 row (returns cols) for a tiny height', () => {
    expect(computePageSize(100, 5, 3)).toBe(3);
  });

  it('increases rows for a taller viewport', () => {
    // cellH = 350; maxRows = floor((1500+6)/(350+6)) = floor(1506/356) = 4
    expect(computePageSize(1400, 1500, 2)).toBe(8);
  });

  it('handles 3 columns', () => {
    // cellH = (1400/3)/2 ≈ 233.3
    // maxRows = floor((760+6)/(233.3+6)) = floor(766/239.3) = 3
    expect(computePageSize(1400, 760, 3)).toBe(9);
  });
});
```

- [ ] **Step 3: Run the tests**

```
npx vitest run src/renderer/lib/__tests__/compute-page-size.test.ts
```

Expected: all 4 pass.

- [ ] **Step 4: Create the `usePageSize` hook**

`src/renderer/hooks/usePageSize.ts`:
```ts
import { useState, useEffect } from 'react';
import { computePageSize } from '../lib/compute-page-size';

// Accepts a callback ref value (HTMLDivElement | null) so that the effect
// re-runs automatically when the grid container element mounts.
export function usePageSize(cols: number, gridEl: HTMLDivElement | null): number {
  const [pageSize, setPageSize] = useState(cols * 2);

  useEffect(() => {
    if (!gridEl) return;

    function compute() {
      setPageSize(computePageSize(gridEl!.clientWidth, gridEl!.clientHeight, cols));
    }

    compute();
    const observer = new ResizeObserver(compute);
    observer.observe(gridEl);
    return () => observer.disconnect();
  }, [cols, gridEl]);

  return pageSize;
}
```

- [ ] **Step 5: Commit**

```
git add src/renderer/lib/compute-page-size.ts src/renderer/lib/__tests__/compute-page-size.test.ts src/renderer/hooks/usePageSize.ts
git commit -m "feat: computePageSize utility and usePageSize hook"
```

---

### Task 3: `GhostCell` component

**Files:**
- Create: `src/renderer/components/GhostCell.tsx`
- Create: `src/renderer/components/GhostCell.module.css`

- [ ] **Step 1: Create the component**

`src/renderer/components/GhostCell.tsx`:
```tsx
import React from 'react';
import styles from './GhostCell.module.css';

export function GhostCell() {
  return <div className={styles.ghost} />;
}
```

`src/renderer/components/GhostCell.module.css`:
```css
.ghost {
  background: #0a0c10;
  border: 1px dashed #1c2128;
  border-radius: 6px;
}
```

- [ ] **Step 2: Commit**

```
git add src/renderer/components/GhostCell.tsx src/renderer/components/GhostCell.module.css
git commit -m "feat: GhostCell placeholder component for empty grid slots"
```

---

### Task 4: Update `App.tsx` for page state, paging logic, and drag state

> **⚠️ Paired with Task 5.** TypeScript will report errors on `TerminalGrid` props until Task 5 is complete.

**Files:**
- Modify: `src/renderer/App.tsx`

- [ ] **Step 1: Replace `App.tsx` in full**

`src/renderer/App.tsx`:
```tsx
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
```

---

### Task 5: Update `TerminalGrid` for fill-height layout, paging, and ghost slots

> **⚠️ Paired with Task 4.** Complete this immediately after Task 4.

**Files:**
- Modify: `src/renderer/components/TerminalGrid.tsx`
- Modify: `src/renderer/components/TerminalGrid.module.css`

- [ ] **Step 1: Replace `TerminalGrid.tsx` in full**

`src/renderer/components/TerminalGrid.tsx`:
```tsx
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
```

- [ ] **Step 2: Replace `TerminalGrid.module.css` in full**

`src/renderer/components/TerminalGrid.module.css`:
```css
.wrapper {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  padding: 8px;
}

.grid {
  display: grid;
  gap: 6px;
  flex: 1;
  overflow: hidden;
}

.dots {
  display: flex;
  gap: 6px;
  justify-content: center;
  padding: 8px 0 2px;
  flex-shrink: 0;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #30363d;
  border: none;
  cursor: pointer;
  padding: 0;
  transition: background 0.15s, width 0.15s;
}

.dot:hover { background: #8b949e; }

.dotActive {
  background: #58a6ff;
  width: 20px;
  border-radius: 4px;
}
```

- [ ] **Step 3: Run `npm run dev` and verify**

```
npm run dev
```

Expected:
- Grid fills the full viewport height (no fixed 160px rows).
- With 1 terminal: full screen.
- With 2 terminals: two equal columns, each full height.
- With 3 terminals: left column full height, right column split in two.
- With more terminals than fit: dot indicators appear at the bottom; clicking navigates pages; ghost slots fill the last page.

- [ ] **Step 4: Commit**

```
git add src/renderer/components/TerminalGrid.tsx src/renderer/components/TerminalGrid.module.css src/renderer/App.tsx
git commit -m "feat: viewport-filling grid with auto paging and dot navigation"
```

---

### Task 6: Add drag handle and drop target to `TerminalCell`

**Files:**
- Modify: `src/renderer/components/TerminalCell.tsx`
- Modify: `src/renderer/components/TerminalCell.module.css`

- [ ] **Step 1: Replace `TerminalCell.tsx` in full**

`src/renderer/components/TerminalCell.tsx`:
```tsx
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
```

- [ ] **Step 2: Add grip and drag-over styles to `TerminalCell.module.css`**

Append to `src/renderer/components/TerminalCell.module.css`:
```css
.grip {
  color: #484f58;
  cursor: grab;
  font-size: 12px;
  padding: 0 3px;
  user-select: none;
  flex-shrink: 0;
}

.grip:hover { color: #8b949e; }

.dragOver {
  border-color: #3fb950 !important;
  background: #0d2119;
}
```

- [ ] **Step 3: Run `npm run dev` and verify drag**

```
npm run dev
```

Expected:
- Each cell shows a faint `⠿` grip icon at the left of the header.
- Hovering the grip lightens it; cursor changes to `grab`.
- Dragging the grip over another cell highlights it with a green border.
- Dropping reorders the cells; the grid updates immediately.
- Clicking anywhere else on the cell still opens the maximize overlay.

- [ ] **Step 4: Run all tests to confirm nothing regressed**

```
npm test
```

Expected: all existing tests pass.

- [ ] **Step 5: Commit**

```
git add src/renderer/components/TerminalCell.tsx src/renderer/components/TerminalCell.module.css
git commit -m "feat: drag-to-reorder grip handle and drop target in terminal cells"
```
