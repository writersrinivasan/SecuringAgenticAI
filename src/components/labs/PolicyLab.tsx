"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Send, XCircle } from "lucide-react";
import { DEFAULT_POLICY, evaluate, validatePolicy, type AuthzRequest, type Decision, type Policy } from "@/lib/policy";
import { useApp } from "@/lib/store";
import { Badge, Card, GradientButton } from "./ui";

const TOOLS = ["search_docs", "read_customer", "export_customers", "send_email", "issue_refund", "delete_records"];

type Test = { name: string; req: AuthzRequest; expect: Decision; challenge?: boolean };
const R = (role: string, tool: string, args: Record<string, unknown>, ctx: Record<string, unknown> = {}): AuthzRequest => ({
  principal: { id: "user:demo", role },
  actor: { id: "agent:support-ops" },
  tool,
  args,
  context: { tainted: false, toolCalls: 0, ...ctx },
});

const TESTS: Test[] = [
  { name: "Intern can search docs", req: R("intern", "search_docs", { query: "refund" }), expect: "ALLOW" },
  { name: "Intern cannot read customers", req: R("intern", "read_customer", { customer_id: "C-1001" }), expect: "DENY" },
  { name: "Analyst internal email OK", req: R("analyst", "send_email", { to: "ops@acme.com", subject: "hi", body: "status" }), expect: "ALLOW" },
  { name: "External email needs approval", req: R("analyst", "send_email", { to: "bob@gmail.com", subject: "hi", body: "x" }), expect: "REQUIRE_APPROVAL" },
  { name: "Tainted context blocks external email", req: R("admin", "send_email", { to: "audit@external-audit.io", subject: "export", body: "..." }, { tainted: true }), expect: "DENY" },
  { name: "$1500 refund hard-capped", req: R("admin", "issue_refund", { customer_id: "C-1003", amount: 1500, reason: "x" }), expect: "DENY" },
  { name: "Nobody deletes", req: R("admin", "delete_records", { table: "customers", filter: "*" }), expect: "DENY" },
  { name: "Budget exhausted", req: R("analyst", "search_docs", { query: "x" }, { toolCalls: 9 }), expect: "DENY" },
  { name: "🏆 Challenge: emails mentioning 'password' are denied", req: R("analyst", "send_email", { to: "it@acme.com", subject: "reset", body: "your password is hunter2" }), expect: "DENY", challenge: true },
  { name: "🏆 Challenge: admin export only as csv (json denied)", req: R("admin", "export_customers", { format: "json" }), expect: "DENY", challenge: true },
  { name: "🏆 Challenge: refunds to platinum customer C-1003 need approval even if small", req: R("analyst", "issue_refund", { customer_id: "C-1003", amount: 50, reason: "late" }), expect: "REQUIRE_APPROVAL", challenge: true },
];

