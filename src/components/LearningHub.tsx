"use client";

import { useState } from "react";
import { BookOpen, Check, ChevronLeft, ChevronRight, Clock, ExternalLink, GraduationCap, Library, ListChecks, Sparkles } from "lucide-react";
import { getModule, MODULES } from "@/lib/curriculum";
import { useApp } from "@/lib/store";
import { Markdown } from "./Markdown";
import { Quiz } from "./Quiz";

type Tab = "lessons" | "quiz" | "resources";

export function LearningHub() {
  const { moduleId, setModuleId, progress, markLesson, askAssistant } = useApp();
  const mod = getModule(moduleId);
  const [tab, setTab] = useState<Tab>("lessons");
  const [lessonIdx, setLessonIdx] = useState(0);
  const [prevModule, setPrevModule] = useState(moduleId);
  if (prevModule !== moduleId) {
    setPrevModule(moduleId);
    setLessonIdx(0);
    setTab("lessons");
  }
  const lesson = mod.lessons[Math.min(lessonIdx, mod.lessons.length - 1)];
  const key = `${mod.id}:${lesson.id}`;
  const read = progress.lessons.includes(key);
  const modIdx = MODULES.findIndex((m) => m.id === mod.id);

  return (
    <div className="glass flex h-full flex-col overflow-hidden rounded-3xl lg:sticky lg:top-[84px] lg:max-h-[calc(100vh-100px)]">
      {/* Hero */}
      <div className={`relative bg-gradient-to-br ${mod.gradient} p-5`}>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.25),transparent_50%)]" />
        <div className="relative">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-white/80">
            <GraduationCap size={14} /> Learning Hub · Module {mod.num}
          </div>
          <h2 className="mt-1 text-2xl font-extrabold text-white">
            {mod.emoji} {mod.title}
          </h2>
          <p className="text-sm text-white/85">{mod.tagline}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10 px-3 pt-2">
        {([
          ["lessons", "Lessons", BookOpen],
          ["quiz", "Quiz", ListChecks],
          ["resources", "Deep dive", Library],
        ] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => setTab(id)}
            className={`flex items-center gap-1.5 rounded-t-lg px-3 py-2 text-sm font-semibold transition ${
              tab === id ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      <div className="scroll-thin flex-1 overflow-y-auto p-5">
        {tab === "lessons" && (
          <>
            <div className="mb-4 flex flex-wrap gap-2">
              {mod.lessons.map((l, i) => {
                const done = progress.lessons.includes(`${mod.id}:${l.id}`);
                return (
                  <button
                    key={l.id}
                    onClick={() => setLessonIdx(i)}
                    className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
                      i === lessonIdx ? "bg-white text-slate-900" : "bg-white/5 text-slate-300 hover:bg-white/10"
                    }`}
                  >
                    {done ? <Check size={12} className="text-emerald-500" /> : <span>{i + 1}.</span>} {l.title}
                  </button>
                );
              })}
            </div>

            <article>
              <div className="mb-1 flex items-center gap-3 text-xs text-slate-400">
                <span className="flex items-center gap-1">
                  <Clock size={12} /> {lesson.minutes} min
                </span>
                {read && <span className="text-emerald-400">✓ completed</span>}
              </div>
              <h3 className="text-xl font-bold text-white">{lesson.title}</h3>
              <Markdown>{lesson.body}</Markdown>
            </article>

            <div className="mt-5 flex flex-wrap gap-2">
              <button
                onClick={() => askAssistant(`Explain "${lesson.title}" (module: ${mod.title}) like I'm a developer new to security, with one concrete real-world incident-style example.`)}
                className="flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-1.5 text-xs font-semibold text-violet-200 hover:bg-violet-500/30"
              >
                <Sparkles size={14} /> Explain simpler
              </button>
              <button
                onClick={() => askAssistant(`Show me a minimal LangGraph.js (TypeScript) code example that implements the main control from "${lesson.title}".`)}
                className="flex items-center gap-1.5 rounded-lg bg-sky-500/20 px-3 py-1.5 text-xs font-semibold text-sky-200 hover:bg-sky-500/30"
              >
                <Sparkles size={14} /> Show me code
              </button>
              <button
                onClick={() => askAssistant(`From an attacker's perspective, how would I bypass the controls in "${lesson.title}"? Then explain how defenders detect and stop that.`)}
                className="flex items-center gap-1.5 rounded-lg bg-rose-500/20 px-3 py-1.5 text-xs font-semibold text-rose-200 hover:bg-rose-500/30"
              >
                <Sparkles size={14} /> Attacker&apos;s view
              </button>
            </div>

            <div className="mt-6 flex items-center justify-between gap-2 border-t border-white/10 pt-4">
              <button
                onClick={() => (lessonIdx > 0 ? setLessonIdx(lessonIdx - 1) : modIdx > 0 && setModuleId(MODULES[modIdx - 1].id))}
                className="flex items-center gap-1 rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-white/5"
              >
                <ChevronLeft size={16} /> Back
              </button>
              <button
                onClick={() => {
                  markLesson(key);
                  if (lessonIdx < mod.lessons.length - 1) setLessonIdx(lessonIdx + 1);
                  else setTab("quiz");
                }}
                className={`flex items-center gap-1 rounded-xl bg-gradient-to-r ${mod.gradient} px-4 py-2 text-sm font-bold text-white shadow-lg`}
              >
                {read ? "Next" : "Mark complete & continue"} <ChevronRight size={16} />
              </button>
            </div>

            <div className="mt-6 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
              <h4 className="mb-2 text-sm font-bold text-white">🎯 Key takeaways</h4>
              <ul className="space-y-1.5 text-sm text-slate-300">
                {mod.takeaways.map((t) => (
                  <li key={t} className="flex gap-2">
                    <span style={{ color: mod.accent }}>◆</span> {t}
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {tab === "quiz" && <Quiz key={mod.id} mod={mod} />}

        {tab === "resources" && (
          <div className="space-y-3">
            <p className="text-sm text-slate-400">Primary sources, specs and tools to go deeper on {mod.title}.</p>
            {mod.resources.map((r) => (
              <a
                key={r.url}
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-3 transition hover:border-white/25 hover:bg-white/[0.06]"
              >
                <span>
                  <span className="mb-0.5 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase" style={{ background: `${mod.accent}33`, color: mod.accent }}>
                    {r.kind}
                  </span>
                  <span className="block text-sm font-medium text-slate-100">{r.label}</span>
                </span>
                <ExternalLink size={16} className="shrink-0 text-slate-500" />
              </a>
            ))}
            <button
              onClick={() => askAssistant(`Build me a 2-week self-study plan to master "${mod.title}" using these resources: ${mod.resources.map((r) => r.label).join("; ")}.`)}
              className="mt-2 flex items-center gap-1.5 rounded-lg bg-violet-500/20 px-3 py-2 text-sm font-semibold text-violet-200 hover:bg-violet-500/30"
            >
              <Sparkles size={14} /> Generate a study plan
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
