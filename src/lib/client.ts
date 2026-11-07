"use client";

export type Creds = { apiKey: string; model: string };

const headers = (c: Creds) => ({ "Content-Type": "application/json", "x-groq-key": c.apiKey, "x-groq-model": c.model });

export async function postJson<T>(url: string, body: unknown, c: Creds): Promise<T> {
  const r = await fetch(url, { method: "POST", headers: headers(c), body: JSON.stringify(body) });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  return data as T;
}

/** POST and consume an NDJSON event stream. */
export async function streamNdjson(url: string, body: unknown, c: Creds, onEvent: (e: Record<string, unknown>) => void, signal?: AbortSignal) {
  const r = await fetch(url, { method: "POST", headers: headers(c), body: JSON.stringify(body), signal });
  if (!r.ok || !r.body) {
    const data = await r.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error ?? `HTTP ${r.status}`);
  }
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim();
      buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (ev.type === "error") throw new Error(ev.error);
      onEvent(ev);
    }
  }
}
