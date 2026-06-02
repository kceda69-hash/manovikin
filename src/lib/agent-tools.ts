// Whitelisted, sandboxed tools available to the MANOVIK AI agent.
// Add new capabilities ONLY here; the sandbox refuses anything not listed.
import { z } from "zod";
import { Sandbox } from "./sandbox";

export const sandbox = new Sandbox();

// 1. Safe arithmetic evaluator — AST-based recursive descent parser.
// No eval / Function(); only numbers, +, -, *, /, %, **, and parentheses.
function evalArithmetic(input: string): number {
  if (input.length > 200) throw new Error("Expression too long");
  if (!/^[\d\s+\-*/%().eE]+$/.test(input)) {
    throw new Error("Expression contains disallowed characters");
  }
  let pos = 0;
  const src = input;
  const peek = () => src[pos];
  const skipWs = () => {
    while (pos < src.length && /\s/.test(src[pos])) pos++;
  };
  // grammar: expr = term (('+'|'-') term)*
  //          term = power (('*'|'/'|'%') power)*
  //          power = unary ('**' power)?   (right-assoc)
  //          unary = ('+'|'-') unary | primary
  //          primary = number | '(' expr ')'
  function parseExpr(): number {
    let left = parseTerm();
    skipWs();
    while (peek() === "+" || peek() === "-") {
      const op = src[pos++];
      const right = parseTerm();
      left = op === "+" ? left + right : left - right;
      skipWs();
    }
    return left;
  }
  function parseTerm(): number {
    let left = parsePower();
    skipWs();
    while (peek() === "*" || peek() === "/" || peek() === "%") {
      // ensure not '**'
      if (peek() === "*" && src[pos + 1] === "*") break;
      const op = src[pos++];
      const right = parsePower();
      if ((op === "/" || op === "%") && right === 0) throw new Error("Division by zero");
      left = op === "*" ? left * right : op === "/" ? left / right : left % right;
      skipWs();
    }
    return left;
  }
  function parsePower(): number {
    const base = parseUnary();
    skipWs();
    if (peek() === "*" && src[pos + 1] === "*") {
      pos += 2;
      const exp = parsePower();
      return base ** exp;
    }
    return base;
  }
  function parseUnary(): number {
    skipWs();
    if (peek() === "+") {
      pos++;
      return parseUnary();
    }
    if (peek() === "-") {
      pos++;
      return -parseUnary();
    }
    return parsePrimary();
  }
  function parsePrimary(): number {
    skipWs();
    if (peek() === "(") {
      pos++;
      const v = parseExpr();
      skipWs();
      if (peek() !== ")") throw new Error("Missing closing parenthesis");
      pos++;
      return v;
    }
    const start = pos;
    while (pos < src.length && /[\d.eE+\-]/.test(src[pos])) {
      // only consume +/- if part of exponent
      if ((src[pos] === "+" || src[pos] === "-") && !/[eE]/.test(src[pos - 1])) break;
      pos++;
    }
    const numStr = src.slice(start, pos);
    if (!/^\d+(\.\d+)?([eE][+\-]?\d+)?$|^\.\d+([eE][+\-]?\d+)?$/.test(numStr)) {
      throw new Error("Invalid number literal");
    }
    return Number(numStr);
  }
  const result = parseExpr();
  skipWs();
  if (pos !== src.length) throw new Error("Unexpected trailing input");
  if (!Number.isFinite(result)) throw new Error("Expression did not evaluate to a finite number");
  return result;
}

sandbox.register({
  name: "math.eval",
  description: "Evaluate a basic arithmetic expression (+ - * / % ** and parentheses).",
  schema: z.object({ expression: z.string().min(1).max(200) }),
  timeoutMs: 200,
  maxOutputBytes: 1_000,
  rateLimitPerMin: 60,
  execute: async ({ expression }) => {
    return { value: evalArithmetic(expression) };
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
