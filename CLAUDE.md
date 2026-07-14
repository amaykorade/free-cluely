# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development (starts Vite on port 5180, then launches Electron)
npm start

# Production build (outputs to release/)
npm run dist

# Build renderer only (Vite)
npm run build

# Build + watch electron TypeScript only
npm run watch

# Compile electron TypeScript once
npx tsc -p electron/tsconfig.json
```

If you encounter Sharp/Python build errors:
```bash
SHARP_IGNORE_GLOBAL_LIBVIPS=1 npm install --ignore-scripts
npm rebuild sharp
```

## Environment Setup

Create a `.env` file in the project root. You need one of:

```env
# Option A: Google Gemini
GEMINI_API_KEY=your_key_here

# Option B: Local Ollama
USE_OLLAMA=true
OLLAMA_MODEL=llama3.2
OLLAMA_URL=http://localhost:11434
```

## Architecture

This is an **Electron + Vite + React + TypeScript** desktop app with a strict two-process boundary:

### Main Process (`electron/`)

- **`main.ts`** — `AppState` singleton that owns and coordinates all helpers. Entry point for Electron.
- **`LLMHelper.ts`** — Abstraction over Gemini (`@google/generative-ai`) and Ollama (REST). Supports runtime switching between providers via `switchToGemini()` / `switchToOllama()`.
- **`ProcessingHelper.ts`** — Orchestrates the analysis pipeline. Reads `.env` at startup to decide which LLM provider to use. Handles both the initial "queue" flow (screenshot → extract → analyze) and the "debug" flow (extra screenshots → debug solution).
- **`ScreenshotHelper.ts`** — Captures screenshots using `screenshot-desktop`, maintains two queues: primary (queue view) and extra (debug view).
- **`WindowHelper.ts`** — Creates and manages the transparent, always-on-top Electron window.
- **`shortcuts.ts`** — Registers global hotkeys via `globalShortcut`.
- **`ipcHandlers.ts`** — All `ipcMain.handle()` registrations. This is the authoritative list of IPC channels.
- **`preload.ts`** — Context bridge. Exposes `window.electronAPI` to the renderer. All renderer→main calls go through here.

### Renderer Process (`src/`)

- **`App.tsx`** — Root component. Manages top-level `view` state: `"queue"` | `"solutions"`. Listens to main-process events to drive view transitions.
- **`_pages/Queue.tsx`** — Screenshot queue view (initial state).
- **`_pages/Solutions.tsx`** — Displays AI analysis results.
- **`components/ui/ModelSelector.tsx`** — UI for switching LLM provider at runtime.

### IPC Communication Pattern

- **Renderer → Main**: `window.electronAPI.<method>()` (defined in `preload.ts`, handled in `ipcHandlers.ts`)
- **Main → Renderer**: `mainWindow.webContents.send(PROCESSING_EVENTS.<EVENT>)` (renderer subscribes via `window.electronAPI.on*` callbacks)
- Processing state is communicated as a sequence of events: `INITIAL_START` → `PROBLEM_EXTRACTED` → `SOLUTION_SUCCESS` (or `INITIAL_SOLUTION_ERROR`), and similarly `DEBUG_START` → `DEBUG_SUCCESS` / `DEBUG_ERROR`.

### Data Flow

1. User presses `Cmd/Ctrl+H` → screenshot saved to temp file, path added to `ScreenshotHelper` queue, preview sent to renderer
2. User presses `Cmd/Ctrl+Enter` → `ProcessingHelper.processScreenshots()` called
3. Main process sends events to renderer as processing progresses
4. Renderer updates view based on received events; `react-query` caches problem/solution data

### Key Global Shortcuts

| Shortcut | Action |
|---|---|
| `Cmd/Ctrl+B` | Toggle window visibility |
| `Cmd/Ctrl+H` | Take screenshot |
| `Cmd/Ctrl+Enter` | Process screenshots (generate solution) |
| `Cmd/Ctrl+R` | Reset — clear queues, cancel requests, return to queue view |
| `Cmd/Ctrl+Shift+Space` | Center and show window |
| `Cmd/Ctrl+Arrow` | Move window |
