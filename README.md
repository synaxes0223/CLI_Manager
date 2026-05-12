# CLI Manager

A local desktop app for managing multiple terminal sessions in one window. Built for personal use alongside [Claude Code](https://claude.ai/code) — shows a live grid of all open terminals, highlights those waiting for your input, and lets you click any terminal to interact with it full-screen.

## Features

- **Grid view** — all open terminals visible at once, live xterm.js previews
- **Pending detection** — red pulsing border when a terminal is waiting for input (Claude Code prompts, `y/N` confirmations, password prompts, SSH passphrases)
- **Click to maximize** — click any cell to open it full-screen with keyboard input enabled
- **Auto layout** — column count adapts automatically to terminal count, or set it manually (1–4 columns)
- **Custom titles** — double-click any terminal's title or path to rename it inline
- **Folder picker** — browse for a working directory when creating a new terminal
- **Dark theme** — GitHub-style dark UI throughout

## Requirements

- Windows (node-pty ships Windows prebuilds; Linux/macOS also works with `bash`)
- [Node.js](https://nodejs.org/) 18 or later
- [Git](https://git-scm.com/)

## Getting Started

```bash
git clone https://github.com/YOUR_USERNAME/cli-manager.git
cd cli-manager
npm install
npm run dev
```

`npm run dev` starts the Electron app in development mode with hot reload.

## Building a Windows Installer (.exe)

```bash
npm run package
```

This compiles the app and produces an NSIS installer at `release/CLI Manager Setup x.y.z.exe`. Run the installer to install the app and create a desktop shortcut — no terminal required to launch after that.

> **Note:** The first build downloads Electron binaries (~80 MB) and may take a few minutes.

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start in development mode (hot reload) |
| `npm run build` | Compile source to `out/` |
| `npm run package` | Build installer → `release/` |
| `npm test` | Run main-process unit tests |

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop shell | Electron 28 |
| UI | React 18 + TypeScript |
| Terminal emulation | xterm.js 5 |
| PTY management | node-pty |
| Build | electron-vite + electron-builder |

## Pending Detection

The app watches each terminal's output for two signals:

1. **Pattern matching** — regex patterns for Claude Code prompts, `[y/N]` confirmations, `Password:`, `Enter passphrase:`, and Inquirer.js prompts
2. **Idle timeout** — if a running terminal produces no output for 10 seconds, it's marked pending

Status clears automatically as soon as new output arrives.

## License

MIT
