# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the Web UI dashboard for [ai-workspace](../), a multi-repository workspace manager for Claude Code. It provides a browser interface on `localhost:3741` to view workspace status, TODO progress, reviews, git history, and trigger operations (init, execute, review, create-pr, etc.) that run Claude Code via the `@anthropic-ai/claude-agent-sdk`.

## Commands

```bash
# Install dependencies (uses bun)
bun install

# Development with hot reload
bun run dev:hot

# Production build + start (what bin/start.mjs does)
bun run build && bun run start

# Type checking
bunx tsc --noEmit
```

The app runs on port 3741. Set `AI_WORKSPACE_ROOT` env var to point to the ai-workspace root directory; defaults to `..` relative to this directory.

## Architecture

**Next.js 15 App Router** with React 19, TypeScript strict mode, Tailwind CSS 3, and SWR for data fetching. Uses `output: "standalone"` in next.config.ts. No testing framework is configured.

### Server-side: Reading workspace state from disk

API routes under `src/app/api/` read workspace data directly from the filesystem (`workspace/` directory in ai-workspace root):

- **`src/lib/workspace.ts`** — Core functions that scan `WORKSPACE_DIR` to list workspaces, read README.md, TODO files, review artifacts, and git history. All filesystem access happens here.
- **`src/lib/config.ts`** — Resolves `AI_WORKSPACE_ROOT` and `WORKSPACE_DIR` paths.
- **Parsers** (`src/lib/todo-parser.ts`, `readme-parser.ts`, `review-parser.ts`) — Extract structured data from markdown files using regex. TODO items use checkbox syntax: `[x]` completed, `[ ]` pending, `[!]` blocked, `[~]` in-progress.

### Server-side: Running Claude Code operations

Operations (init, execute, review, create-pr, etc.) spawn Claude Code processes via the SDK:

- **`src/lib/claude-sdk.ts`** — Wraps `@anthropic-ai/claude-agent-sdk`'s `query()` function. Resolves the `claude` CLI path, auto-approves all tools via `canUseTool`, and handles `AskUserQuestion` interactively by blocking until the browser user answers.
- **`src/lib/process-manager.ts`** — Manages running operations. Stores state on `globalThis` to survive HMR. Provides `startOperation`, `subscribeToOperation`, `killOperation`, `submitAnswer`.
- **`src/app/api/events/route.ts`** — SSE endpoint. Clients connect with `?operationId=` to stream `OperationEvent`s in real time.

### Client-side

- **`src/hooks/use-workspaces.ts`** / **`use-workspace.ts`** — SWR hooks with auto-refresh (10s list, 5s detail) for workspace data.
- **`src/hooks/use-sse.ts`** — EventSource hook for streaming operation output from `/api/events`.
- **`src/lib/stream-parser.ts`** — Converts raw SDK messages into typed `LogEntry` objects for rendering (text, thinking, tool calls, tool results, ask prompts, system events, etc.).
- **Components** — `workspace-list.tsx` (dashboard), `workspace-card.tsx` (summary card), `operation-panel.tsx` / `operation-log.tsx` / `claude-operation.tsx` (operation UI with log streaming), `init-dialog.tsx` (new workspace form).

### Pages

- `/` — Dashboard listing all workspaces
- `/workspace/[name]` — Workspace detail with tabs: Overview, TODOs, Reviews, History, Operations
- `/utilities` — Utility operations (permissions-suggest, workspace-prune)

### API Routes

- `GET /api/workspaces` — List all workspaces
- `GET /api/workspaces/[name]` — Workspace detail
- `GET /api/workspaces/[name]/readme` — Raw README
- `GET /api/workspaces/[name]/todos` — Parsed TODO files
- `GET /api/workspaces/[name]/reviews` — Review sessions
- `GET /api/workspaces/[name]/reviews/[timestamp]` — Review detail
- `GET /api/workspaces/[name]/history` — Git log
- `POST /api/operations/{init,execute,review,create-pr,update-todo,delete}` — Start operations
- `POST /api/operations/answer` — Submit AskUserQuestion answers
- `POST /api/operations/kill` — Kill a running operation
- `GET /api/operations` — List operations
- `GET /api/events?operationId=` — SSE stream for operation output

## Styling

Uses Tailwind with a shadcn/ui-style CSS variable theme system (`hsl(var(--primary))`, etc.) defined in `globals.css`. The `cn()` utility from `src/lib/utils.ts` merges Tailwind classes via `clsx` + `tailwind-merge`. Dark mode is configured via the `class` strategy but not currently toggled.

## Key Dependencies

- `@anthropic-ai/claude-agent-sdk` — Runs Claude Code headlessly; marked as `serverExternalPackages` in next.config.ts
- `swr` — Client-side data fetching with automatic revalidation
- `react-markdown` + `remark-gfm` — Markdown rendering
- `lucide-react` — Icons
