# Grid Layout, Paging & Drag-to-Reorder

**Date:** 2026-05-12
**Status:** Approved

## Overview

Two features:
1. **Smart fill layout** — cells stretch to fill the full viewport, paginated when terminals exceed what fits.
2. **Drag-to-reorder** — grip handle in the cell header lets users reorder terminals within the grid.

---

## 1. Layout Algorithm

### Remove fixed row height

`TerminalGrid` currently sets `gridAutoRows: '160px'`. This is replaced by `gridTemplateRows: repeat(${rows}, 1fr)` so cells stretch to fill the available height.

### Column count

`autoColumns()` in `App.tsx` is unchanged — driven by terminal count, capped at 4.

### Page size (auto-calculated from window)

A `usePageSize(cols: number): number` hook computes how many terminals fit per page:

```
availableH = window.innerHeight - topbarHeight   // topbar ~42px
cellH      = (window.innerWidth / cols) / 2      // target 2:1 aspect ratio per cell
gap        = 6                                   // existing grid gap
maxRows    = Math.max(1, Math.floor((availableH + gap) / (cellH + gap)))
pageSize   = cols * maxRows
```

The hook re-runs on `window` resize via a `ResizeObserver` or `resize` event listener.

### 3-terminal special case

When exactly 3 terminals are visible on the current page and `cols === 2`, the first cell receives `style={{ gridRow: 'span 2' }}`. All other counts use a uniform grid with no spanning.

### Ghost slots

The terminals slice for the current page is always padded to `pageSize` with `null` sentinel values. `TerminalGrid` renders a `GhostCell` (inert `div`, no PTY, no xterm) for each `null`. This keeps the grid shape uniform on the last page.

---

## 2. Paging

### State

`page: number` (0-indexed) lives in `App.tsx`. `pageSize` comes from `usePageSize`.

### Derived values

```ts
const totalPages = Math.ceil(terminals.length / pageSize);
const pageSlice  = terminals.slice(page * pageSize, (page + 1) * pageSize);
// padded to pageSize with nulls for ghost slots
```

### Side effects

- **New terminal created** → jump to the page that contains the new terminal: `setPage(Math.floor(newIndex / pageSize))`.
- **Terminal closed** → clamp: `setPage(p => Math.min(p, Math.ceil((terminals.length - 1) / pageSize) - 1))`.
- **Page becomes invalid** (e.g. last terminal on last page removed) → clamp to 0.

### Navigation controls

Dot indicators render below the grid only when `totalPages > 1`:
- One dot per page, active dot is filled/wider (same style as the mockup).
- Each dot is clickable to jump directly to that page.
- `←` / `→` arrow key listeners on `document` navigate pages when `maximizedId === null`.

### Placement

Dots sit inside `TerminalGrid` as a footer row, outside the CSS grid, so they don't affect cell sizing.

---

## 3. Drag-to-Reorder

### Approach

HTML5 drag-and-drop — no external library.

### Grip handle

A `⠿` icon is added to the left of the status dot in `TerminalCell`'s header. It has:
- `draggable={true}`
- `onDragStart` → calls `onDragStart(id)` prop
- `onClick` + `e.stopPropagation()` to prevent triggering the cell's click-to-maximize

### Drag state

`draggedId: string | null` lives in `App.tsx` (lifted because drop targets are siblings, not children of the dragged cell).

### Drop target

Each `TerminalCell` receives:
- `onDragOver` → `e.preventDefault()` + set `isDragOver` local state → renders green border
- `onDragLeave` → clears `isDragOver`
- `onDrop` → calls `onDrop(id)` prop → triggers reorder

### Reorder logic

`reorderTerminals(fromId: string, toId: string)` added to `useTerminals`:

```ts
const reorderTerminals = useCallback((fromId: string, toId: string) => {
  setTerminals(prev => {
    const from = prev.findIndex(t => t.id === fromId);
    const to   = prev.findIndex(t => t.id === toId);
    if (from === -1 || to === -1 || from === to) return prev;
    const next = [...prev];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    return next;
  });
}, []);
```

Ghost cells do not participate in drag (no `onDrop` handler).

---

## Files Changed

| File | Change |
|------|--------|
| `src/renderer/App.tsx` | Add `page`, `draggedId` state; wire paging side-effects; pass drag props |
| `src/renderer/hooks/useTerminals.ts` | Add `reorderTerminals` |
| `src/renderer/hooks/usePageSize.ts` | **New** — `usePageSize(cols)` hook |
| `src/renderer/components/TerminalGrid.tsx` | Accept page/pageSize; slice + pad; render dots; remove fixed row height |
| `src/renderer/components/TerminalGrid.module.css` | Remove `gridAutoRows`; add dots footer styles |
| `src/renderer/components/TerminalCell.tsx` | Add grip handle; drag event handlers |
| `src/renderer/components/TerminalCell.module.css` | Grip handle styles; drag-over highlight |
| `src/renderer/components/GhostCell.tsx` | **New** — inert placeholder cell |

---

## Out of Scope

- Drag across pages (terminals stay on their current page during drag; cross-page reorder not supported)
- Persist terminal order across app restarts
- Touch/swipe gestures for paging
