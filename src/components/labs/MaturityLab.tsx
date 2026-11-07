"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { useApp } from "@/lib/store";
import { Card, GradientButton } from "./ui";

const DOMAINS = [
  { id: "inventory", label: "Agent inventory", levels: ["Unknown", "Spreadsheet", "Registry", "Registry + risk tiers", "Automated discovery"] },
  { id: "identity", label: "Agent identity", levels: ["Shared keys", "Per-agent keys", "OAuth clients", "Short-lived + delegation", "Attested workload ID + PoP"] },
  { id: "authz", label: "Authorization", levels: ["Full access", "Coarse roles", "Tool allowlists", "Policy engine (ABAC)", "Taint-aware, user-bound"] },
  { id: "guardrails", label: "Runtime guardrails", levels: ["None", "Prompt rules", "Input/output filters", "Layered + judges", "Measured & tuned"] },
  { id: "hitl", label: "Human oversight", levels: ["None", "Ad-hoc", "Approvals on writes", "Risk-based approvals", "Approval UX + metrics"] },
  { id: "observability", label: "Observability & audit", levels: ["None", "App logs", "Structured traces", "Tamper-evident + SIEM", "Anomaly detection + IR"] },
  { id: "testing", label: "Adversarial testing", levels: ["None", "Manual pokes", "Pre-launch red team", "Evals in CI", "Continuous red teaming"] },
  { id: "governance", label: "Governance", levels: ["None", "Policy doc", "Review board", "Mapped to NIST/ISO", "Audited program"] },
];

function Radar({ values, color }: { values: number[]; color: string }) {
  const size = 260;
  const c = size / 2;
  const r = 100;
  const n = values.length;
  const pt = (i: number, v: number) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return [c + Math.cos(a) * r * (v / 4), c + Math.sin(a) * r * (v / 4)];
  };
  return (
    <svg viewBox={`0 0 ${size} ${size}`} className="mx-auto w-full max-w-[300px]">
      {[1, 2, 3, 4].map((l) => (
        <polygon key={l} points={values.map((_, i) => pt(i, l).join(",")).join(" ")} fill="none" stroke="rgba(148,163,184,.18)" />
      ))}
      {values.map((_, i) => {
        const [x, y] = pt(i, 4);
        return <line key={i} x1={c} y1={c} x2={x} y2={y} stroke="rgba(148,163,184,.12)" />;
      })}
      <polygon points={values.map((v, i) => pt(i, Math.max(v, 0.15)).join(",")).join(" ")} fill={`${color}55`} stroke={color} strokeWidth={2} />
      {DOMAINS.map((d, i) => {
        const [x, y] = pt(i, 5);
        return (
          <text key={d.id} x={x} y={y} fill="#94a3b8" fontSize="9" textAnchor="middle" dominantBaseline="middle">
            {d.label.split(" ")[0]}
          </text>
        );
      })}
    </svg>
  );
}

export function MaturityLab({ gradient, accent }: { gradient: string; accent: string }) {
  const { askAssistant, completeLab } = useApp();
  const [scores, setScores] = useState<number[]>(() => DOMAINS.map(() => 1));
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  const tier = avg < 1 ? "Initial" : avg < 2 ? "Developing" : avg < 3 ? "Defined" : avg < 3.6 ? "Managed" : "Optimised";
  const weakest = DOMAINS.map((d, i) => ({ d, s: scores[i] })).sort((a, b) => a.s - b.s).slice(0, 3);

  const roadmap = () => {
    completeLab("maturity");
    askAssistant(
      `Act as an agentic-AI security advisor. Our maturity scores (0-4): ${DOMAINS.map((d, i) => `${d.label}=${scores[i]} (${d.levels[scores[i]]})`).join("; ")}. Overall: ${tier}.
Create a prioritised 30/60/90-day roadmap focused on the weakest areas, with concrete controls, owners, success metrics, and mapping to NIST AI RMF functions and OWASP Agentic Top 10.`,
    );
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300">
        🎯 <b>Goal:</b> honestly score your organisation (or a project) on 8 domains, then generate an AI roadmap.
      </p>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <Card title="Self-assessment">
          <div className="space-y-3">
            {DOMAINS.map((d, i) => (
              <div key={d.id}>
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-slate-200">{d.label}</span>
                  <span style={{ color: accent }}>
                    L{scores[i]} · {d.levels[scores[i]]}
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={4}
                  value={scores[i]}
                  onChange={(e) => setScores(scores.map((s, j) => (j === i ? Number(e.target.value) : s)))}
                  className="w-full accent-pink-500"
                />
              </div>
            ))}
          </div>
        </Card>
        <div className="space-y-4">
          <Card>
            <Radar values={scores} color={accent} />
            <p className="text-center text-sm">
              Overall: <b style={{ color: accent }}>{tier}</b> ({avg.toFixed(1)} / 4)
            </p>
          </Card>
          <Card title="Focus first">
            <ul className="space-y-1 text-xs text-slate-300">
              {weakest.map((w) => (
                <li key={w.d.id}>
                  ⚠️ {w.d.label}: next → <b>{w.d.levels[Math.min(4, w.s + 1)]}</b>
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
      <GradientButton gradient={gradient} onClick={roadmap} className="w-full">
        <Sparkles size={16} /> Generate my 30/60/90-day roadmap with AI
      </GradientButton>
    </div>
  );
}
