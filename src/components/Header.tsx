"use client";

import { Bot, KeyRound, ShieldCheck, Trophy } from "lucide-react";
import { MAX_XP, useApp } from "@/lib/store";
import { MODULES } from "@/lib/curriculum";

export function Header() {
  const { apiKey, setKeyDialogOpen, xp, setAssistantOpen, progress, model } = useApp();
  const pct = Math.min(100, Math.round((xp / MAX_XP) * 100));
  const badges = MODULES.filter((m) => progress.labs.includes(m.lab.id) && (progress.quiz[m.id] ?? 0) >= m.quiz.length - 1);

  return (
    <header className="sticky top-0 z-30 glass border-x-0 border-t-0">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-pink-500 via-violet-500 to-sky-500 shadow-lg shadow-fuchsia-500/30">
            <ShieldCheck className="text-white" size={22} />
          </div>
          <div>
            <h1 className="text-lg font-extrabold leading-tight sm:text-xl">
              <span className="shimmer">Securing Agentic AI</span>
            </h1>
            <p className="text-[11px] text-slate-400 sm:text-xs">Identity · Permissions · Runtime Guardrails</p>
          </div>
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <div className="hidden items-center gap-2 rounded-xl bg-white/5 px-3 py-1.5 sm:flex" title={`${xp} / ${MAX_XP} XP`}>
            <Trophy size={16} className="text-amber-400" />
            <div className="w-28">
              <div className="flex justify-between text-[10px] text-slate-400">
                <span>{xp} XP</span>
                <span>{pct}%</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-gradient-to-r from-amber-400 via-pink-500 to-violet-500 transition-all" style={{ width: `${pct}%` }} />
              </div>
            </div>
            <div className="flex -space-x-1">
              {badges.map((b) => (
                <span key={b.id} title={`Mastered: ${b.title}`} className="text-base">
                  {b.emoji}
                </span>
              ))}
            </div>
          </div>

          <button
            onClick={() => setKeyDialogOpen(true)}
            className={`flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition ${
              apiKey ? "bg-emerald-500/15 text-emerald-300 hover:bg-emerald-500/25" : "pulse-ring bg-pink-500 text-white hover:bg-pink-400"
            }`}
          >
            <KeyRound size={16} />
            {apiKey ? <span className="max-w-[9rem] truncate">{model}</span> : "Add Groq key"}
          </button>
          <button
            onClick={() => setAssistantOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-500 to-sky-500 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-violet-500/20 hover:brightness-110"
          >
            <Bot size={16} /> AI Tutor
          </button>
        </div>
      </div>
    </header>
  );
}
