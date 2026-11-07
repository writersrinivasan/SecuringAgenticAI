"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { MODULES, type LabId } from "./curriculum";

type Progress = { lessons: string[]; quiz: Record<string, number>; labs: LabId[] };
const EMPTY: Progress = { lessons: [], quiz: {}, labs: [] };

type Ctx = {
  apiKey: string;
  model: string;
  remember: boolean;
  setKey: (k: string, remember: boolean) => void;
  clearKey: () => void;
  setModel: (m: string) => void;
  models: string[];
  setModels: (m: string[]) => void;
  moduleId: string;
  setModuleId: (id: string) => void;
  progress: Progress;
  markLesson: (id: string) => void;
  setQuiz: (moduleId: string, score: number) => void;
  completeLab: (id: LabId) => void;
  resetProgress: () => void;
  xp: number;
  assistantOpen: boolean;
  setAssistantOpen: (o: boolean) => void;
  askAssistant: (prompt: string) => void;
  pendingAsk: string | null;
  consumeAsk: () => void;
  keyDialogOpen: boolean;
  setKeyDialogOpen: (o: boolean) => void;
  sharedPolicy: string | null;
  setSharedPolicy: (p: string | null) => void;
};

const AppCtx = createContext<Ctx | null>(null);

const safeGet = (s: Storage | undefined, k: string) => {
  try {
    return s?.getItem(k) ?? null;
  } catch {
    return null;
  }
};
const safeSet = (s: Storage | undefined, k: string, v: string | null) => {
  try {
    if (v === null) s?.removeItem(k);
    else s?.setItem(k, v);
  } catch {
    /* storage unavailable */
  }
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [apiKey, setApiKey] = useState("");
  const [remember, setRemember] = useState(false);
  const [model, setModelState] = useState("llama-3.3-70b-versatile");
  const [models, setModels] = useState<string[]>([]);
  const [moduleId, setModuleIdState] = useState(MODULES[0].id);
  const [progress, setProgress] = useState<Progress>(EMPTY);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [pendingAsk, setPendingAsk] = useState<string | null>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [sharedPolicy, setSharedPolicy] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from browser storage (client only)
  useEffect(() => {
    const ss = typeof window !== "undefined" ? window.sessionStorage : undefined;
    const ls = typeof window !== "undefined" ? window.localStorage : undefined;
    const lk = safeGet(ls, "saai.key");
    const sk = safeGet(ss, "saai.key");
    /* eslint-disable react-hooks/set-state-in-effect */
    if (lk) {
      setApiKey(lk);
      setRemember(true);
    } else if (sk) setApiKey(sk);
    const m = safeGet(ls, "saai.model");
    if (m) setModelState(m);
    const mod = safeGet(ls, "saai.module");
    if (mod && MODULES.some((x) => x.id === mod)) setModuleIdState(mod);
    try {
      const p = JSON.parse(safeGet(ls, "saai.progress") ?? "null");
      if (p && Array.isArray(p.lessons)) setProgress({ ...EMPTY, ...p });
    } catch {
      /* ignore */
    }
    setHydrated(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, []);

  useEffect(() => {
    if (hydrated) safeSet(window.localStorage, "saai.progress", JSON.stringify(progress));
  }, [progress, hydrated]);

  const setKey = useCallback((k: string, rem: boolean) => {
    setApiKey(k);
    setRemember(rem);
    safeSet(window.sessionStorage, "saai.key", rem ? null : k);
    safeSet(window.localStorage, "saai.key", rem ? k : null);
  }, []);
  const clearKey = useCallback(() => {
    setApiKey("");
    setModels([]);
    safeSet(window.sessionStorage, "saai.key", null);
    safeSet(window.localStorage, "saai.key", null);
  }, []);
  const setModel = useCallback((m: string) => {
    setModelState(m);
    safeSet(window.localStorage, "saai.model", m);
  }, []);
  const setModuleId = useCallback((id: string) => {
    setModuleIdState(id);
    safeSet(window.localStorage, "saai.module", id);
  }, []);

  const markLesson = useCallback((id: string) => setProgress((p) => (p.lessons.includes(id) ? p : { ...p, lessons: [...p.lessons, id] })), []);
  const setQuiz = useCallback((mid: string, score: number) => setProgress((p) => ({ ...p, quiz: { ...p.quiz, [mid]: Math.max(score, p.quiz[mid] ?? 0) } })), []);
  const completeLab = useCallback((id: LabId) => setProgress((p) => (p.labs.includes(id) ? p : { ...p, labs: [...p.labs, id] })), []);
  const resetProgress = useCallback(() => setProgress(EMPTY), []);

  const askAssistant = useCallback((prompt: string) => {
    setPendingAsk(prompt);
    setAssistantOpen(true);
  }, []);

  const xp = useMemo(() => {
    const quizXp = Object.entries(progress.quiz).reduce((a, [mid, s]) => {
      const total = MODULES.find((m) => m.id === mid)?.quiz.length ?? 1;
      return a + Math.round((s / total) * 30);
    }, 0);
    return progress.lessons.length * 10 + quizXp + progress.labs.length * 50;
  }, [progress]);

  const value: Ctx = {
    apiKey, model, remember, setKey, clearKey, setModel, models, setModels,
    moduleId, setModuleId, progress, markLesson, setQuiz, completeLab, resetProgress, xp,
    assistantOpen, setAssistantOpen, askAssistant, pendingAsk, consumeAsk: () => setPendingAsk(null),
    keyDialogOpen, setKeyDialogOpen, sharedPolicy, setSharedPolicy,
  };
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}

export function useApp() {
  const c = useContext(AppCtx);
  if (!c) throw new Error("useApp outside provider");
  return c;
}

export const MAX_XP = MODULES.reduce((a, m) => a + m.lessons.length * 10 + 30 + 50, 0);
