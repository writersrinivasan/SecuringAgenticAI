import { buildRedteamGraph, newSecret, type Defenses } from "@/lib/server/redteamGraph";
import { errorResponse, getGroqKey, getModelName, rateLimit, readJson } from "@/lib/server/groq";
import { ndjsonStream } from "@/lib/server/ndjson";

type Body = { attack: string; mode: "direct" | "indirect"; defenses: Defenses };

export async function POST(req: Request) {
  try {
    rateLimit(req);
    const apiKey = getGroqKey(req);
    const model = getModelName(req);
    const body = await readJson<Body>(req);
    const attack = String(body.attack ?? "").slice(0, 4000);
    if (!attack.trim()) return Response.json({ error: "Write an attack first" }, { status: 400 });
    const d = body.defenses ?? ({} as Defenses);
    const defenses: Defenses = {
      hardenedPrompt: !!d.hardenedPrompt,
      spotlighting: !!d.spotlighting,
      inputClassifier: !!d.inputClassifier,
      outputFilter: !!d.outputFilter,
      llmJudge: !!d.llmJudge,
    };
    const secret = newSecret();
    const graph = buildRedteamGraph(apiKey, model);

    return ndjsonStream(async (send) => {
      const stream = await graph.stream(
        { attack, mode: body.mode === "indirect" ? "indirect" : "direct", defenses, secret },
        { streamMode: "updates", recursionLimit: 10 },
      );
      let final: Record<string, unknown> = {};
      for await (const chunk of stream as AsyncIterable<Record<string, Record<string, unknown>>>) {
        for (const [node, upd] of Object.entries(chunk)) {
          send({ type: "node", node, blockedBy: upd?.blockedBy ?? null, findings: upd?.findings ?? [] });
          final = { ...final, ...(upd ?? {}) };
        }
      }
      // The secret is regenerated per attempt, so revealing it after the attempt is safe and educational.
      send({ type: "result", secret, rawResponse: final.rawResponse ?? "", response: final.response ?? "", judgeReason: final.judgeReason ?? "", result: final.result });
    });
  } catch (e) {
    return errorResponse(e);
  }
}
