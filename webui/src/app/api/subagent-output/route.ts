import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const MAX_READ_BYTES = 512 * 1024; // 512KB per chunk
const BLOCKED_PREFIXES = ["/etc/", "/var/", "/usr/", "/bin/", "/sbin/"];
const FALLBACK_POLL_MS = 1000;

function isPathAllowed(targetPath: string): boolean {
  const resolved = path.resolve(targetPath);
  if (resolved !== targetPath && targetPath.includes("..")) return false;
  for (const prefix of BLOCKED_PREFIXES) {
    if (resolved.startsWith(prefix)) return false;
  }
  return true;
}

/**
 * SSE endpoint that tails a sub-agent output file.
 * Streams incremental chunks as the file grows using fs.watch + fallback timer.
 *
 * GET /api/subagent-output?path=<absolute-path>
 *
 * SSE events: data: {"content":"...","size":123}
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const pathParam = url.searchParams.get("path");

  if (!pathParam || !path.isAbsolute(pathParam)) {
    return new Response("path must be an absolute path", { status: 400 });
  }
  if (!isPathAllowed(pathParam)) {
    return new Response("path not allowed", { status: 403 });
  }

  // Re-bind as non-nullable for use inside closures
  const targetPath: string = pathParam;
  const encoder = new TextEncoder();
  let offset = 0;
  let watcher: fs.FSWatcher | null = null;
  let fallbackTimer: ReturnType<typeof setInterval> | null = null;
  let closed = false;

  const stream = new ReadableStream({
    start(controller) {
      // SSE comment to establish connection
      controller.enqueue(encoder.encode(":ok\n\n"));

      function sendChunk() {
        if (closed) return;
        try {
          const file = Bun.file(targetPath);
          const fileSize = file.size;
          if (fileSize === 0 || fileSize <= offset) return;

          const readLen = Math.min(fileSize - offset, MAX_READ_BYTES);
          file.slice(offset, offset + readLen).text().then((text: string) => {
            if (closed) return;
            offset += readLen;
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ content: text, size: offset })}\n\n`
              )
            );
          }).catch(() => {
            // read failed silently
          });

          // Set up fs.watch once the file exists (it may not exist on first call)
          startWatching();
        } catch (err) {
          if ((err as NodeJS.ErrnoException).code === "ENOENT") {
            // File doesn't exist yet — fallback timer will retry
            return;
          }
          // Unexpected error
          if (!closed) {
            controller.enqueue(
              encoder.encode(
                `data: ${JSON.stringify({ error: "read failed" })}\n\n`
              )
            );
          }
        }
      }

      function startWatching() {
        if (watcher || closed) return;
        try {
          watcher = fs.watch(targetPath, () => sendChunk());
          watcher.on("error", () => {
            // File may have been removed/recreated; drop the watcher and let fallback handle it
            if (watcher) {
              watcher.close();
              watcher = null;
            }
          });
        } catch {
          // fs.watch throws if file doesn't exist; ignore
        }
      }

      function cleanup() {
        if (closed) return;
        closed = true;
        if (watcher) {
          watcher.close();
          watcher = null;
        }
        if (fallbackTimer) {
          clearInterval(fallbackTimer);
          fallbackTimer = null;
        }
        try {
          controller.close();
        } catch {
          // already closed
        }
      }

      // Initial read
      sendChunk();

      // Fallback timer ensures we catch changes even if fs.watch misses them
      // or the file hasn't been created yet
      fallbackTimer = setInterval(sendChunk, FALLBACK_POLL_MS);

      // Cleanup on client disconnect
      request.signal.addEventListener("abort", cleanup);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      "X-Accel-Buffering": "no",
    },
  });
}
