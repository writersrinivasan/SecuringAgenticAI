"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { Badge, Card, Toggle } from "./ui";

type Leg = "private" | "untrusted" | "external";
type Component = { id: string; label: string; emoji: string; legs: Leg[]; risk: number; threats: string[] };

const COMPONENTS: Component[] = [
  { id: "crm", label: "Customer DB / CRM access", emoji: "🗄️", legs: ["private"], risk: 14, threats: ["LLM02 Sensitive info disclosure", "ASI03 Identity & privilege abuse"] },
  { id: "inbox", label: "Reads email inbox", emoji: "📥", legs: ["private", "untrusted"], risk: 16, threats: ["LLM01 Indirect prompt injection", "LLM02 Sensitive info disclosure"] },
  { id: "web", label: "Web browsing / search", emoji: "🌐", legs: ["untrusted"], risk: 12, threats: ["LLM01 Indirect prompt injection", "ASI01 Agent goal hijack"] },
  { id: "rag", label: "RAG over user uploads", emoji: "📚", legs: ["untrusted"], risk: 10, threats: ["LLM08 Vector & embedding weaknesses", "LLM04 Data poisoning"] },
  { id: "memory", label: "Long-term memory", emoji: "🧠", legs: [], risk: 10, threats: ["ASI06 Memory & context poisoning"] },
  { id: "email", label: "Send email", emoji: "📤", legs: ["external"], risk: 14, threats: ["Data exfiltration", "ASI09 Human-agent trust exploitation"] },
  { id: "http", label: "Arbitrary HTTP requests", emoji: "🛰️", legs: ["external"], risk: 16, threats: ["Exfiltration", "SSRF", "LLM06 Excessive agency"] },
  { id: "code", label: "Code execution", emoji: "💻", legs: ["external"], risk: 18, threats: ["ASI05 Unexpected code execution", "LLM05 Improper output handling"] },
  { id: "payments", label: "Payments / refunds", emoji: "💳", legs: ["external"], risk: 18, threats: ["LLM06 Excessive agency", "Financial fraud"] },
  { id: "mcp", label: "Third-party MCP servers", emoji: "🧩", legs: ["untrusted"], risk: 14, threats: ["LLM03 Supply chain", "Tool poisoning / rug pull"] },
  { id: "multi", label: "Delegates to other agents", emoji: "🕸️", legs: [], risk: 12, threats: ["ASI07 Insecure inter-agent comms", "ASI08 Cascading failures", "ASI10 Rogue agents"] },
];

const CONTROLS = [
  { id: "identity", label: "Scoped, short-lived agent identity", hint: "Per-agent tokens, RFC 8693 delegation, 5-min expiry", cut: 0.12 },
  { id: "policy", label: "Policy engine on every tool call", hint: "OPA/Cedar PDP, deny-overrides", cut: 0.18 },
  { id: "hitl", label: "Human approval for external / high-impact", hint: "LangGraph interrupt() gates", cut: 0.2 },
  { id: "guards", label: "Input / output guardrails", hint: "Injection classifier, PII & secret redaction, exfil stripping", cut: 0.12 },
  { id: "sandbox", label: "Sandboxing & egress allowlist", hint: "Containers, no open internet", cut: 0.14 },
  { id: "taint", label: "Taint tracking (Rule of Two at runtime)", hint: "Block external sends after untrusted content", cut: 0.16 },
  { id: "audit", label: "Tamper-evident audit + alerting", hint: "Detect & respond; doesn't prevent", cut: 0.06 },
];

