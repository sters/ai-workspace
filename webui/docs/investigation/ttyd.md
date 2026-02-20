# Investigation: tsl0922/ttyd

**Repository:** https://github.com/tsl0922/ttyd
**Date:** 2026-02-20

## Summary

ttyd is a C-based tool for sharing terminals over the web. It uses **WebSocket** for bidirectional communication, **libuv** for event-driven I/O, **forkpty()** for PTY creation, and **xterm.js** for frontend terminal rendering. Raw PTY bytes are forwarded to the browser without parsing.

## Architecture

```
Browser (xterm.js)
    │
    │ Binary WebSocket (ws://)
    │
ttyd Server (C, libwebsockets + libuv)
    │
    │ forkpty() + libuv pipes
    │
Spawned Process (bash, etc.)
```

## 1. PTY Spawning

### Unix: `forkpty()` (`src/pty.c`)

```c
pty_process *process = process_init(ctx, loop, argv, env);
process->columns = columns;
process->rows = rows;
pty_spawn(process, process_read_cb, process_exit_cb);
```

- Uses standard POSIX `forkpty()` system call
- Sets `TERM=xterm-256color` environment variable
- Creates libuv pipes connected to PTY stdin/stdout
- Sets terminal dimensions via `ioctl(process->pty, TIOCSWINSZ, &size)`

### Windows: ConPTY API

- Uses Windows Pseudo-Console API (Win10 1809+)
- `CreatePseudoConsole()` + named pipes + `CreateProcessW()`

## 2. Communication Protocol

### Binary WebSocket with Single-Byte Command Prefix

All messages are binary WebSocket frames: `[1-byte command][variable-length data]`

### Server → Client Commands

| Byte | Constant          | Description                    |
|------|-------------------|--------------------------------|
| `0`  | `OUTPUT`          | Raw PTY output data            |
| `1`  | `SET_WINDOW_TITLE`| Terminal title (UTF-8)         |
| `2`  | `SET_PREFERENCES` | Client settings (JSON)         |

### Client → Server Commands

| Byte | Constant           | Description                        |
|------|--------------------|------------------------------------|
| `0`  | `INPUT`            | Raw user input (keystrokes)        |
| `1`  | `RESIZE_TERMINAL`  | JSON `{"columns": N, "rows": N}`   |
| `2`  | `PAUSE`            | Flow control: pause PTY reading    |
| `3`  | `RESUME`           | Flow control: resume PTY reading   |
| `{`  | `JSON_DATA`        | Initial auth+sizing JSON           |

### Connection Lifecycle

1. Client connects WebSocket with protocol `"tty"`
2. Client sends initial JSON: `{"AuthToken":"...","columns":80,"rows":24}`
3. Server spawns PTY process
4. Bidirectional streaming begins

## 3. Data Flow: PTY → Browser

```
PTY output available
    → read_cb() triggered (libuv)
    → process_read_cb() stores in pty_buf
    → lws_callback_on_writable() signals WebSocket
    → LWS_CALLBACK_SERVER_WRITEABLE triggered
    → wsi_output() formats: [OUTPUT byte][raw PTY data]
    → lws_write() sends binary WebSocket frame
    → xterm.js receives and renders
```

Key code (`protocol.c`):
```c
static void wsi_output(struct lws *wsi, pty_buf_t *buf) {
  char *message = xmalloc(LWS_PRE + 1 + buf->len);
  char *ptr = message + LWS_PRE;
  *ptr = OUTPUT;                          // Command byte '0'
  memcpy(ptr + 1, buf->base, buf->len);   // Raw PTY data
  lws_write(wsi, (unsigned char *)ptr, buf->len + 1, LWS_WRITE_BINARY);
}
```

## 4. Data Flow: Browser → PTY

```
User types in xterm.js
    → terminal.onData(data)
    → payload = [INPUT byte][data bytes]
    → WebSocket.send(payload) (binary)
    → LWS_CALLBACK_RECEIVE triggered
    → INPUT command parsed
    → pty_write() writes to PTY stdin via uv_write()
```

