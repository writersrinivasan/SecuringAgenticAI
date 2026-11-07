"use client";

import { useState } from "react";
import { BookOpen, FlaskConical } from "lucide-react";
import { AppProvider, useApp } from "@/lib/store";
import { getModule } from "@/lib/curriculum";
import { Header } from "./Header";
import { ModuleRail } from "./ModuleRail";
import { LearningHub } from "./LearningHub";
import { LabPanel } from "./LabPanel";
import { Assistant } from "./Assistant";
import { KeyDialog } from "./KeyDialog";

function Shell() {
  const { moduleId } = useApp();
  const mod = getModule(moduleId);
  const [mobileTab, setMobileTab] = useState<"learn" | "lab">("learn");

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <ModuleRail />

      {/* Mobile switcher */}
      <div className="mx-4 mt-3 grid grid-cols-2 gap-1 rounded-xl glass p-1 lg:hidden">
        {(["learn", "lab"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setMobileTab(t)}
            className={`flex items-center justify-center gap-2 rounded-lg py-2 text-sm font-semibold transition ${
              mobileTab === t ? `bg-gradient-to-r ${mod.gradient} text-white` : "text-slate-400"
            }`}
          >
            {t === "learn" ? <BookOpen size={16} /> : <FlaskConical size={16} />}
            {t === "learn" ? "Learning Hub" : "Hands-on Lab"}
          </button>
        ))}
      </div>

      <main className="mx-auto grid w-full max-w-[1600px] flex-1 gap-4 p-4 lg:grid-cols-2">
        <section className={`${mobileTab === "learn" ? "block" : "hidden"} lg:block`}>
          <LearningHub />
        </section>
        <section className={`${mobileTab === "lab" ? "block" : "hidden"} lg:block`}>
          <LabPanel />
        </section>
      </main>

      <footer className="px-4 pb-6 text-center text-xs text-slate-500">
        Built with Next.js · LangGraph.js · Groq (BYOK). Your key stays in your browser and is sent only to this app&apos;s API routes, per request.
      </footer>

      <Assistant />
      <KeyDialog />
    </div>
  );
}

export function AppShell() {
  return (
    <AppProvider>
      <Shell />
    </AppProvider>
  );
}
