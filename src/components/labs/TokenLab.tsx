"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, Trash2, XCircle } from "lucide-react";
import { useApp } from "@/lib/store";
import { Card, GradientButton } from "./ui";

const DEMO_SECRET = "demo-signing-key-do-not-use-in-prod";
const TRUSTED_ISS = "https://idp.acme.com";
const RESOURCE = { aud: "https://payments.acme.com", requiredScope: "payments:create" };
const USER_SCOPES = ["invoices:read", "payments:create", "payments:refund", "profile:read"];

type Hop = { agent: string; scopes: string[] };

const b64url = (data: string | Uint8Array) => {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;
  let s = "";
  bytes.forEach((b) => (s += String.fromCharCode(b)));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
};
const fromB64url = (s: string) => {
  const pad = s.replace(/-/g, "+").replace(/_/g, "/");
  return decodeURIComponent(escape(atob(pad + "===".slice((pad.length + 3) % 4))));
};

async function hmac(input: string) {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(DEMO_SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(input));
  return b64url(new Uint8Array(sig));
}

type Check = { name: string; ok: boolean; detail: string };

const SCENARIOS: { id: string; label: string; apply: (s: State) => Partial<State> }[] = [
  { id: "replay", label: "🎯 Replay to wrong audience", apply: () => ({ aud: "https://hr.acme.com" }) },
  { id: "expired", label: "⌛ Expired token", apply: () => ({ expMin: -5 }) },
  { id: "longlived", label: "🧟 30-day token", apply: () => ({ expMin: 60 * 24 * 30 }) },
  { id: "escalate", label: "📈 Sub-agent scope escalation", apply: (s) => ({ hops: s.hops.map((h, i) => (i === s.hops.length - 1 ? { ...h, scopes: [...h.scopes, "admin:*"] } : h)) }) },
  { id: "noact", label: "🎭 Impersonation (no act claim)", apply: () => ({ includeAct: false }) },
  { id: "bearer", label: "🔓 Unbound bearer token", apply: () => ({ dpop: false }) },
  { id: "evil-iss", label: "🏴 Untrusted issuer", apply: () => ({ iss: "https://evil-idp.example" }) },
];

type State = { iss: string; aud: string; expMin: number; hops: Hop[]; includeAct: boolean; dpop: boolean };

const INITIAL: State = {
  iss: TRUSTED_ISS,
  aud: RESOURCE.aud,
  expMin: 5,
  includeAct: true,
  dpop: true,
  hops: [
    { agent: "agent:finance-planner", scopes: ["invoices:read", "payments:create"] },
    { agent: "agent:payments-worker", scopes: ["payments:create"] },
  ],
};

