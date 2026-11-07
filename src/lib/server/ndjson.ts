import "server-only";

/** Stream newline-delimited JSON events to the client. */
export function ndjsonStream(run: (send: (event: Record<string, unknown>) => void) => Promise<void>) {
  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (e: Record<string, unknown>) => controller.enqueue(enc.encode(JSON.stringify(e) + "\n"));
      try {
        await run(send);
      } catch (e) {
        const msg = (e instanceof Error ? e.message : String(e)).replace(/gsk_[A-Za-z0-9]+/g, "gsk_••••").slice(0, 400);
        send({ type: "error", error: msg });
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store" } });
}
