import { getCurrentUser } from "@/server/auth/get-current-user";
import {
  ensureRealtimeListener,
  subscribeToSalonRealtime,
} from "@/server/realtime/realtime-listener";
import { toRealtimeClientEvent } from "@/server/realtime/realtime-types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const encoder = new TextEncoder();
const HEARTBEAT_MS = 20_000;

function encodeSseData(data: unknown, eventId?: string) {
  const id = eventId ? `id: ${eventId}\n` : "";
  return encoder.encode(`${id}data: ${JSON.stringify(data)}\n\n`);
}

export async function GET(request: Request) {
  let user: Awaited<ReturnType<typeof getCurrentUser>>;

  try {
    user = await getCurrentUser();
  } catch {
    return new Response("Unauthorized", {
      status: 401,
      headers: { "Cache-Control": "no-store" },
    });
  }

  try {
    await ensureRealtimeListener();
  } catch (error) {
    console.error("[realtime] SSE unavailable", error);
    return new Response("Realtime temporarily unavailable", {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Retry-After": "2",
      },
    });
  }

  let cleanup = () => {};

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      let closed = false;

      const safeEnqueue = (chunk: Uint8Array) => {
        if (closed) return;
        try {
          controller.enqueue(chunk);
        } catch {
          closed = true;
        }
      };

      // EventSource utilisera cette valeur pour ses reconnexions automatiques.
      safeEnqueue(encoder.encode("retry: 3000\n\n"));
      // Commentaire SSE : garde la connexion chaude sans déclencher de refresh.
      safeEnqueue(encoder.encode(": connected\n\n"));

      const unsubscribe = subscribeToSalonRealtime(user.salonId, (event) => {
        safeEnqueue(encodeSseData(toRealtimeClientEvent(event), event.eventId));
      });

      const heartbeat = setInterval(() => {
        safeEnqueue(encoder.encode(": heartbeat\n\n"));
      }, HEARTBEAT_MS);

      const close = () => {
        if (closed) return;
        closed = true;
        clearInterval(heartbeat);
        unsubscribe();
        try {
          controller.close();
        } catch {
          // Le navigateur/proxy peut déjà avoir fermé le flux.
        }
      };

      request.signal.addEventListener("abort", close, { once: true });
      cleanup = close;
    },
    cancel() {
      cleanup();
    },
  });

  return new Response(stream, {
    status: 200,
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
