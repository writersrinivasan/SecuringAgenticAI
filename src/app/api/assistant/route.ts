import { AIMessage, HumanMessage } from "@langchain/core/messages";
import { buildTutorGraph } from "@/lib/server/tutorGraph";
import { errorResponse, getGroqKey, getModelName, rateLimit, readJson } from "@/lib/server/groq";
import { ndjsonStream } from "@/lib/server/ndjson";

type Body = { messages: { role: "user" | "assistant"; content: string }[]; moduleContext?: string };

export async function POST(req: Request) {
  try {
    rateLimit(req);
    const apiKey = getGroqKey(req);
    const model = getModelName(req);
    const body = await readJson<Body>(req, 60_000);
    const messages = (body.messages ?? []).slice(-12).map((m) =>
      m.role === "user" ? new HumanMessage(String(m.content).slice(0, 6000)) : new AIMessage(String(m.content).slice(0, 6000)),
    );
    if (!messages.length) return Response.json({ error: "No messages" }, { status: 400 });

    const graph = buildTutorGraph(apiKey, model);

    return ndjsonStream(async (send) => {
      const stream = await graph.stream(
        { messages, moduleContext: String(body.moduleContext ?? "").slice(0, 2000) },
        { streamMode: ["updates", "messages"], recursionLimit: 10 },
      );
      for await (const [mode, chunk] of stream as AsyncIterable<[string, unknown]>) {
        if (mode === "messages") {
          const [msg, meta] = chunk as [{ content: unknown }, { langgraph_node?: string }];
          if (meta?.langgraph_node === "tutor" && typeof msg.content === "string" && msg.content) send({ type: "token", content: msg.content });
        } else if (mode === "updates") {
          for (const [node, upd] of Object.entries(chunk as Record<string, Record<string, unknown>>)) {
            const u = upd ?? {};
            if (node === "inputGuard") send({ type: "node", node, injectionScore: u.injectionScore, hasSecrets: u.hasSecrets, findings: u.findings });
            else if (node === "redactInput") send({ type: "node", node, findings: u.findings });
            else if (node === "tutor") send({ type: "node", node });
            else if (node === "outputGuard") send({ type: "node", node, findings: u.findings, final: u.final });
          }
        }
      }
      send({ type: "done" });
    });
  } catch (e) {
    return errorResponse(e);
  }
}
