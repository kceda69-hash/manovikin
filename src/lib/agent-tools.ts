// Whitelisted, sandboxed tools available to the MANOVIK AI agent.
// Add new capabilities ONLY here; the sandbox refuses anything not listed.
import { z } from "zod";
import { Sandbox } from "./sandbox";

export const sandbox = new Sandbox();

// 1. Safe arithmetic evaluator (no eval, no identifiers, only numbers + operators)
sandbox.register({
  name: "math.eval",
  description: "Evaluate a basic arithmetic expression (+ - * / % ** and parentheses).",
  schema: z.object({ expression: z.string().min(1).max(200) }),
  timeoutMs: 200,
  maxOutputBytes: 1_000,
  rateLimitPerMin: 60,
  execute: async ({ expression }) => {
    if (!/^[\d\s+\-*/%().,e]+$|^[\d\s+\-*/%().,e*]+$/.test(expression)) {
      throw new Error("Expression contains disallowed characters");
    }
    // eslint-disable-next-line no-new-func
    const value = Function(`"use strict"; return (${expression});`)();
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error("Expression did not evaluate to a finite number");
    }
    return { value };
  },
});

// 2. Text utilities (deterministic, no IO)
sandbox.register({
  name: "text.transform",
  description: "Transform text: upper, lower, reverse, length, base64-encode, base64-decode.",
  schema: z.object({
    op: z.enum(["upper", "lower", "reverse", "length", "b64encode", "b64decode"]),
    input: z.string().max(10_000),
  }),
  timeoutMs: 200,
  maxOutputBytes: 20_000,
  rateLimitPerMin: 120,
  execute: async ({ op, input }) => {
    switch (op) {
      case "upper":
        return { result: input.toUpperCase() };
      case "lower":
        return { result: input.toLowerCase() };
      case "reverse":
        return { result: [...input].reverse().join("") };
      case "length":
        return { result: input.length };
      case "b64encode":
        return { result: btoa(unescape(encodeURIComponent(input))) };
      case "b64decode":
        return { result: decodeURIComponent(escape(atob(input))) };
    }
  },
});

// 3. Current time (no input)
sandbox.register({
  name: "time.now",
  description: "Return the current server time as ISO 8601 and Unix epoch.",
  schema: z.object({}).strict(),
  timeoutMs: 50,
  maxOutputBytes: 200,
  rateLimitPerMin: 120,
  execute: async () => {
    const now = new Date();
    return { iso: now.toISOString(), epoch: now.getTime() };
  },
});

// 4. HTTP GET — allow-listed hosts only, GET only, capped response, hard timeout
const HTTP_ALLOWLIST = new Set<string>([
  "api.github.com",
  "api.duckduckgo.com",
  "wikipedia.org",
  "en.wikipedia.org",
  "jsonplaceholder.typicode.com",
]);

sandbox.register({
  name: "http.get",
  description: `HTTP GET a JSON or text resource. Allowed hosts only: ${Array.from(HTTP_ALLOWLIST).join(", ")}.`,
  schema: z.object({ url: z.string().url() }),
  timeoutMs: 5_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 20,
  execute: async ({ url }, { signal }) => {
    const u = new URL(url);
    if (u.protocol !== "https:") throw new Error("Only https:// is allowed");
    if (!HTTP_ALLOWLIST.has(u.hostname)) {
      throw new Error(`Host "${u.hostname}" is not in the allow-list`);
    }
    const res = await fetch(u.toString(), {
      signal,
      headers: { "User-Agent": "MANOVIK AI-Sandbox/1.0", Accept: "application/json, text/*;q=0.9" },
      redirect: "error",
    });
    const contentType = res.headers.get("content-type") ?? "";
    const body = await res.text();
    return { status: res.status, contentType, body };
  },
});
