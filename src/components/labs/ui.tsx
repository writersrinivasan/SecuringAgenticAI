"use client";

import type { ReactNode } from "react";

export function Toggle({ on, onChange, label, hint, color = "#a855f7" }: { on: boolean; onChange: (v: boolean) => void; label: string; hint?: string; color?: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!on)}
      className={`flex w-full items-start gap-3 rounded-xl border p-2.5 text-left transition ${on ? "border-white/25 bg-white/[0.07]" : "border-white/10 hover:bg-white/[0.04]"}`}
    >
      <span className="relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition" style={{ background: on ? color : "rgba(148,163,184,.25)" }}>
        <span className={`absolute top-0.5 h-4 w-4 rounded-full bg-white transition-all ${on ? "left-[18px]" : "left-0.5"}`} />
      </span>
      <span>
        <span className="block text-sm font-semibold text-slate-100">{label}</span>
        {hint && <span className="block text-xs text-slate-400">{hint}</span>}
      </span>
    </button>
  );
}

export function Card({ title, children, right, className = "" }: { title?: ReactNode; children: ReactNode; right?: ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl border border-white/10 bg-white/[0.03] p-4 ${className}`}>
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h4 className="text-sm font-bold text-white">{title}</h4>}
          {right}
        </div>
      )}
      {children}
    </div>
  );
}

const DECISION_STYLES: Record<string, string> = {
  ALLOW: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  EXECUTED: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  APPROVED: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  PASS: "bg-emerald-500/20 text-emerald-300 border-emerald-400/40",
  DENY: "bg-rose-500/20 text-rose-300 border-rose-400/40",
  BLOCKED: "bg-rose-500/20 text-rose-300 border-rose-400/40",
  REJECTED: "bg-rose-500/20 text-rose-300 border-rose-400/40",
  FAIL: "bg-rose-500/20 text-rose-300 border-rose-400/40",
  REQUIRE_APPROVAL: "bg-amber-500/20 text-amber-300 border-amber-400/40",
  WARN: "bg-amber-500/20 text-amber-300 border-amber-400/40",
};

export function Badge({ children, kind }: { children: ReactNode; kind?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${DECISION_STYLES[kind ?? ""] ?? "border-white/15 bg-white/10 text-slate-300"}`}>
      {children}
    </span>
  );
}

export function GradientButton({ children, onClick, disabled, gradient, className = "" }: { children: ReactNode; onClick?: () => void; disabled?: boolean; gradient: string; className?: string }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r ${gradient} px-4 py-2 text-sm font-bold text-white shadow-lg transition hover:brightness-110 disabled:opacity-40 ${className}`}
    >
      {children}
    </button>
  );
}

export function NeedKey({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} className="w-full rounded-xl border border-pink-400/40 bg-pink-500/10 p-3 text-sm text-pink-200 hover:bg-pink-500/20">
      🔑 This lab runs a live LangGraph agent on Groq. Add your API key to play.
    </button>
  );
}
