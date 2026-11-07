"use client";

import { useState } from "react";
import { CheckCircle2, RotateCcw, XCircle } from "lucide-react";
import type { Module } from "@/lib/curriculum";
import { useApp } from "@/lib/store";

export function Quiz({ mod }: { mod: Module }) {
  const { setQuiz, progress, askAssistant } = useApp();
  const [answers, setAnswers] = useState<(number | null)[]>(() => mod.quiz.map(() => null));
  const [submitted, setSubmitted] = useState(false);
  const score = answers.filter((a, i) => a === mod.quiz[i].answer).length;
  const best = progress.quiz[mod.id];

  const submit = () => {
    setSubmitted(true);
    setQuiz(mod.id, score);
  };

  return (
    <div className="space-y-4">
      {best !== undefined && (
        <p className="text-xs text-slate-400">
          Best score: <b className="text-slate-200">{best}/{mod.quiz.length}</b>
        </p>
      )}
      {mod.quiz.map((q, qi) => (
        <div key={qi} className="rounded-xl bg-white/[0.03] p-4">
          <p className="mb-3 font-medium text-slate-100">
            {qi + 1}. {q.q}
          </p>
          <div className="grid gap-2">
            {q.options.map((o, oi) => {
              const chosen = answers[qi] === oi;
              const correct = submitted && oi === q.answer;
              const wrong = submitted && chosen && oi !== q.answer;
              return (
                <button
                  key={oi}
                  disabled={submitted}
                  onClick={() => setAnswers((a) => a.map((x, i) => (i === qi ? oi : x)))}
                  className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-left text-sm transition ${
                    correct
                      ? "border-emerald-400/60 bg-emerald-500/15 text-emerald-100"
                      : wrong
                        ? "border-rose-400/60 bg-rose-500/15 text-rose-100"
                        : chosen
                          ? "border-violet-400/60 bg-violet-500/15"
                          : "border-white/10 hover:bg-white/5"
                  }`}
                >
                  {correct ? <CheckCircle2 size={16} /> : wrong ? <XCircle size={16} /> : <span className="h-4 w-4 rounded-full border border-current opacity-50" />}
                  {o}
                </button>
              );
            })}
          </div>
          {submitted && <p className="mt-2 text-xs text-slate-400">💡 {q.why}</p>}
        </div>
      ))}
      <div className="flex flex-wrap items-center gap-3">
        {!submitted ? (
          <button
            disabled={answers.some((a) => a === null)}
            onClick={submit}
            className={`rounded-xl bg-gradient-to-r ${mod.gradient} px-4 py-2 text-sm font-bold text-white disabled:opacity-40`}
          >
            Submit answers
          </button>
        ) : (
          <>
            <span className="text-lg font-bold">
              {score === mod.quiz.length ? "🏆 Perfect!" : score >= mod.quiz.length - 1 ? "🎉 Great job!" : "📚 Keep going!"} {score}/{mod.quiz.length}
            </span>
            <button
              onClick={() => {
                setAnswers(mod.quiz.map(() => null));
                setSubmitted(false);
              }}
              className="flex items-center gap-1 rounded-lg bg-white/10 px-3 py-1.5 text-sm hover:bg-white/15"
            >
              <RotateCcw size={14} /> Retry
            </button>
            <button
              onClick={() => askAssistant(`Quiz me with 3 harder, scenario-based questions on "${mod.title}". Ask one at a time and wait for my answer.`)}
              className="rounded-lg bg-violet-500/20 px-3 py-1.5 text-sm text-violet-200 hover:bg-violet-500/30"
            >
              🤖 Harder AI quiz
            </button>
          </>
        )}
      </div>
    </div>
  );
}
