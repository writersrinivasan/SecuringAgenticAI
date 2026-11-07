// Isomorphic, deterministic guardrails used by both the labs (client) and the LangGraph agents (server).

export type Severity = "low" | "medium" | "high";
export type Finding = { guard: string; rule: string; severity: Severity; match?: string };

const ZERO_WIDTH = /[​-‏‪-‮⁠-⁤﻿]|[\u{E0000}-\u{E007F}]/gu;
const HOMOGLYPHS: Record<string, string> = {
  "а": "a", "е": "e", "о": "o", "р": "p", "с": "c", "х": "x", "і": "i", "ӏ": "l", "ѕ": "s",
  "0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "7": "t", "@": "a", "$": "s",
};

/** Normalise text so obfuscation tricks don't slip past pattern matching. */
export function normalize(text: string): { text: string; notes: string[] } {
  const notes: string[] = [];
  let t = text.normalize("NFKC");
  if (t.search(ZERO_WIDTH) !== -1) {
    notes.push("Removed invisible / zero-width / Unicode-tag characters");
    t = t.replace(ZERO_WIDTH, "");
  }
  // Decode embedded base64 blobs (≥ 16 chars) and append decoded text for inspection
  const b64 = t.match(/[A-Za-z0-9+/]{16,}={0,2}/g) ?? [];
  for (const blob of b64) {
    try {
      const dec = typeof atob === "function" ? atob(blob) : Buffer.from(blob, "base64").toString("binary");
      if (/^[\x20-\x7E\s]+$/.test(dec) && /[a-z]{3,}/i.test(dec)) {
        notes.push(`Decoded base64: "${dec.slice(0, 60)}"`);
        t += `\n${dec}`;
      }
    } catch {
      /* not base64 */
    }
  }
  return { text: t, notes };
}

function deLeet(s: string) {
  return s
    .toLowerCase()
    .split("")
    .map((c) => HOMOGLYPHS[c] ?? c)
    .join("");
}

