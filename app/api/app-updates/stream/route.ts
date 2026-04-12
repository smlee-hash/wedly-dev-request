import { updateEmitter } from "@/lib/update-emitter";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** SSE 엔드포인트: 업데이트 알림을 실시간으로 클라이언트에 push */
export async function GET() {
  const encoder = new TextEncoder();

  let cleanupFn: (() => void) | null = null;

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode("data: {\"type\":\"connected\"}\n\n"));

      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": heartbeat\n\n"));
        } catch {
          cleanup();
        }
      }, 30000);

      const onUpdate = (update: unknown) => {
        try {
          const data = JSON.stringify({ type: "new-update", data: update });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
        } catch {
          cleanup();
        }
      };

      updateEmitter.on("new-update", onUpdate);

      function cleanup() {
        clearInterval(heartbeat);
        updateEmitter.off("new-update", onUpdate);
      }

      cleanupFn = cleanup;
    },
    cancel() {
      cleanupFn?.();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
