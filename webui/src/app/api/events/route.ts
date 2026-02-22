import {
  getOperation,
  getOperationEvents,
  subscribeToOperation,
} from "@/lib/process-manager";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const operationId = url.searchParams.get("operationId");

  if (!operationId) {
    return new Response("operationId is required", { status: 400 });
  }

  const operation = getOperation(operationId);
  if (!operation) {
    console.log(`[sse][${operationId}] operation not found`);
    return new Response("operation not found", { status: 404 });
  }

  console.log(`[sse][${operationId}] connected, status=${operation.status}`);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      // SSE comment to establish connection
      controller.enqueue(encoder.encode(":ok\n\n"));

      // Send existing events
      const existing = getOperationEvents(operationId);
      console.log(`[sse][${operationId}] sending ${existing.length} existing events`);
      for (const event of existing) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
        );
      }

      // If already finished, close immediately
      if (operation.status !== "running") {
        console.log(`[sse][${operationId}] already done, closing`);
        controller.close();
        return;
      }

      // Subscribe to new events
      const unsubscribe = subscribeToOperation(operationId, (event) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(event)}\n\n`)
          );
          // Only close on the pipeline-level complete (no childLabel).
          // Child process completes should not end the SSE stream.
          if (event.type === "complete" && !event.childLabel) {
            console.log(`[sse][${operationId}] complete`);
            unsubscribe();
            controller.close();
          }
        } catch {
          unsubscribe();
        }
      });

      request.signal.addEventListener("abort", () => {
        console.log(`[sse][${operationId}] client disconnected`);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // already closed
        }
      });
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