Frontend code (`html/src/components/terminal/xterm/index.ts`):
```typescript
public sendData(data: string | Uint8Array) {
  const payload = new Uint8Array(data.length + 1);
  payload[0] = Command.INPUT.charCodeAt(0);  // '0'
  payload.set(data, 1);
  socket.send(payload);
}

// xterm.js events
terminal.onData(data => sendData(data));
terminal.onResize(({ cols, rows }) => {
  socket.send(encoder.encode(Command.RESIZE_TERMINAL + JSON.stringify({ columns: cols, rows: rows })));
});
```

## 5. Frontend: xterm.js

### Setup

```typescript
const term = new Terminal({...});
const fitAddon = new FitAddon();
term.loadAddon(fitAddon);
term.open(container);
fitAddon.fit();
```

### Rendering Backends

- `dom` — Basic DOM rendering
- `canvas` — Canvas 2D rendering
- `webgl` — WebGL hardware-accelerated rendering (default)

### Addons Used

- `FitAddon` — Auto-fit terminal to container
- `OverlayAddon` — On-screen messages (resize dimensions)
- `ClipboardAddon` — Clipboard integration
- `WebLinksAddon` — Clickable URLs
- `CanvasAddon` / `WebglAddon` — Hardware-accelerated rendering
- `ZmodemAddon` — File transfer
- `ImageAddon` — Inline images (sixel, iTerm2)

### Receiving Data

```typescript
private onSocketData(event: MessageEvent) {
  const rawData = event.data as ArrayBuffer;
  const cmd = String.fromCharCode(new Uint8Array(rawData)[0]);
  const data = rawData.slice(1);

  switch (cmd) {
    case Command.OUTPUT:
      this.writeFunc(data);  // → terminal.write(data)
      break;
    case Command.SET_WINDOW_TITLE:
      document.title = textDecoder.decode(data);
      break;
    case Command.SET_PREFERENCES:
      this.applyPreferences(JSON.parse(textDecoder.decode(data)));
      break;
  }
}
```

## 6. Flow Control

Prevents buffer overflow when PTY output faster than browser rendering.

```typescript
const flowControl = {
  limit: 100000,    // Max bytes before starting flow control
  highWater: 10,    // PAUSE when > 10 pending writes
  lowWater: 4,      // RESUME when < 4 pending writes
};

writeData(data) {
  this.written += data.length;
  if (this.written > limit) {
    terminal.write(data, () => {
      this.pending--;
      if (this.pending < lowWater) socket.send(RESUME);
    });
    this.pending++;
    if (this.pending > highWater) socket.send(PAUSE);
  }
}
```

Server-side (`pty.c`):
```c
// PAUSE: uv_read_stop(process->out)
// RESUME: uv_read_start(process->out, alloc_cb, read_cb)
```

## 7. Key Takeaways for Our WebUI

### What ttyd Does Right
- **Raw byte forwarding** — no server-side parsing of PTY output
- **Terminal size sync** — resize events from browser → PTY `ioctl(TIOCSWINSZ)`
- **Flow control** — prevents overwhelming slow clients
- **Binary WebSocket** — efficient, no base64 encoding overhead

### Limitations for Our Use Case
- ttyd is a **generic terminal** — it doesn't understand Claude's output format
- No structured message parsing — everything is raw terminal
- No semantic UI (tool calls, thinking, etc.) — just a terminal view
- C implementation — not directly reusable in our Node.js/Bun stack

### Our PTY + xterm.js Approach (Current)
- Uses Bun.spawn with `terminal` option (equivalent to forkpty)
- Base64 encodes PTY bytes → SSE → xterm.js (less efficient than binary WebSocket)
- POST /api/operations/input for user keystrokes (higher latency than WebSocket)
- POST /api/operations/resize for terminal resize

### Potential Improvement: WebSocket
If latency becomes an issue, could switch to binary WebSocket like ttyd:
- Bidirectional in single connection
- No base64 overhead
- Lower latency for keystrokes
- But: Next.js doesn't natively support WebSocket (would need custom server)
