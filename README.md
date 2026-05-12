# CLI Manager

A local desktop app for managing multiple terminal sessions in one window. Built for personal use alongside [Claude Code](https://claude.ai/code) — shows a live grid of all open terminals, highlights those waiting for your input, and lets you click any terminal to interact with it full-screen.

---

## Features

- **Live grid view** — all open terminals visible at once with real-time xterm.js previews
- **Pending detection** — red pulsing border signals when a terminal is waiting for input (Claude Code prompts, `y/N` confirmations, password prompts, SSH passphrases, Inquirer.js)
- **Click to maximize** — click any cell to open it full-screen with full keyboard input
- **Auto layout** — column count adapts automatically to the number of open terminals, or lock it to 1–4 columns manually
- **Custom titles** — double-click any terminal's title or path to rename it inline
- **Folder picker** — native folder dialog when creating a new terminal
- **Fresh start** — no session persistence; every launch starts clean
- **Dark theme** — GitHub-style dark UI throughout

---

## Requirements

- **Windows 10/11** (primary target — uses PowerShell as the default shell)
- **Node.js 18+** — [nodejs.org](https://nodejs.org/)
- **Git** — [git-scm.com](https://git-scm.com/)

> Linux and macOS also work — node-pty falls back to `bash` on non-Windows platforms.

---

## Getting Started

```bash
git clone https://github.com/synaxes0223/CLI_Manager.git
cd cli-manager
npm install
npm run dev
```

`npm run dev` starts the app in development mode with hot reload. Use this for development — **not** `npm start`, which loads a pre-built bundle.

---

## Building a Portable .exe

```bash
npm run package
```

Produces a single portable executable at `release/CLI Manager 0.1.0.exe`. Double-click it to run — no installation required. Copy it anywhere you like.

> **Windows symlink requirement:** electron-builder's toolkit contains macOS symlinks that Windows blocks for standard users. Fix this once with either option:
> - **Developer Mode** (recommended): Settings → Privacy & Security → For developers → turn on **Developer Mode**, then re-run `npm run package`
> - **Run as Administrator**: open your terminal as Administrator and run `npm run package`
>
> The first build also downloads Electron binaries (~80 MB) and may take a few minutes.

---

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode (hot reload) |
| `npm run build` | Compile source to `out/` |
| `npm run package` | Build portable .exe → `release/` |
| `npm test` | Run main-process unit tests |

---

## How It Works

The app uses Electron's two-process model:

- **Main process** — owns all PTY instances (via `node-pty`) and runs the pending-detection engine. Never touches the DOM.
- **Renderer process** — a React app that owns all `xterm.js` instances and renders the UI. Communicates with main via IPC.

When you maximize a terminal, the overlay physically moves the existing `xterm.js` DOM element into itself (rather than creating a new terminal instance), so the same output stream is visible in both grid preview and full-screen view without duplication.

---

## Project Structure

```
src/
├── types.ts                    — shared types and IPC channel constants
├── main/
│   ├── index.ts                — Electron app entry, BrowserWindow setup
│   ├── ipc-handler.ts          — ipcMain channel wiring
│   ├── pty-manager.ts          — node-pty lifecycle (create, resize, destroy)
│   ├── pending-detector.ts     — pattern matching + idle timeout detection
│   └── __tests__/              — Vitest unit tests (main process only)
├── preload/
│   └── index.ts                — contextBridge API exposed to renderer
└── renderer/
    ├── App.tsx                 — root component (state, layout, overlays)
    ├── hooks/
    │   └── useTerminals.ts     — terminal list state + IPC listeners
    ├── lib/
    │   ├── pty-bus.ts          — singleton IPC data router (one listener, many subscribers)
    │   └── xterm-store.ts      — module-level map of Terminal + FitAddon instances
    └── components/
        ├── TopBar.tsx          — header: New button, column selector, pending badge
        ├── TerminalGrid.tsx    — CSS grid container
        ├── TerminalCell.tsx    — individual cell with live preview and inline rename
        ├── MaximizeOverlay.tsx — full-screen overlay with interactive input
        └── NewTerminalDialog.tsx — modal: path picker + optional title
```

---

## Pending Detection

Each PTY is watched by a detector that fires `pending` on two independent triggers:

| Trigger | Detail |
|---|---|
| Pattern match | Scans output chunks against 6 built-in regex patterns |
| Idle timeout | Fires if a running PTY produces no output for 10 seconds |

**Built-in patterns:**

| Pattern | Matches |
|---|---|
| `/claude\s*>\s*$/m` | Claude Code prompt |
| `/^\?\s+.+/m` | Inquirer.js interactive prompts |
| `/\[y\/[Nn]\]\s*$/im` | yes/No confirmation |
| `/\[Y\/n\]\s*$/m` | Yes/no confirmation |
| `/Password:\s*$/im` | Password prompt |
| `/Enter passphrase:\s*$/im` | SSH passphrase |

Status resets to `running` as soon as new output arrives.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| UI framework | React 18 + TypeScript |
| Terminal emulation | xterm.js 5 (`@xterm/xterm`) |
| PTY management | node-pty |
| Build tooling | electron-vite + electron-builder |
| Tests | Vitest |

---

## License

MIT — see [LICENSE](LICENSE)
