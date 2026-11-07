import { errorResponse, getGroqKey, HttpError, rateLimit } from "@/lib/server/groq";

/** Validates a BYOK key by listing the models it can access. The key is used for this one call only. */
export async function POST(req: Request) {
  try {
    rateLimit(req);
    const key = getGroqKey(req);
    const r = await fetch("https://api.groq.com/openai/v1/models", { headers: { Authorization: `Bearer ${key}` }, cache: "no-store" });
    if (r.status === 401) throw new HttpError(401, "Groq rejected this key (401).");
    if (!r.ok) throw new HttpError(r.status, `Groq returned ${r.status}`);
    const data = (await r.json()) as { data: { id: string; active?: boolean }[] };
    const models = data.data
      .filter((m) => m.active !== false && !/whisper|tts|guard|playai|orpheus|distil/i.test(m.id))
      .map((m) => m.id)
      .sort();
    return Response.json({ ok: true, models });
  } catch (e) {
    return errorResponse(e);
  }
}
