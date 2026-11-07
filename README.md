# 🛡️ Securing Agentic AI: Identity, Permissions & Runtime Guardrails

An interactive learning app built with **Next.js 16**, **LangGraph.js** and **Groq (BYOK)**.

- **Left side: Learning Hub.** 8 modules, 20 lessons, key takeaways, quizzes and curated primary sources.
- **Right side: Hands-on Labs.** One lab per module, each practising what that module teaches.
- **AI Tutor "Sentinel".** A LangGraph agent that runs through the same guardrails the course teaches, and shows a live trace for each reply.

## Quick start

```bash
npm install
npm run dev        # http://localhost:3000
```

Click **🔑 Add Groq key**, paste a key from <https://console.groq.com/keys>, and pick a model.

## Modules → Labs

| # | Module | Lab | Engine |
|---|---|---|---|
| 1 | Agentic threat landscape (OWASP LLM/Agentic Top 10, Lethal Trifecta, Rule of Two) | Threat Model Builder | client |
| 2 | Agent identity (NHI, SPIFFE, RFC 8693 delegation, DPoP, MCP auth) | Token & Delegation Lab (real HS256 JWTs) | client |
| 3 | Permissions (RBAC/ABAC/ReBAC, confused deputy, policy-as-code) | Policy Playground + test suite & challenges | client |
| 4 | Runtime guardrails (input/tool/output/system layers) | Guardrail Pipeline Tester (+ optional LLM judge) | client + Groq |
| 5 | Prompt injection & tool poisoning | Red Team Arena (attack a live bot, toggle 5 defences) | LangGraph + Groq |
| 6 | Human-in-the-loop & secure orchestration | Secure Agent Sandbox (tool agent + PDP + `interrupt()` approvals) | LangGraph + Groq |
| 7 | Observability, audit & incident response | Audit Log Forensics (SHA-256 hash chain, tamper & anchor) | client |
| 8 | Governance & maturity (NIST AI RMF, ISO 42001, EU AI Act) | Maturity Assessment + AI roadmap | client + Groq |

The labs are connected. For example, a policy you write in the **Policy Playground** can be sent to the **Secure Agent Sandbox** and enforced on a live agent.

## LangGraph graphs (`src/lib/server/`)

```
tutorGraph:   START → inputGuard ─┬─(secrets)→ redactInput ─┐
                                  └─────────────────────────┴→ tutor(Groq) → outputGuard → END

redteamGraph: START → inputClassifier ─┬─(blocked)→ verdict → END
                                       └→ victim(Groq) → outputFilter → judge(Groq) → verdict → END

sandboxGraph: START → agent(Groq+tools) ─┬─(tool calls)→ policyCheck ─┬─(approve?)→ approval[interrupt()] → tools ─┐
                                         │                            └────────────────────────────────→ tools ─┤
                                         └─(answer)→ outputGuard → END                       agent ◀─────────────┘
```

- Guard nodes sit directly in the graph's path, so the model cannot skip them.
- The sandbox uses a `MemorySaver` checkpointer. Approvals resume with `Command({ resume })`.
- The policy engine (`src/lib/policy.ts`) is deterministic and uses deny-overrides. It supports allow, deny and approve decisions, plus taint rules that enforce the Rule of Two.

## How the app handles your BYOK key

- The key is stored only in your browser: sessionStorage by default, or localStorage if you opt in.
- It is sent in an `x-groq-key` header to this app's own API routes and used for that single request.
- It is captured in a closure when the graph is built, so it never enters LangGraph state or checkpoints. It is never logged, and it is scrubbed from error messages.
- The API routes enforce a size cap on requests and a simple per-client rate limit.

## Notes

- All sandbox tools are mocks. Nothing is actually emailed, refunded or deleted.
- The `MemorySaver` is in-process memory, so paused sandbox runs survive only while one server process is running. For a serverless deployment, swap it for a persistent checkpointer such as Postgres.
- Learner progress (XP, lessons, quizzes, labs) is stored in localStorage.