export function TokenLab({ gradient }: { gradient: string; accent: string }) {
  const { completeLab } = useApp();
  const [s, setS] = useState<State>(INITIAL);
  const [jwt, setJwt] = useState("");
  const [tampered, setTampered] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [tried, setTried] = useState<string[]>([]);
  const [now] = useState(() => Math.floor(Date.now() / 1000));

  const claims = useMemo(() => {
    const last = s.hops[s.hops.length - 1];
    let act: Record<string, unknown> | undefined;
    for (const h of s.hops) act = act ? { sub: h.agent, act } : { sub: h.agent };
    return {
      iss: s.iss,
      sub: "user:alice",
      ...(s.includeAct && act ? { act } : {}),
      aud: s.aud,
      scope: (last?.scopes ?? []).join(" "),
      iat: now,
      exp: now + s.expMin * 60,
      ...(s.dpop ? { cnf: { jkt: "0ZcOCORZNYy-DWpqq30jZyJGHTN0d2HglBV3uiguA4I" } } : {}),
      delegation: s.hops.map((h) => ({ agent: h.agent, scopes: h.scopes })),
    };
  }, [s, now]);

  // Mint
  useEffect(() => {
    let alive = true;
    (async () => {
      const head = b64url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const body = b64url(JSON.stringify(claims));
      const sig = await hmac(`${head}.${body}`);
      if (alive) {
        setJwt(`${head}.${body}.${sig}`);
        setTampered(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [claims]);

  const validate = async () => {
    const [h, b, sig] = jwt.split(".");
    const out: Check[] = [];
    const goodSig = (await hmac(`${h}.${b}`)) === sig;
    out.push({ name: "Signature (HS256)", ok: goodSig, detail: goodSig ? "Signature matches payload" : "Payload was modified after signing!" });
    let c: typeof claims;
    try {
      c = JSON.parse(fromB64url(b));
    } catch {
      setChecks([...out, { name: "Decode", ok: false, detail: "Payload is not valid JSON" }]);
      return;
    }
    out.push({ name: "Issuer trusted", ok: c.iss === TRUSTED_ISS, detail: `iss = ${c.iss}` });
    out.push({ name: "Audience pinned", ok: c.aud === RESOURCE.aud, detail: `aud = ${c.aud}, resource expects ${RESOURCE.aud}` });
    const t = Math.floor(Date.now() / 1000);
    out.push({ name: "Not expired", ok: c.exp > t, detail: `exp in ${Math.round((c.exp - t) / 60)} min` });
    out.push({ name: "Short-lived (≤ 15 min)", ok: c.exp - c.iat <= 900, detail: `lifetime ${Math.round((c.exp - c.iat) / 60)} min` });
    out.push({ name: "Required scope", ok: c.scope.split(" ").includes(RESOURCE.requiredScope), detail: `needs ${RESOURCE.requiredScope}; has "${c.scope}"` });
    out.push({ name: "Actor identified (on-behalf-of)", ok: !!c.act, detail: c.act ? `act.sub = ${(c.act as { sub: string }).sub}` : "No act claim — agent is impersonating the user" });
    let depth = 0;
    for (let a = c.act as { act?: unknown } | undefined; a; a = a.act as { act?: unknown } | undefined) depth++;
    out.push({ name: "Delegation depth ≤ 2", ok: depth <= 2, detail: `depth ${depth}` });
    let parent = USER_SCOPES;
    let downOk = true;
    let why = "each hop ⊆ parent";
    for (const hop of c.delegation) {
      const extra = hop.scopes.filter((x) => !parent.includes(x));
      if (extra.length) {
        downOk = false;
        why = `${hop.agent} gained ${extra.join(", ")}`;
        break;
      }
      parent = hop.scopes;
    }
    out.push({ name: "Down-scoped on every hop", ok: downOk, detail: why });
    out.push({ name: "Proof-of-possession (DPoP cnf)", ok: !!c.cnf, detail: c.cnf ? "cnf.jkt bound to agent key" : "Bearer token — usable by anyone who steals it" });
    setChecks(out);
    if (out.every((x) => x.ok) && tried.length >= 2) completeLab("token-lab");
  };

  const tamper = () => {
    const [h, b, sig] = jwt.split(".");
    const c = JSON.parse(fromB64url(b));
    c.scope = `${c.scope} admin:*`;
    setJwt(`${h}.${b64url(JSON.stringify(c))}.${sig}`);
    setTampered(true);
    setTried((t) => Array.from(new Set([...t, "tamper"])));
  };

  const [h, b, sig] = jwt.split(".");
  const passCount = checks.filter((c) => c.ok).length;

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300">
        🎯 <b>Goal:</b> Alice delegates to a planner agent, which delegates to a payments worker. Try at least <b>2 attack scenarios</b>, see which checks catch them, then reset to a token that passes <b>all</b> checks.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="Mint a delegated token">
          <div className="space-y-2 text-sm">
            <label className="block">
              <span className="text-xs text-slate-400">Issuer</span>
              <input value={s.iss} onChange={(e) => setS({ ...s, iss: e.target.value })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Audience</span>
              <input value={s.aud} onChange={(e) => setS({ ...s, aud: e.target.value })} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1 font-mono text-xs" />
            </label>
            <label className="block">
              <span className="text-xs text-slate-400">Lifetime (minutes): {s.expMin}</span>
              <input type="range" min={-10} max={120} value={Math.min(120, s.expMin)} onChange={(e) => setS({ ...s, expMin: Number(e.target.value) })} className="w-full accent-indigo-400" />
            </label>
            <div className="flex gap-3 text-xs">
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={s.includeAct} onChange={(e) => setS({ ...s, includeAct: e.target.checked })} /> include <code>act</code>
              </label>
              <label className="flex items-center gap-1">
                <input type="checkbox" checked={s.dpop} onChange={(e) => setS({ ...s, dpop: e.target.checked })} /> DPoP-bound
              </label>
            </div>
            <div>
              <span className="text-xs text-slate-400">Delegation chain (user:alice → …)</span>
              <div className="mt-1 space-y-1.5">
                {s.hops.map((hop, i) => (
                  <div key={i} className="rounded-lg bg-black/30 p-2">
                    <div className="flex items-center gap-1">
                      <span className="text-xs text-indigo-300">↳</span>
                      <input
                        value={hop.agent}
                        onChange={(e) => setS({ ...s, hops: s.hops.map((x, j) => (j === i ? { ...x, agent: e.target.value } : x)) })}
                        className="flex-1 bg-transparent font-mono text-xs outline-none"
                      />
                      <button onClick={() => setS({ ...s, hops: s.hops.filter((_, j) => j !== i) })} className="text-slate-500 hover:text-rose-300" aria-label="Remove hop">
                        <Trash2 size={12} />
                      </button>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1">
                      {[...USER_SCOPES, "admin:*"].map((sc) => (
                        <button
                          key={sc}
                          onClick={() =>
                            setS({ ...s, hops: s.hops.map((x, j) => (j === i ? { ...x, scopes: x.scopes.includes(sc) ? x.scopes.filter((y) => y !== sc) : [...x.scopes, sc] } : x)) })
                          }
                          className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${hop.scopes.includes(sc) ? "bg-indigo-500/40 text-white" : "bg-white/5 text-slate-500"}`}
                        >
                          {sc}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
                <button onClick={() => setS({ ...s, hops: [...s.hops, { agent: `agent:sub-${s.hops.length + 1}`, scopes: [] }] })} className="flex items-center gap-1 text-xs text-indigo-300">
                  <Plus size={12} /> add hop
                </button>
              </div>
            </div>
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Attack scenarios">
            <div className="flex flex-wrap gap-1.5">
              {SCENARIOS.map((sc) => (
                <button
                  key={sc.id}
                  onClick={() => {
                    setS((cur) => ({ ...cur, ...sc.apply(cur) }));
                    setTried((t) => Array.from(new Set([...t, sc.id])));
                    setChecks([]);
                  }}
                  className={`rounded-lg px-2 py-1 text-xs ${tried.includes(sc.id) ? "bg-rose-500/25 text-rose-200" : "bg-white/5 hover:bg-white/10"}`}
                >
                  {sc.label}
                </button>
              ))}
              <button onClick={tamper} className="rounded-lg bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
                ✂️ Tamper payload
              </button>
              <button
                onClick={() => {
                  setS(INITIAL);
                  setChecks([]);
                }}
                className="rounded-lg bg-emerald-500/20 px-2 py-1 text-xs text-emerald-200"
              >
                ↺ Reset to secure
              </button>
            </div>
          </Card>
          <Card title={`Encoded JWT ${tampered ? "· ⚠️ tampered" : ""}`}>
            <p className="break-all font-mono text-[11px] leading-relaxed">
              <span className="text-rose-300">{h}</span>.<span className="text-violet-300">{b}</span>.<span className="text-sky-300">{sig}</span>
            </p>
          </Card>
        </div>
      </div>

      <Card title="Decoded claims">
        <pre className="scroll-thin max-h-56 overflow-auto rounded-lg bg-black/40 p-3 font-mono text-[11px] text-cyan-200">{b ? JSON.stringify(JSON.parse(fromB64url(b)), null, 2) : ""}</pre>
      </Card>

      <GradientButton gradient={gradient} onClick={validate} className="w-full">
        Run resource-server validator
      </GradientButton>

      {checks.length > 0 && (
        <Card title={`Validator: ${passCount}/${checks.length} checks passed → ${passCount === checks.length ? "✅ ACCESS GRANTED" : "⛔ 401 REJECTED"}`}>
          <div className="grid gap-1.5 sm:grid-cols-2">
            {checks.map((c) => (
              <div key={c.name} className={`flex gap-2 rounded-lg p-2 text-xs ${c.ok ? "bg-emerald-500/10" : "bg-rose-500/15"}`}>
                {c.ok ? <CheckCircle2 size={14} className="shrink-0 text-emerald-400" /> : <XCircle size={14} className="shrink-0 text-rose-400" />}
                <span>
                  <b className="block text-slate-100">{c.name}</b>
                  <span className="text-slate-400">{c.detail}</span>
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