export function PolicyLab({ gradient }: { gradient: string; accent: string }) {
  const { completeLab, setSharedPolicy, sharedPolicy, setModuleId, askAssistant } = useApp();
  const [src, setSrc] = useState(() => sharedPolicy ?? JSON.stringify(DEFAULT_POLICY, null, 2));
  const [role, setRole] = useState("analyst");
  const [tool, setTool] = useState("send_email");
  const [args, setArgs] = useState('{ "to": "partner@gmail.com", "subject": "Q3", "body": "numbers" }');
  const [tainted, setTainted] = useState(false);
  const [toolCalls, setToolCalls] = useState(0);
  const [result, setResult] = useState<ReturnType<typeof evaluate> | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const policy = useMemo<Policy | null>(() => {
    try {
      const p = JSON.parse(src);
      return validatePolicy(p) ? null : p;
    } catch {
      return null;
    }
  }, [src]);
  const policyErr = useMemo(() => {
    try {
      return validatePolicy(JSON.parse(src));
    } catch (e) {
      return `JSON: ${(e as Error).message}`;
    }
  }, [src]);

  const suite = useMemo(() => (policy ? TESTS.map((t) => ({ ...t, got: evaluate(policy, t.req).decision })) : []), [policy]);
  const passed = suite.filter((t) => t.got === t.expect).length;

  useEffect(() => {
    if (suite.length && passed === suite.length) completeLab("policy-playground");
  }, [suite, passed, completeLab]);

  const run = () => {
    setErr(null);
    if (!policy) return setErr(policyErr);
    let a: Record<string, unknown>;
    try {
      a = JSON.parse(args);
    } catch {
      return setErr("Args must be valid JSON");
    }
    setResult(evaluate(policy, R(role, tool, a, { tainted, toolCalls })));
  };

  return (
    <div className="space-y-4">
      <p className="rounded-xl bg-white/[0.04] p-3 text-xs text-slate-300">
        🎯 <b>Goal:</b> edit the policy so the whole test suite is green — including the 3 🏆 challenges. Semantics: <b>deny-overrides</b> → approve → allow → default. Ops:{" "}
        <code>== != &gt; &lt; &gt;= &lt;= in not_in endsWith not_endsWith contains matches exists</code>.
      </p>

      <Card title="Policy-as-code (JSON)" right={policyErr ? <Badge kind="FAIL">{policyErr.slice(0, 40)}</Badge> : <Badge kind="PASS">valid</Badge>}>
        <textarea
          value={src}
          onChange={(e) => setSrc(e.target.value)}
          spellCheck={false}
          className="scroll-thin h-72 w-full rounded-lg border border-white/10 bg-black/40 p-3 font-mono text-[11px] leading-relaxed text-emerald-200 outline-none focus:border-teal-400"
        />
        <div className="mt-2 flex flex-wrap gap-2">
          <button onClick={() => setSrc(JSON.stringify(DEFAULT_POLICY, null, 2))} className="rounded-lg bg-white/5 px-2 py-1 text-xs hover:bg-white/10">
            ↺ Reset
          </button>
          <button
            disabled={!policy}
            onClick={() => {
              setSharedPolicy(src);
              setModuleId("hitl");
            }}
            className="rounded-lg bg-teal-500/20 px-2 py-1 text-xs text-teal-200 hover:bg-teal-500/30 disabled:opacity-40"
          >
            🚀 Use this policy in the Secure Agent Sandbox
          </button>
          <button
            onClick={() => askAssistant(`Review this agent authorization policy for gaps and give me improved rules. Policy:\n\`\`\`json\n${src.slice(0, 4000)}\n\`\`\``)}
            className="rounded-lg bg-violet-500/20 px-2 py-1 text-xs text-violet-200 hover:bg-violet-500/30"
          >
            🤖 AI policy review
          </button>
        </div>
      </Card>

      <Card title="Fire a tool request">
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs text-slate-400">
            Principal role
            <select value={role} onChange={(e) => setRole(e.target.value)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-slate-100">
              {["intern", "analyst", "admin"].map((r) => (
                <option key={r}>{r}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400">
            Tool
            <select value={tool} onChange={(e) => setTool(e.target.value)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 text-sm text-slate-100">
              {TOOLS.map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </label>
          <label className="text-xs text-slate-400 sm:col-span-2">
            Args (JSON)
            <input value={args} onChange={(e) => setArgs(e.target.value)} className="mt-0.5 w-full rounded-lg border border-white/10 bg-black/30 px-2 py-1.5 font-mono text-xs text-slate-100" />
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            <input type="checkbox" checked={tainted} onChange={(e) => setTainted(e.target.checked)} /> context.tainted (untrusted content seen)
          </label>
          <label className="flex items-center gap-2 text-xs text-slate-300">
            context.toolCalls
            <input type="number" value={toolCalls} onChange={(e) => setToolCalls(Number(e.target.value))} className="w-16 rounded border border-white/10 bg-black/30 px-1" />
          </label>
        </div>
        <GradientButton gradient={gradient} onClick={run} className="mt-3 w-full">
          <Send size={14} /> Evaluate
        </GradientButton>
        {err && <p className="mt-2 text-xs text-rose-300">{err}</p>}
        {result && (
          <div className="mt-3 rounded-xl bg-black/30 p-3">
            <div className="mb-2 text-lg font-black">
              <Badge kind={result.decision}>{result.decision}</Badge>
            </div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-slate-300">{result.trace.join("\n")}</pre>
          </div>
        )}
      </Card>

      <Card title={`Test suite · ${passed}/${suite.length} passing`}>
        <div className="space-y-1">
          {suite.map((t) => {
            const ok = t.got === t.expect;
            return (
              <div key={t.name} className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${ok ? "bg-emerald-500/5" : t.challenge ? "bg-amber-500/10" : "bg-rose-500/10"}`}>
                {ok ? <CheckCircle2 size={14} className="shrink-0 text-emerald-400" /> : <XCircle size={14} className="shrink-0 text-rose-400" />}
                <span className="flex-1">{t.name}</span>
                <span className="text-slate-500">expect</span> <Badge kind={t.expect}>{t.expect}</Badge>
                {!ok && (
                  <>
                    <span className="text-slate-500">got</span> <Badge kind={t.got}>{t.got}</Badge>
                  </>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