const INJECTION_RULES: { rule: string; re: RegExp; severity: Severity }[] = [
  { rule: "instruction-override", re: /\b(ignore|disregard|forget|override)\b.{0,40}\b(previous|prior|above|earlier|all|system)\b.{0,30}\b(instructions?|rules?|prompts?|directions?)/i, severity: "high" },
  { rule: "new-instructions", re: /\b(new|updated|real|actual)\s+(instructions?|rules|system prompt)\b/i, severity: "medium" },
  { rule: "system-prompt-extraction", re: /\b(reveal|show|print|repeat|output|tell me|what is|leak)\b.{0,40}\b(system prompt|your (instructions|prompt|rules)|initial prompt|hidden prompt|secret|password|flag|api key)/i, severity: "high" },
  { rule: "role-hijack", re: /\b(you are now|act as|pretend (to be|you are)|roleplay as|from now on you)\b/i, severity: "medium" },
  { rule: "jailbreak-persona", re: /\b(DAN|do anything now|developer mode|jailbreak|no (rules|restrictions|filters)|unfiltered)\b/i, severity: "high" },
  { rule: "fake-turn", re: /(^|\n)\s*(system|assistant)\s*:/i, severity: "medium" },
  { rule: "delimiter-escape", re: /(<\/?(system|instructions?|data|document)>|```\s*system|\[\/?INST\])/i, severity: "medium" },
  { rule: "exfil-instruction", re: /\b(send|email|post|upload|forward|exfiltrate|transmit)\b.{0,60}\b(to|at)\b.{0,40}(@|https?:\/\/)/i, severity: "high" },
  { rule: "obfuscation-request", re: /\b(base64|rot13|reverse(d)?|spell( it)? (out|backwards)|one letter at a time|in hex|encode)\b/i, severity: "medium" },
  { rule: "urgency-authority", re: /\b(URGENT|IMPORTANT|ADMIN|ADMINISTRATOR|CEO|security team)\b.{0,30}\b(override|requires?|must|immediately)\b/i, severity: "low" },
];

export function detectInjection(raw: string, opts: { normalize?: boolean } = { normalize: true }): { score: number; findings: Finding[]; normalized: string; notes: string[] } {
  const { text, notes } = opts.normalize === false ? { text: raw, notes: [] as string[] } : normalize(raw);
  const variants = opts.normalize === false ? [text] : [text, deLeet(text)];
  const findings: Finding[] = [];
  for (const r of INJECTION_RULES) {
    for (const v of variants) {
      const m = v.match(r.re);
      if (m) {
        findings.push({ guard: "input", rule: r.rule, severity: r.severity, match: m[0].slice(0, 80) });
        break;
      }
    }
  }
  if (notes.length) findings.push({ guard: "input", rule: "obfuscation-detected", severity: "medium", match: notes[0] });
  const weight = { low: 0.15, medium: 0.3, high: 0.55 };
  const score = Math.min(1, findings.reduce((a, f) => a + weight[f.severity], 0));
  return { score, findings, normalized: text, notes };
}

const SECRET_RULES: { rule: string; re: RegExp }[] = [
  { rule: "groq-key", re: /\bgsk_[A-Za-z0-9]{20,}\b/g },
  { rule: "openai-key", re: /\bsk-(proj-)?[A-Za-z0-9_-]{20,}\b/g },
  { rule: "anthropic-key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}\b/g },
  { rule: "aws-access-key", re: /\bAKIA[0-9A-Z]{16}\b/g },
  { rule: "github-token", re: /\bgh[pousr]_[A-Za-z0-9]{30,}\b/g },
  { rule: "private-key", re: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g },
  { rule: "jwt", re: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g },
];

const PII_RULES: { rule: string; re: RegExp }[] = [
  { rule: "email", re: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g },
  { rule: "credit-card", re: /\b\d(?:[ -]?\d){12,15}\b/g },
  { rule: "us-ssn", re: /\b\d{3}-\d{2}-\d{4}\b/g },
  { rule: "phone", re: /\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g },
  { rule: "ipv4", re: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

export function scanSecrets(text: string): Finding[] {
  const out: Finding[] = [];
  for (const r of SECRET_RULES) for (const m of text.matchAll(r.re)) out.push({ guard: "secrets", rule: r.rule, severity: "high", match: mask(m[0]) });
  return out;
}

export function scanPII(text: string): Finding[] {
  const out: Finding[] = [];
  for (const r of PII_RULES) for (const m of text.matchAll(r.re)) out.push({ guard: "pii", rule: r.rule, severity: "medium", match: mask(m[0]) });
  return out;
}

export function mask(s: string) {
  if (s.length <= 8) return "•".repeat(s.length);
  return `${s.slice(0, 4)}${"•".repeat(Math.min(12, s.length - 6))}${s.slice(-2)}`;
}

export function redact(text: string, opts: { secrets?: boolean; pii?: boolean } = { secrets: true, pii: true }) {
  let t = text;
  const findings: Finding[] = [];
  if (opts.secrets) {
    for (const r of SECRET_RULES) {
      t = t.replace(r.re, (m) => {
        findings.push({ guard: "secrets", rule: r.rule, severity: "high", match: mask(m) });
        return `[REDACTED:${r.rule}]`;
      });
    }
  }
  if (opts.pii) {
    for (const r of PII_RULES) {
      t = t.replace(r.re, (m) => {
        findings.push({ guard: "pii", rule: r.rule, severity: "medium", match: mask(m) });
        return `[REDACTED:${r.rule}]`;
      });
    }
  }
  return { text: t, findings };
}

/** Strip exfiltration channels: markdown images and links to non-allowlisted hosts. */
export function stripExfil(text: string, allowHosts: string[] = []) {
  const findings: Finding[] = [];
  const allowed = (url: string) => {
    try {
      const h = new URL(url).hostname;
      return allowHosts.some((a) => h === a || h.endsWith(`.${a}`));
    } catch {
      return false;
    }
  };
  let t = text.replace(/!\[([^\]]*)\]\(([^)\s]+)[^)]*\)/g, (m, alt, url) => {
    if (allowed(url)) return m;
    findings.push({ guard: "output", rule: "markdown-image-exfil", severity: "high", match: url.slice(0, 80) });
    return `[image removed: ${alt || "untrusted"}]`;
  });
  t = t.replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, (m, label, url) => {
    if (allowed(url)) return m;
    if (/[?&][^=]+=.{12,}/.test(url)) {
      findings.push({ guard: "output", rule: "suspicious-link-params", severity: "medium", match: url.slice(0, 80) });
      return `${label} (link removed)`;
    }
    return m;
  });
  return { text: t, findings };
}

/** Detects a secret in output, including common obfuscations (spacing, reversal, base64, hex). */
export function containsSecret(output: string, secret: string): { leaked: boolean; how?: string } {
  const o = output.toLowerCase();
  const s = secret.toLowerCase();
  const core = s.replace(/[^a-z0-9]/g, "");
  const squashed = o.replace(/[^a-z0-9]/g, "");
  if (o.includes(s)) return { leaked: true, how: "verbatim" };
  if (squashed.includes(core)) return { leaked: true, how: "spaced / punctuated" };
  if (squashed.includes(core.split("").reverse().join(""))) return { leaked: true, how: "reversed" };
  const b64 = (str: string) => (typeof btoa === "function" ? btoa(str) : Buffer.from(str).toString("base64"));
  if (output.includes(b64(secret).replace(/=+$/, ""))) return { leaked: true, how: "base64" };
  const hex = Array.from(secret).map((c) => c.charCodeAt(0).toString(16)).join("");
  if (squashed.includes(hex)) return { leaked: true, how: "hex" };
  // Partial leak: long unique chunk of the secret's random suffix
  const suffix = core.slice(-6);
  if (suffix.length === 6 && squashed.includes(suffix)) return { leaked: true, how: "partial" };
  return { leaked: false };
}

/** Spotlighting: datamark untrusted text so the model can distinguish it from instructions. */
export function spotlight(untrusted: string, mode: "delimit" | "datamark" = "datamark") {
  if (mode === "delimit") return `<<<UNTRUSTED_DATA>>>\n${untrusted}\n<<<END_UNTRUSTED_DATA>>>`;
  return `<<<UNTRUSTED_DATA datamark="^">>>\n${untrusted.replace(/\s+/g, "^")}\n<<<END_UNTRUSTED_DATA>>>`;
}
