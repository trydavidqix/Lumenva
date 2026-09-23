import { pollEvents } from "./event-bus";
import type { RealtimePollAccess } from "./event-bus";
import { logger } from "@/lib/logger";

const POLL_INTERVAL_MS = 2000;
const MAX_CONNECTION_MS = 60000 * 5; // 5 minutes max per stream to allow load balancing

function formatSSE(event: string, data: unknown): string {
  const dataStr = typeof data === "string" ? data : JSON.stringify(data);
  return `event: ${event}\ndata: ${dataStr}\n\n`;
}

export function createSSEStream(
  organizationId: string,
  initialCursor: Date,
  requestSignal: AbortSignal,
  access: RealtimePollAccess,
): Response {
  let cursor = initialCursor;
  let isClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const abortHandler = () => {
        isClosed = true;
      };
      requestSignal.addEventListener("abort", abortHandler);

      // Start pinging to keep connection alive
      const pingInterval = setInterval(() => {
        if (!isClosed) {
          try {
            controller.enqueue(new TextEncoder().encode(formatSSE("ping", { time: new Date().toISOString() })));
          } catch {
            isClosed = true;
          }
        }
      }, 15000);

      const timeoutId = setTimeout(() => {
        isClosed = true;
      }, MAX_CONNECTION_MS);

      try {
        while (!isClosed) {
          const events = await pollEvents(organizationId, cursor, 50, access);

          if (events.length > 0) {
            for (const ev of events) {
              if (isClosed) break;

              const payloadStr = JSON.stringify({
                id: ev.id,
                type: ev.event_type,
                payload: ev.payload,
                entity_kind: ev.entity_kind,
                entity_id: ev.entity_id,
                created_at: ev.created_at,
              });

              controller.enqueue(new TextEncoder().encode(`event: message\ndata: ${payloadStr}\n\n`));
              cursor = new Date(ev.created_at);
            }
          }

          if (isClosed) break;
          await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
        }
      } catch (err) {
        logger.error("[sse-stream] Error in SSE stream", { error: err instanceof Error ? err.message : String(err) });
      } finally {
        isClosed = true;
        clearInterval(pingInterval);
        clearTimeout(timeoutId);
        requestSignal.removeEventListener("abort", abortHandler);
        try {
          controller.close();
        } catch {
          // Ignore if already closed
        }
      }
    },
    cancel() {
      isClosed = true;
    }
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-store, max-age=0",
      "Connection": "keep-alive",
    },
  });
}