export function ThreatModelLab({ accent }: { gradient: string; accent: string }) {
  const { completeLab, askAssistant } = useApp();
  const [sel, setSel] = useState<string[]>(["crm", "web", "email"]);
  const [ctl, setCtl] = useState<string[]>([]);

  const chosen = COMPONENTS.filter((c) => sel.includes(c.id));
  const legs = useMemo(() => new Set(chosen.flatMap((c) => c.legs)), [chosen]);
  const trifecta = legs.size === 3;
  const base = chosen.reduce((a, c) => a + c.risk, 0) * (trifecta ? 1.5 : 1);
  const reduction = CONTROLS.filter((c) => ctl.includes(c.id)).reduce((a, c) => a * (1 - c.cut), 1);
  const risk = Math.min(100, Math.round(base * reduction));
  const riskColor = risk >= 60 ? "#f43f5e" : risk >= 35 ? "#f59e0b" : "#22c55e";
  const threats = Array.from(new Set(chosen.flatMap((c) => c.threats)));

  useEffect(() => {
    if (trifecta && ctl.includes("hitl") && ctl.includes("taint") && risk < 35) completeLab("threat-model");
  }, [trifecta, ctl, risk, completeLab]);

  const toggle = (arr: string[], set: (v: string[]) => void, id: string) => set(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300">
        🎯 <b>Goal:</b> build an agent that has the full Lethal Trifecta, then add controls until residual risk drops below <b>35</b> — using at least human approval and taint tracking.
      </p>

      <div className="grid gap-4 md:grid-cols-2">
        <Card title="1 · Agent components">
          <div className="grid gap-1.5">
            {COMPONENTS.map((c) => (
              <button
                key={c.id}
                onClick={() => toggle(sel, setSel, c.id)}
                className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-left text-sm transition ${sel.includes(c.id) ? "border-white/30 bg-white/10" : "border-white/5 hover:bg-white/5"}`}
              >
                <span>{c.emoji}</span>
                <span className="flex-1">{c.label}</span>
                {c.legs.map((l) => (
                  <span key={l} title={l} className="text-xs">
                    {l === "private" ? "🔐" : l === "untrusted" ? "☣️" : "📤"}
                  </span>
                ))}
              </button>
            ))}
          </div>
        </Card>

        <div className="space-y-4">
          <Card title="Lethal Trifecta">
            <div className="grid grid-cols-3 gap-2 text-center">
              {([
                ["private", "🔐", "Private data"],
                ["untrusted", "☣️", "Untrusted input"],
                ["external", "📤", "External comms"],
              ] as const).map(([l, e, t]) => (
                <div key={l} className={`rounded-xl p-2 transition ${legs.has(l) ? "bg-rose-500/25 ring-1 ring-rose-400/60" : "bg-white/5 opacity-50"}`}>
                  <div className="text-2xl">{e}</div>
                  <div className="text-[11px] font-semibold">{t}</div>
                </div>
              ))}
            </div>
            {trifecta && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-rose-300">
                <AlertTriangle size={14} /> All three legs present — exfiltration by injected text is possible!
              </p>
            )}
          </Card>

          <Card title="Residual risk">
            <div className="flex items-end gap-3">
              <span className="text-5xl font-black" style={{ color: riskColor }}>
                {risk}
              </span>
              <span className="pb-2 text-xs text-slate-400">/ 100 · inherent {Math.min(100, Math.round(base))}</span>
            </div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full transition-all" style={{ width: `${risk}%`, background: riskColor }} />
            </div>
          </Card>
        </div>
      </div>

      <Card title="2 · Controls">
        <div className="grid gap-2 md:grid-cols-2">
          {CONTROLS.map((c) => (
            <Toggle key={c.id} on={ctl.includes(c.id)} onChange={() => toggle(ctl, setCtl, c.id)} label={c.label} hint={`${c.hint} · −${Math.round(c.cut * 100)}%`} color={accent} />
          ))}
        </div>
      </Card>

      <Card
        title="3 · Threats in scope"
        right={
          <button
            onClick={() =>
              askAssistant(
                `Threat-model my agent. Components: ${chosen.map((c) => c.label).join(", ")}. Controls in place: ${CONTROLS.filter((c) => ctl.includes(c.id)).map((c) => c.label).join(", ") || "none"}. Use STRIDE + OWASP Agentic Top 10. Give a table: threat, attack path, existing control, gap, recommended fix.`,
              )
            }
            className="flex items-center gap-1 rounded-lg bg-violet-500/20 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/30"
          >
            <Sparkles size={12} /> AI threat model
          </button>
        }
      >
        <div className="flex flex-wrap gap-1.5">
          {threats.length ? threats.map((t) => <Badge key={t}>{t}</Badge>) : <span className="text-xs text-slate-500">Select components…</span>}
        </div>
      </Card>
    </div>
  );
}
