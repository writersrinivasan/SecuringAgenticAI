"use client";

import { CheckCircle2 } from "lucide-react";
import { MODULES } from "@/lib/curriculum";
import { useApp } from "@/lib/store";

export function ModuleRail() {
  const { moduleId, setModuleId, progress } = useApp();
  return (
    <nav className="scroll-thin mx-auto w-full max-w-[1600px] overflow-x-auto px-4 pt-4">
      <ol className="flex gap-2 pb-1">
        {MODULES.map((m) => {
          const active = m.id === moduleId;
          const lessonsDone = m.lessons.filter((l) => progress.lessons.includes(`${m.id}:${l.id}`)).length;
          const done = lessonsDone === m.lessons.length && progress.labs.includes(m.lab.id);
          return (
            <li key={m.id} className="shrink-0">
              <button
                onClick={() => setModuleId(m.id)}
                className={`group relative flex w-52 items-center gap-3 overflow-hidden rounded-2xl p-3 text-left transition ${
                  active ? `bg-gradient-to-br ${m.gradient} text-white shadow-lg` : "glass text-slate-300 hover:bg-white/5"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl text-xl ${active ? "bg-white/20" : "bg-white/5"}`}>{m.emoji}</span>
                <span className="min-w-0">
                  <span className={`block text-[10px] font-bold uppercase tracking-wider ${active ? "text-white/80" : "text-slate-500"}`}>
                    Module {m.num} · {lessonsDone}/{m.lessons.length}
                  </span>
                  <span className="block truncate text-sm font-semibold">{m.title}</span>
                </span>
                {done && <CheckCircle2 size={16} className="absolute right-2 top-2 text-emerald-300" />}
              </button>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
