import { queryEngineEvents } from "@/lib/engine-event-bus/engine-event-bus";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** MVP 85 — SSE stream for engine event bus UI sync. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const meaningfulOnly = searchParams.get("meaningful") === "1";
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let lastTopId: string | null = null;

      const send = async () => {
        try {
          const { events, total } = await queryEngineEvents({
            limit: meaningfulOnly ? 10 : 30,
            meaningfulOnly,
          });
          const topId = events[0]?.id ?? null;
          const changed = topId !== lastTopId;
          lastTopId = topId;

          controller.enqueue(
            encoder.encode(
              `data: ${JSON.stringify({
                ok: true,
                changed,
                events,
                total,
                liveTradingLocked: true,
              })}\n\n`,
            ),
          );
        } catch {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ ok: false })}\n\n`),
          );
        }
      };

      await send();
      const interval = setInterval(() => void send(), 4000);
      // @ts-expect-error — stream lifecycle
      controller.signal?.addEventListener?.("abort", () => clearInterval(interval));
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
