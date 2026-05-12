# CLI Manager — Design Spec
*Date: 2026-05-12*

## Overview

A local desktop application for managing multiple terminal sessions in one window. Built for personal use alongside Claude Code — provides a grid view of all open terminals, highlights those waiting for user input, and lets you click any terminal to interact with it full-screen.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Desktop shell | Electron 28 |
| UI framework | React 18 + TypeScript |
| Terminal emulation | xterm.js 5 + xterm-addon-fit |
| PTY management | node-pty |
| Styling | CSS Modules (dark theme only) |

---

## Architecture

### Two-process model

**Main process** owns all PTY instances and the pending-detection engine. It never touches the DOM.

**Renderer process** is a React app that owns all xterm.js instances and renders the UI. No business logic about PTY state lives here — it only reacts to IPC events from main.

### Data flow

```
node-pty (main) ──IPC:pty-data──► xterm.js (renderer) ──displayed in──► TerminalCell
      ▲                                                                       │
      └──────────────IPC:pty-input──────── user keystrokes (maximize mode) ──┘
```

### IPC surface (main ↔ renderer)

| Channel | Direction | Payload |
|---|---|---|
| `pty:create` | renderer → main | `{ path: string, title?: string }` |
| `pty:created` | main → renderer | `{ id: string }` — response after spawn |
| `pty:input` | renderer → main | `{ id, data: string }` |
| `pty:destroy` | renderer → main | `{ id }` |
| `pty:data` | main → renderer | `{ id, data: string }` |
| `pty:status` | main → renderer | `{ id, status: 'idle' \| 'running' \| 'pending' }` |
| `pty:exit` | main → renderer | `{ id, code: number }` |

---

## UI Layout

### Top bar (minimal, always visible)

- **App name** — "CLI Manager" left-aligned
- **+ New** button — opens the New Terminal dialog
- **Layout selector** — dropdown: 1, 2, 3, or 4 columns (rows are automatic)
- **Pending badge** — red pill showing count of pending terminals (hidden when 0)
- **Open count** — grey text showing total open terminals

### Terminal grid

CSS grid with column count from the layout selector. Rows grow automatically to fit all terminals. The grid scrolls vertically if terminals exceed the visible viewport. A `+` add cell always appears at the end of the grid.

**Cell fixed height:** all cells share the same fixed height regardless of whether a title is set. Each cell is a flexbox column — the xterm preview area uses `flex: 1` to fill remaining space after the header.

### Terminal cell

From top to bottom within the fixed-height cell:

1. **Status row** — status badge left, close button (`✕`) right
2. **Title** *(optional)* — bold, shown only if user has set a custom name; double-click to rename inline (text input, Enter to confirm, Escape to cancel)
3. **Path** — directory path, dimmed when a title is present, primary label when no title
4. **xterm preview** — live xterm.js instance scaled down via CSS `transform: scale()`, `pointer-events: none`, fills remaining cell height via `flex: 1`

**Status badges:**
- `● running` — green — process is active and producing output
- `● PENDING` — red, bold — process is waiting for user input
- `○ idle` — grey — process is alive but no recent output and no pending signal

**Pending visual:** red `2px` pulsing border (CSS keyframe animation) around the cell.

### Maximize overlay

Triggered by clicking any cell. Renders as a full-window overlay above the grid.

- **Header bar** — status badge, terminal title (or path if no title), Minimize button, Close button
- **Full xterm instance** — a dedicated full-size xterm.js instance connected to the same PTY data stream. Not the same DOM node as the grid cell — the overlay creates its own xterm, subscribes to `pty:data` for that ID, and routes keystrokes via `pty:input`. The grid cell's preview xterm continues buffering in the background.
- **Hint text** — small dimmed label: "Input active — type your response and press Enter"
- Clicking Minimize dismisses the overlay and returns to the grid; the PTY keeps running

### New Terminal dialog

A modal dialog:
- **Path field** — text input pre-filled with the last used path, with a folder-browse button
- **Title field** *(optional)* — custom name; leave blank to use path as label
- **Create** / **Cancel** buttons
- On Create: sends `pty:create` to main, adds a new cell to the grid

---

## Pending Detection

Runs in the main process, one detector per PTY. Two independent triggers both contribute to the `pending` state:

### 1. Pattern matching

Scans each PTY output chunk against a configurable list of regex patterns:

| Pattern | Matches |
|---|---|
| `/claude\s*>\s*$/m` | Claude Code prompt |
| `/\?\s.+$/m` | Inquirer.js / interactive prompts |
| `/\[y\/[Nn]\]\s*$/im` | Yes/No confirmations |
| `/\[Y\/n\]\s*$/m` | Yes/No (capital Y default) |
| `/Password:\s*$/im` | Credential prompts |
| `/Enter passphrase:\s*$/im` | SSH passphrase |

The pattern list is stored in a `patterns.json` config file the user can edit.

### 2. Idle timeout

If the PTY is still running but produces no output for **3 seconds**, status transitions to `pending`. This catches any interactive prompt not covered by the pattern list.

### Clearing

Status returns to `running` as soon as new output arrives from the PTY (indicating the user responded and the process moved forward).

---

## Layout & Overflow

- Column count is set by the user via the layout selector (1–4 columns)
- Rows are automatic — all terminals are always visible
- If terminals exceed the visible window height, the grid scrolls vertically
- No pagination, no hidden terminals
- The `+` add cell always appears after the last terminal

---

## Terminal Lifecycle

1. User clicks `+ New` → dialog opens
2. User picks path (and optional title) → `pty:create` sent to main
3. Main spawns `node-pty` process, assigns a UUID, sends `pty:created` with the ID back to renderer
4. Renderer creates xterm.js instance, attaches to that UUID, adds cell to grid
5. While running: main streams output via `pty:data`, fires `pty:status` on state changes
6. User clicks `✕` on cell → `pty:destroy` → main kills PTY → renderer removes cell
7. Process exits naturally → `pty:exit` → cell shows exit code, user can close

---

## Session Persistence

None. Terminals do not survive app restart. Every session starts fresh.

---

## Out of Scope (v1)

- System tray integration
- Notifications
- Terminal themes / font customization
- Splitting a single cell into sub-panes
- Saving/restoring sessions
- Remote terminals (SSH)
