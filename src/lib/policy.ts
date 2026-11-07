// A tiny, deterministic policy-as-code engine (Cedar/OPA-inspired) with deny-overrides semantics.

export type Effect = "allow" | "deny" | "approve";
export type Decision = "ALLOW" | "DENY" | "REQUIRE_APPROVAL";

export type Condition = {
  attr: string; // dotted path e.g. "args.amount", "principal.role", "context.tainted"
  op: "==" | "!=" | ">" | "<" | ">=" | "<=" | "in" | "not_in" | "endsWith" | "not_endsWith" | "contains" | "matches" | "exists";
  value?: unknown;
};

export type Rule = {
  id: string;
  effect: Effect;
  description?: string;
  tools?: string[]; // "*" or tool names
  roles?: string[]; // principal roles
  conditions?: Condition[];
};

export type Policy = { default: "deny" | "allow"; rules: Rule[] };

export type AuthzRequest = {
  principal: { id: string; role: string; [k: string]: unknown };
  actor: { id: string; [k: string]: unknown };
  tool: string;
  args: Record<string, unknown>;
  context: Record<string, unknown>;
};

export type Evaluation = {
  decision: Decision;
  matched: { id: string; effect: Effect; description?: string }[];
  trace: string[];
};

export function getPath(obj: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((o, k) => (o && typeof o === "object" ? (o as Record<string, unknown>)[k] : undefined), obj);
}

function check(c: Condition, req: AuthzRequest): boolean {
  const v = getPath(req, c.attr);
  const t = c.value;
  switch (c.op) {
    case "==": return v === t;
    case "!=": return v !== t;
    case ">": return Number(v) > Number(t);
    case "<": return Number(v) < Number(t);
    case ">=": return Number(v) >= Number(t);
    case "<=": return Number(v) <= Number(t);
    case "in": return Array.isArray(t) && t.includes(v);
    case "not_in": return Array.isArray(t) && !t.includes(v);
    case "endsWith": return typeof v === "string" && v.toLowerCase().endsWith(String(t).toLowerCase());
    case "not_endsWith": return typeof v === "string" && !v.toLowerCase().endsWith(String(t).toLowerCase());
    case "contains": return typeof v === "string" ? v.toLowerCase().includes(String(t).toLowerCase()) : Array.isArray(v) && v.includes(t);
    case "matches": try { return typeof v === "string" && new RegExp(String(t), "i").test(v); } catch { return false; }
    case "exists": return v !== undefined && v !== null;
    default: return false;
  }
}

export function evaluate(policy: Policy, req: AuthzRequest): Evaluation {
  const trace: string[] = [];
  const matched: Evaluation["matched"] = [];
  for (const r of policy.rules) {
    const toolOk = !r.tools || r.tools.includes("*") || r.tools.includes(req.tool);
    if (!toolOk) continue;
    const roleOk = !r.roles || r.roles.includes("*") || r.roles.includes(req.principal.role);
    if (!roleOk) {
      trace.push(`· ${r.id}: role '${req.principal.role}' not in [${r.roles?.join(", ")}]`);
      continue;
    }
    const failed = (r.conditions ?? []).find((c) => !check(c, req));
    if (failed) {
      trace.push(`· ${r.id}: condition ${failed.attr} ${failed.op} ${JSON.stringify(failed.value ?? "")} is false (actual: ${JSON.stringify(getPath(req, failed.attr))})`);
      continue;
    }
    trace.push(`✓ ${r.id} matched → ${r.effect.toUpperCase()}`);
    matched.push({ id: r.id, effect: r.effect, description: r.description });
  }
  let decision: Decision;
  if (matched.some((m) => m.effect === "deny")) decision = "DENY";
  else if (matched.some((m) => m.effect === "approve")) decision = "REQUIRE_APPROVAL";
  else if (matched.some((m) => m.effect === "allow")) decision = "ALLOW";
  else {
    decision = policy.default === "allow" ? "ALLOW" : "DENY";
    trace.push(`∅ no rule matched → default ${policy.default.toUpperCase()}`);
  }
  trace.push(`⇒ deny-overrides result: ${decision}`);
  return { decision, matched, trace };
}

export function validatePolicy(p: unknown): string | null {
  if (!p || typeof p !== "object") return "Policy must be an object";
  const pol = p as Policy;
  if (pol.default !== "deny" && pol.default !== "allow") return `"default" must be "deny" or "allow"`;
  if (!Array.isArray(pol.rules)) return `"rules" must be an array`;
  for (const [i, r] of pol.rules.entries()) {
    if (!r.id) return `rules[${i}] needs an "id"`;
    if (!["allow", "deny", "approve"].includes(r.effect)) return `rules[${i}].effect must be allow | deny | approve`;
  }
  return null;
}

/** Default policy used by the Secure Agent Sandbox and as the Policy Playground starter. */
export const DEFAULT_POLICY: Policy = {
  default: "deny",
  rules: [
    { id: "read-docs-anyone", effect: "allow", description: "Anyone may search public knowledge base", tools: ["search_docs"], roles: ["*"] },
    { id: "read-customer-analyst", effect: "allow", description: "Analysts & admins may read a single customer record", tools: ["read_customer"], roles: ["analyst", "admin"] },
    { id: "email-internal", effect: "allow", description: "Internal email is fine", tools: ["send_email"], roles: ["analyst", "admin"], conditions: [{ attr: "args.to", op: "endsWith", value: "@acme.com" }] },
    { id: "email-external-approval", effect: "approve", description: "External email needs human approval", tools: ["send_email"], roles: ["analyst", "admin"], conditions: [{ attr: "args.to", op: "not_endsWith", value: "@acme.com" }] },
    { id: "no-external-after-taint", effect: "deny", description: "Rule of Two: after untrusted content was read, block external sends", tools: ["send_email"], roles: ["*"], conditions: [{ attr: "context.tainted", op: "==", value: true }, { attr: "args.to", op: "not_endsWith", value: "@acme.com" }] },
    { id: "export-admin-approval", effect: "approve", description: "Bulk export only by admin, with approval", tools: ["export_customers"], roles: ["admin"] },
    { id: "refund-small", effect: "allow", description: "Refunds up to $100 auto-approved", tools: ["issue_refund"], roles: ["analyst", "admin"], conditions: [{ attr: "args.amount", op: "<=", value: 100 }] },
    { id: "refund-large-approval", effect: "approve", description: "Refunds over $100 need approval", tools: ["issue_refund"], roles: ["analyst", "admin"], conditions: [{ attr: "args.amount", op: ">", value: 100 }] },
    { id: "refund-cap", effect: "deny", description: "Hard cap: no refunds over $1000", tools: ["issue_refund"], roles: ["*"], conditions: [{ attr: "args.amount", op: ">", value: 1000 }] },
    { id: "never-delete", effect: "deny", description: "Agents may never delete records", tools: ["delete_records"], roles: ["*"] },
    { id: "budget", effect: "deny", description: "Max 8 tool calls per task", tools: ["*"], roles: ["*"], conditions: [{ attr: "context.toolCalls", op: ">=", value: 8 }] },
  ],
};
