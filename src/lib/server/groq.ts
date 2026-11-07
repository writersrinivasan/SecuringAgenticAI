import "server-only";
import { ChatGroq } from "@langchain/groq";

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export const DEFAULT_MODEL = "llama-3.3-70b-versatile";

/** BYOK: read the user's Groq key from the request header. Never log it, never persist it. */
export function getGroqKey(req: Request): string {
  const key = req.headers.get("x-groq-key")?.trim();
  if (!key) throw new HttpError(401, "Missing Groq API key. Add your key via the 🔑 button.");
  if (!/^gsk_[A-Za-z0-9]{20,}$/.test(key)) throw new HttpError(400, "That doesn't look like a Groq key (expected gsk_…).");
  return key;
}

export function getModelName(req: Request): string {
  const m = req.headers.get("x-groq-model")?.trim();
  return m && /^[\w./:-]{3,80}$/.test(m) ? m : DEFAULT_MODEL;
}

export function makeModel(apiKey: string, model: string, temperature = 0.3, maxTokens = 1200) {
  return new ChatGroq({ apiKey, model, temperature, maxTokens, maxRetries: 1 });
}

// Simple in-memory sliding-window rate limit per client (unbounded-consumption guard for this app itself).
const hits = new Map<string, number[]>();
export function rateLimit(req: Request, limit = 30, windowMs = 60_000) {
  const id = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const now = Date.now();
  const arr = (hits.get(id) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= limit) throw new HttpError(429, "Rate limit hit (30 req/min). Slow down a little 🙂");
  arr.push(now);
  hits.set(id, arr);
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) return Response.json({ error: e.message }, { status: e.status });
  const msg = e instanceof Error ? e.message : String(e);
  // Scrub anything key-like from upstream error messages before returning them.
  const safe = msg.replace(/gsk_[A-Za-z0-9]+/g, "gsk_••••").slice(0, 400);
  const status = /401|invalid api key/i.test(safe) ? 401 : /429|rate/i.test(safe) ? 429 : 500;
  return Response.json({ error: safe }, { status });
}

export async function readJson<T>(req: Request, maxBytes = 32_000): Promise<T> {
  const text = await req.text();
  if (text.length > maxBytes) throw new HttpError(413, "Request too large");
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new HttpError(400, "Invalid JSON");
  }
}
