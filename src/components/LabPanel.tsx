"use client";

import { CheckCircle2, Cpu, FlaskConical, Sparkles } from "lucide-react";
import { getModule, type LabId } from "@/lib/curriculum";
import { useApp } from "@/lib/store";
import { ThreatModelLab } from "./labs/ThreatModelLab";
import { TokenLab } from "./labs/TokenLab";
import { PolicyLab } from "./labs/PolicyLab";
import { GuardrailLab } from "./labs/GuardrailLab";
import { RedTeamLab } from "./labs/RedTeamLab";
import { SandboxLab } from "./labs/SandboxLab";
import { AuditLab } from "./labs/AuditLab";
import { MaturityLab } from "./labs/MaturityLab";

const LABS: Record<LabId, React.ComponentType<{ gradient: string; accent: string }>> = {
  "threat-model": ThreatModelLab,
  "token-lab": TokenLab,
  "policy-playground": PolicyLab,
  "guardrail-pipeline": GuardrailLab,
  "redteam-arena": RedTeamLab,
  "agent-sandbox": SandboxLab,
  "audit-forensics": AuditLab,
  maturity: MaturityLab,
};

export function LabPanel() {
  const { moduleId, progress, askAssistant } = useApp();
  const mod = getModule(moduleId);
  const Lab = LABS[mod.lab.id];
  const done = progress.labs.includes(mod.lab.id);

  return (
    <div className="glass overflow-hidden rounded-3xl">
      <div className="flex flex-wrap items-start gap-3 border-b border-white/10 p-5">
        <div className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br ${mod.gradient} shadow-lg`}>
          <FlaskConical className="text-white" size={22} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
            Hands-on Lab · Module {mod.num}
            {mod.lab.usesAI && (
              <span className="flex items-center gap-1 rounded-full bg-violet-500/20 px-2 py-0.5 text-[10px] text-violet-200">
                <Cpu size={10} /> LangGraph + Groq
              </span>
            )}
            {done && (
              <span className="flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] text-emerald-300">
                <CheckCircle2 size={10} /> Completed +50 XP
              </span>
            )}
          </div>
          <h2 className="text-xl font-extrabold text-white">{mod.lab.title}</h2>
          <p className="text-sm text-slate-400">{mod.lab.summary}</p>
        </div>
        <button
          onClick={() => askAssistant(`I'm doing the "${mod.lab.title}" lab. Give me 3 progressively harder challenges to try in it, and what I should learn from each.`)}
          className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/30"
        >
          <Sparkles size={14} /> Coach me
        </button>
      </div>
      <div className="p-5">
        <Lab key={mod.id} gradient={mod.gradient} accent={mod.accent} />
      </div>
    </div>
  );
}
