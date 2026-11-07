import { Command } from "@langchain/langgraph";
import { HumanMessage } from "@langchain/core/messages";
import { buildSandboxGraph } from "@/lib/server/sandboxGraph";
import { errorResponse, getGroqKey, getModelName, HttpError, rateLimit, readJson } from "@/lib/server/groq";
import { ndjsonStream } from "@/lib/server/ndjson";
import { DEFAULT_POLICY, validatePolicy, type Policy } from "@/lib/policy";

type Body = { threadId: string; task?: string; role?: string; policy?: Policy; resume?: Record<string, boolean> };

export async function POST(req: Request) {
  try {
    rateLimit(req);
    const apiKey = getGroqKey(req);
    const model = getModelName(req);
    const body = await readJson<Body>(req, 40_000);
    if (!/^[\w-]{6,64}$/.test(body.threadId ?? "")) throw new HttpError(400, "Invalid threadId");
    const role = ["intern", "analyst", "admin"].includes(body.role ?? "") ? body.role! : "analyst";
    let policy = DEFAULT_POLICY;
    if (body.policy) {
      const err = validatePolicy(body.policy);
      if (err) throw new HttpError(400, `Policy error: ${err}`);
      policy = body.policy;
    }

    const graph = buildSandboxGraph(apiKey, model);
    const config = { configurable: { thread_id: body.threadId }, streamMode: "updates" as const, recursionLimit: 30 };

    const input = body.resume
      ? new Command({ resume: body.resume })
      : { messages: [new HumanMessage(String(body.task ?? "").slice(0, 2000))], role, policy, tainted: false, toolCalls: 0, audit: [], findings: [], final: "" };

    return ndjsonStream(async (send) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const stream = await graph.stream(input as any, config);
      for await (const chunk of stream as AsyncIterable<Record<string, Record<string, unknown>>>) {
        for (const [node, upd] of Object.entries(chunk)) {
          if (node === "__interrupt__") continue;
          const u = upd ?? {};
          const out: Record<string, unknown> = { type: "node", node, audit: u.audit ?? [] };
          if (node === "agent") {
            const m = (u.messages as { content: unknown; tool_calls?: { name: string; args: unknown }[] }[] | undefined)?.[0];
            out.toolCalls = m?.tool_calls?.map((t) => ({ name: t.name, args: t.args })) ?? [];
            out.content = typeof m?.content === "string" ? m.content : "";
          }
          if (node === "policyCheck") out.pending = u.pending;
          if (node === "tools") out.tainted = u.tainted;
          if (node === "outputGuard") {
            out.final = u.final;
            out.findings = u.findings;
          }
          send(out);
        }
      }
      const snap = await graph.getState({ configurable: { thread_id: body.threadId } });
      const interrupts = snap.tasks.flatMap((t) => t.interrupts ?? []);
      if (interrupts.length) send({ type: "interrupt", value: interrupts[0].value });
      else send({ type: "done", tainted: snap.values.tainted, toolCalls: snap.values.toolCalls });
    });
  } catch (e) {
    return errorResponse(e);
  }
}
