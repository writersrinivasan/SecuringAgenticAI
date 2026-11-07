"use client";

import { useState } from "react";
import { Eye, EyeOff, KeyRound, Loader2, ShieldCheck, Trash2, X } from "lucide-react";
import { useApp } from "@/lib/store";
import { postJson } from "@/lib/client";

export function KeyDialog() {
  const { keyDialogOpen } = useApp();
  return keyDialogOpen ? <KeyDialogInner /> : null;
}

function KeyDialogInner() {
  const { setKeyDialogOpen, apiKey, setKey, clearKey, model, setModel, models, setModels, remember } = useApp();
  const [draft, setDraft] = useState("");
  const [rem, setRem] = useState(remember);
  const [show, setShow] = useState(false);
  const [status, setStatus] = useState<{ kind: "idle" | "loading" | "ok" | "err"; msg?: string }>({ kind: "idle" });

  const verify = async () => {
    const k = (draft || apiKey).trim();
    setStatus({ kind: "loading" });
    try {
      const r = await postJson<{ models: string[] }>("/api/models", {}, { apiKey: k, model });
      setModels(r.models);
      setKey(k, rem);
      setDraft("");
      if (!r.models.includes(model) && r.models.length) setModel(r.models.includes("llama-3.3-70b-versatile") ? "llama-3.3-70b-versatile" : r.models[0]);
      setStatus({ kind: "ok", msg: `Key verified · ${r.models.length} models available` });
    } catch (e) {
      setStatus({ kind: "err", msg: (e as Error).message });
    }
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/60 p-4 backdrop-blur-sm" onClick={() => setKeyDialogOpen(false)}>
      <div className="glass w-full max-w-md rounded-3xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <KeyRound className="text-pink-400" /> Bring Your Own Groq Key
          </h2>
          <button onClick={() => setKeyDialogOpen(false)} className="rounded-lg p-1 hover:bg-white/10" aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <p className="mb-3 text-sm text-slate-400">
          Get a free key at{" "}
          <a className="text-sky-300 underline" href="https://console.groq.com/keys" target="_blank" rel="noopener noreferrer">
            console.groq.com/keys
          </a>
          . It powers the AI Tutor and the live labs.
        </p>

        <div className="relative">
          <input
            type={show ? "text" : "password"}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder={apiKey ? `Current: gsk_••••${apiKey.slice(-4)}` : "gsk_..."}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2.5 pr-10 font-mono text-sm outline-none focus:border-pink-400"
          />
          <button onClick={() => setShow(!show)} className="absolute right-2 top-2 p-1 text-slate-400" aria-label="Toggle visibility">
            {show ? <EyeOff size={16} /> : <Eye size={16} />}
          </button>
        </div>

        <label className="mt-3 flex items-center gap-2 text-sm text-slate-300">
          <input type="checkbox" checked={rem} onChange={(e) => setRem(e.target.checked)} className="accent-pink-500" />
          Remember on this device (localStorage). Off = this tab session only.
        </label>

        {models.length > 0 && (
          <label className="mt-4 block text-sm">
            <span className="text-slate-400">Model</span>
            <select value={model} onChange={(e) => setModel(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-black/40 px-3 py-2 text-sm">
              {models.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        )}

        {status.kind !== "idle" && (
          <p className={`mt-3 text-sm ${status.kind === "err" ? "text-rose-300" : status.kind === "ok" ? "text-emerald-300" : "text-slate-400"}`}>
            {status.kind === "loading" ? "Verifying…" : status.msg}
          </p>
        )}

        <div className="mt-5 flex gap-2">
          <button
            onClick={verify}
            disabled={!draft && !apiKey}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 py-2.5 text-sm font-bold text-white disabled:opacity-40"
          >
            {status.kind === "loading" ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
            {draft ? "Verify & save" : "Re-verify / load models"}
          </button>
          {apiKey && (
            <button
              onClick={() => {
                clearKey();
                setStatus({ kind: "idle" });
              }}
              className="flex items-center gap-1 rounded-xl bg-rose-500/15 px-3 text-sm text-rose-300 hover:bg-rose-500/25"
            >
              <Trash2 size={14} /> Forget
            </button>
          )}
        </div>

        <div className="mt-5 rounded-xl bg-emerald-500/10 p-3 text-xs leading-relaxed text-emerald-200/90">
          <b>🔐 How your key is handled (a mini-lesson in itself):</b> stored only in your browser · sent over HTTPS in an <code>x-groq-key</code> header to this
          app&apos;s own API routes · used for that single request · never logged, never placed in LangGraph state or checkpoints · scrubbed from error messages.
        </div>
      </div>
    </div>
  );
}
