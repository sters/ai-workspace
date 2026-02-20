# Investigation: sugyan/claude-code-webui

**Repository:** https://github.com/sugyan/claude-code-webui
**Date:** 2026-02-20

## Summary

claude-code-webui does NOT spawn the Claude CLI directly. It uses the **`@anthropic-ai/claude-code` SDK's `query()` function**, which provides structured SDK messages as an async generator. No PTY, no TUI, no xterm.js — just structured JSON messages streamed via NDJSON over HTTP.

## Architecture

```
Browser (React)
    │
    │ HTTP POST /api/chat (NDJSON streaming)
    │
Hono Server (Node.js)
    │
    │ SDK query() async generator
    │
@anthropic-ai/claude-code SDK
    │
    │ (internally spawns claude CLI as node process)
    │
Claude API
```

## 1. How It Invokes Claude

### No Direct CLI Spawning

The backend does NOT `spawn("claude", ...)`. Instead it:

1. **Detects the CLI path** (`backend/cli/validation.ts`):
   - Runs `which claude` to find the executable
   - Uses a PATH-wrapping trick to extract the actual Node.js script path
   - Result: e.g. `/path/to/node_modules/@anthropic-ai/claude-code/dist/cli/node.js`

2. **Calls the SDK** (`backend/handlers/chat.ts`):
   ```typescript
   import { query } from "@anthropic-ai/claude-code";

   for await (const sdkMessage of query({
     prompt: processedMessage,
     options: {
       abortController,
       executable: "node",
       executableArgs: [],
       pathToClaudeCodeExecutable: cliPath,
       resume: sessionId,        // conversation continuity
       allowedTools,              // tool permissions
       cwd: workingDirectory,
       permissionMode,            // "default" | "plan" | "acceptEdits" | "bypassPermissions"
     },
   })) {
     yield { type: "claude_json", data: sdkMessage };
   }
   ```

### SDK Message Types

The `query()` function yields structured `SDKMessage` objects:

- `{ type: "system", subtype: "init" }` — Session info, tool list
- `{ type: "assistant", message: { content: [...] } }` — Response chunks with:
  - `{ type: "text", text: "..." }`
  - `{ type: "tool_use", id, name, input }`
  - `{ type: "thinking", thinking: "..." }`
- `{ type: "result" }` — End of conversation (cost, tokens, duration)
- `{ type: "user" }` — User messages with tool results

## 2. Communication Protocol: NDJSON over HTTP

No WebSocket, no SSE. Uses **NDJSON** (Newline-Delimited JSON) streamed over a regular HTTP POST response.

### Request

```
POST /api/chat
Content-Type: application/json

{
  "message": "/workspace-prune 7",
  "requestId": "uuid",
  "sessionId": "optional-session-id",
  "allowedTools": ["Bash: *"],
  "workingDirectory": "/path/to/project",
  "permissionMode": "default"
}
```

### Response

```
Content-Type: application/x-ndjson
Cache-Control: no-cache
Connection: keep-alive

{"type":"claude_json","data":{"type":"system","subtype":"init",...}}
{"type":"claude_json","data":{"type":"assistant","message":{"content":[{"type":"text","text":"..."}]}}}
{"type":"claude_json","data":{"type":"assistant","message":{"content":[{"type":"tool_use","name":"Bash","input":{"command":"..."}}]}}}
{"type":"done"}
```

### Abort

```
POST /api/abort/:requestId
```

Triggers `AbortController.abort()` on the SDK query.

## 3. Frontend: Custom React Components (No xterm.js)

The frontend is a standard React app with custom message components. No terminal emulation.

### Component Hierarchy

```
ChatPage
├── ChatMessages
│   ├── ChatMessageComponent     — text messages (user/assistant)
│   ├── SystemMessageComponent   — init, result, errors (collapsible)
│   ├── ToolMessageComponent     — tool_use display (name, args)
│   ├── ToolResultMessageComponent — tool output
│   ├── ThinkingMessageComponent — Claude's reasoning
│   ├── PlanMessageComponent     — plan approval dialog
│   └── TodoMessageComponent     — TodoWrite results
├── ChatInput                    — message input + permission controls
└── HistoryView                  — conversation history browser
```

### Message Processing Pipeline

```
NDJSON line → JSON.parse() → StreamResponse
  → useStreamParser.processStreamLine()
  → UnifiedMessageProcessor.processMessage()
  → type-specific handlers (text, tool_use, thinking, etc.)
  → AllMessage[] state
  → React component rendering
```

### Internal Message Types

```typescript
type AllMessage =
  | ChatMessage         // user/assistant text
  | SystemMessage       // init, result, errors
  | ToolMessage         // tool invocation display
  | ToolResultMessage   // tool output
  | PlanMessage         // plan approval
  | ThinkingMessage     // Claude's reasoning
  | TodoMessage         // todo items
```

## 4. Interactive Features

### Permission Handling

1. SDK returns a tool_use with an error indicating permission needed
2. `UnifiedMessageProcessor` detects this via `is_error` flag
3. Frontend shows `PermissionInputPanel` with allow/deny buttons
4. User clicks "Allow" → adds to `allowedTools` list
5. Sends a hidden "continue" message with updated `allowedTools`

### Session Resumption

- `sessionId` is extracted from `system.init` SDK message
- Passed in subsequent requests via `resume: sessionId`
- Enables multi-turn conversations
- History stored at `~/.claude/projects/{encodedProjectName}/{sessionId}.jsonl`

### Abort/Cancel

- Frontend: Escape key → `POST /api/abort/:requestId`
- Backend: `AbortController.abort()` → SDK stops streaming

## 5. Key Dependencies

```json
{
  "dependencies": {
    "@anthropic-ai/claude-code": "^1.0.0",
    "hono": "^4.0.0"
  }
}
```

The `@anthropic-ai/claude-code` package provides the `query()` function which is the core of the integration.

## 6. Implications for Our WebUI

### Advantages of SDK Approach
- **No PTY/TUI issues** — structured messages, no ANSI escape codes
- **No xterm.js needed** — can build custom UI components
- **Proper session management** — built-in resume, abort
- **Permission handling** — native support via allowedTools
- **Simpler architecture** — HTTP streaming, no WebSocket

### What We'd Need to Change
- Replace `Bun.spawn` + PTY with `@anthropic-ai/claude-code` SDK `query()`
- Replace xterm.js with custom message components (or keep as fallback)
- Switch from SSE to NDJSON streaming
- Add session management (resume conversations)
- Add permission mode support

### SDK Installation
```bash
bun add @anthropic-ai/claude-code
```

Note: The SDK internally spawns the Claude CLI as a Node.js child process, but handles all the complexity of streaming, message parsing, and process management.
