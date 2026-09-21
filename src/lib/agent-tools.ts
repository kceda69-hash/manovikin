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
    while (pos < src.length && /[\d.eE+-]/.test(src[pos])) {
      // only consume +/- if part of exponent
      if ((src[pos] === "+" || src[pos] === "-") && !/[eE]/.test(src[pos - 1])) break;
      pos++;
    }
    const numStr = src.slice(start, pos);
    if (!/^\d+(\.\d+)?([eE][+-]?\d+)?$|^\.\d+([eE][+-]?\d+)?$/.test(numStr)) {
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

// 5. Date/time arithmetic — add/subtract days, diff, weekday, ISO week.
sandbox.register({
  name: "datetime.calc",
  description:
    "Date arithmetic: add/subtract days from a date (op=add), diff between two dates (op=diff), or weekday/ISO-week info (op=info). Dates as YYYY-MM-DD.",
  schema: z.object({
    op: z.enum(["add", "diff", "info"]),
    date: z.string().max(40),
    other: z.string().max(40).optional(),
    days: z.number().int().min(-36500).max(36500).optional(),
  }),
  timeoutMs: 200,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 120,
  execute: async ({ op, date, other, days }) => {
    const parse = (s: string) => {
      const d = new Date(s.length <= 10 ? `${s}T00:00:00Z` : s);
      if (Number.isNaN(d.getTime())) throw new Error(`Invalid date: ${s}`);
      return d;
    };
    const weekday = (d: Date) =>
      d.toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
    if (op === "add") {
      if (days === undefined) throw new Error("days is required for op=add");
      const d = parse(date);
      d.setUTCDate(d.getUTCDate() + days);
      return { result: d.toISOString().slice(0, 10), iso: d.toISOString(), weekday: weekday(d) };
    }
    if (op === "diff") {
      if (!other) throw new Error("other is required for op=diff");
      const ms = parse(other).getTime() - parse(date).getTime();
      const totalDays = Math.trunc(ms / 86_400_000);
      return {
        days: totalDays,
        weeks: Math.trunc(totalDays / 7),
        hours: Math.trunc(ms / 3_600_000),
      };
    }
    const d = parse(date);
    // ISO-8601 week number: shift to the Thursday of this week, then count
    // whole weeks since Jan 1 of that Thursday's year.
    const thursday = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    thursday.setUTCDate(thursday.getUTCDate() + 4 - (thursday.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(thursday.getUTCFullYear(), 0, 1));
    const isoWeek = Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
    return {
      iso: d.toISOString(),
      weekday: weekday(d),
      isoWeek,
      dayOfYear: Math.floor((d.getTime() - Date.UTC(d.getUTCFullYear(), 0, 0)) / 86_400_000),
      isWeekend: [0, 6].includes(d.getUTCDay()),
    };
  },
});

// 6. Text statistics — counts, reading time, top keywords.
const STOP_WORDS = new Set(
  "the,a,an,and,or,but,if,then,of,to,in,on,for,with,as,at,by,from,is,are,was,were,be,been,it,its,this,that,these,those,i,you,he,she,we,they,not,no,do,does,did,will,would,can,could,should,have,has,had,so,than,too,very,just,into,over,after,before,between,about,up,out,all,any,each,other,some,such,only,own,same,my,your,his,her,our,their".split(
    ",",
  ),
);

sandbox.register({
  name: "text.stats",
  description:
    "Text statistics: characters, words, sentences, paragraphs, reading time, top keywords.",
  schema: z.object({
    input: z.string().max(50_000),
    topK: z.number().int().min(1).max(20).default(8),
  }),
  timeoutMs: 300,
  maxOutputBytes: 5_000,
  rateLimitPerMin: 120,
  execute: async ({ input, topK }) => {
    const words = input.toLowerCase().match(/[a-z0-9']+/gi) ?? [];
    const sentences = input.split(/[.!?…]+/).filter((s) => s.trim().length > 0).length;
    const paragraphs = input.split(/\n\s*\n/).filter((s) => s.trim().length > 0).length;
    const freq = new Map<string, number>();
    for (const w of words) {
      if (!STOP_WORDS.has(w) && w.length > 2) freq.set(w, (freq.get(w) ?? 0) + 1);
    }
    const topKeywords = [...freq.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, topK)
      .map(([word, count]) => ({ word, count }));
    return {
      characters: input.length,
      charactersNoSpaces: input.replace(/\s/g, "").length,
      words: words.length,
      sentences,
      paragraphs,
      readingTimeMin: Math.max(1, Math.round(words.length / 200)),
      topKeywords,
    };
  },
});

// 7. Data conversion — JSON pretty/minify/validate, JSON array <-> CSV.
sandbox.register({
  name: "data.convert",
  description:
    "Convert/validate data: pretty-print, minify or validate JSON; convert a JSON array of objects to CSV or CSV back to JSON.",
  schema: z.object({
    op: z.enum(["json_pretty", "json_minify", "json_validate", "json_to_csv", "csv_to_json"]),
    input: z.string().max(100_000),
  }),
  timeoutMs: 500,
  maxOutputBytes: 20_000,
  rateLimitPerMin: 60,
  execute: async ({ op, input }) => {
    if (op === "json_validate") {
      try {
        const v = JSON.parse(input);
        return { valid: true, type: Array.isArray(v) ? "array" : typeof v };
      } catch (e) {
        return { valid: false, error: String((e as Error).message).slice(0, 300) };
      }
    }
    if (op === "json_pretty") return { result: JSON.stringify(JSON.parse(input), null, 2) };
    if (op === "json_minify") return { result: JSON.stringify(JSON.parse(input)) };
    if (op === "json_to_csv") {
      const arr = JSON.parse(input);
      if (
        !Array.isArray(arr) ||
        arr.length === 0 ||
        typeof arr[0] !== "object" ||
        arr[0] === null
      ) {
        throw new Error("Input must be a non-empty JSON array of objects");
      }
      const headers = [...new Set(arr.flatMap((o) => Object.keys(o)))];
      const esc = (v: unknown) => {
        const s = v == null ? "" : String(v);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
      };
      const lines = [
        headers.map(esc).join(","),
        ...arr.map((row) => headers.map((h) => esc(row[h])).join(",")),
      ];
      return { result: lines.join("\n"), rows: arr.length, columns: headers };
    }
    // csv_to_json
    const lines = input.trim().split(/\r?\n/);
    if (lines.length < 2) throw new Error("CSV needs a header row and at least one data row");
    const parseRow = (line: string): string[] => {
      const out: string[] = [];
      let cur = "";
      let inQuotes = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (inQuotes) {
          if (c === '"') {
            if (line[i + 1] === '"') {
              cur += '"';
              i++;
            } else inQuotes = false;
          } else cur += c;
        } else if (c === '"') inQuotes = true;
        else if (c === ",") {
          out.push(cur);
          cur = "";
        } else cur += c;
      }
      out.push(cur);
      return out;
    };
    const headers = parseRow(lines[0]);
    const rows = lines.slice(1).map((l) => {
      const cells = parseRow(l);
      return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
    });
    return { result: rows, rows: rows.length, columns: headers };
  },
});

// 8. Cryptographic utilities — hashes, UUIDs, secure random values (WebCrypto).
sandbox.register({
  name: "crypto.utils",
  description:
    "Cryptographic utilities: SHA-256/SHA-1 hash of text, UUID v4, secure random hex or URL-safe token.",
  schema: z.object({
    op: z.enum(["sha256", "sha1", "uuid", "random_hex", "random_token"]),
    input: z.string().max(50_000).optional(),
    bytes: z.number().int().min(4).max(64).default(16),
  }),
  timeoutMs: 500,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 60,
  execute: async ({ op, input, bytes }) => {
    if (op === "sha256" || op === "sha1") {
      const subtle = globalThis.crypto?.subtle;
      if (!subtle) throw new Error("WebCrypto is unavailable in this runtime");
      if (!input) throw new Error("input is required for hashing");
      const digest = await subtle.digest(
        op === "sha256" ? "SHA-256" : "SHA-1",
        new TextEncoder().encode(input),
      );
      return {
        algorithm: op,
        hex: [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join(""),
      };
    }
    if (op === "uuid") return { uuid: globalThis.crypto.randomUUID() };
    const buf = new Uint8Array(bytes);
    globalThis.crypto.getRandomValues(buf);
    const hex = [...buf].map((b) => b.toString(16).padStart(2, "0")).join("");
    if (op === "random_hex") return { hex };
    const token = btoa(String.fromCharCode(...buf))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return { token, bytes };
  },
});

// 9. Web search — DuckDuckGo Instant Answers (no key needed).
sandbox.register({
  name: "web.search",
  description:
    "Web search via DuckDuckGo Instant Answers: definitions, facts, docs. Returns an abstract, direct answer and related topics with URLs.",
  schema: z.object({ query: z.string().min(2).max(200) }),
  timeoutMs: 6_000,
  maxOutputBytes: 8_000,
  rateLimitPerMin: 20,
  execute: async ({ query }, { signal }) => {
    const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1`;
    const res = await fetch(url, {
      signal,
      headers: { "User-Agent": "MANOVIK AI-Sandbox/1.0" },
    });
    if (!res.ok) throw new Error(`Search failed: HTTP ${res.status}`);
    interface DuckDuckGoTopic {
      Text?: string;
      FirstURL?: string;
      Topics?: DuckDuckGoTopic[];
    }
    interface DuckDuckGoResult {
      RelatedTopics?: DuckDuckGoTopic[];
      Heading?: string;
      AbstractText?: string;
      AbstractSource?: string;
      AbstractURL?: string;
      Answer?: string;
    }
    const data = (await res.json()) as DuckDuckGoResult;
    const topics = (data.RelatedTopics ?? [])
      .flatMap((t) => t.Topics ?? [t])
      .slice(0, 8)
      .map((t) => ({ text: String(t.Text ?? "").slice(0, 300), url: t.FirstURL ?? "" }))
      .filter((t) => t.text);
    return {
      query,
      heading: data.Heading ?? "",
      abstract: String(data.AbstractText ?? "").slice(0, 1500),
      source: data.AbstractSource ?? "",
      sourceUrl: data.AbstractURL ?? "",
      answer: String(data.Answer ?? "").slice(0, 500),
      related: topics,
    };
  },
});

// 10. Color conversion — HEX/RGB/HSL + WCAG contrast ratio.
sandbox.register({
  name: "color.convert",
  description:
    "Convert colors between HEX, RGB and HSL; or compute the WCAG contrast ratio between two colors (op=contrast needs other).",
  schema: z.object({
    op: z.enum(["convert", "contrast"]),
    color: z.string().max(40),
    other: z.string().max(40).optional(),
  }),
  timeoutMs: 200,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 120,
  execute: async ({ op, color, other }) => {
    type RGB = [number, number, number];
    const parse = (s: string): RGB => {
      s = s.trim();
      let m = s.match(/^#([0-9a-f]{6})$/i);
      if (m) {
        const n = parseInt(m[1], 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
      }
      m = s.match(/^#([0-9a-f]{3})$/i);
      if (m) {
        const h = m[1];
        return [parseInt(h[0] + h[0], 16), parseInt(h[1] + h[1], 16), parseInt(h[2] + h[2], 16)];
      }
      m = s.match(/^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/i);
      if (m) return [+m[1], +m[2], +m[3]];
      m = s.match(/^hsl\(\s*(\d{1,3})\s*,\s*(\d{1,3})%\s*,\s*(\d{1,3})%\s*\)$/i);
      if (m) {
        const h = +m[1] / 360;
        const sat = +m[2] / 100;
        const li = +m[3] / 100;
        const k = (n: number) => (n + h * 12) % 12;
        const a = sat * Math.min(li, 1 - li);
        const f = (n: number) => li - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
        return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
      }
      throw new Error(`Unrecognized color: ${s}`);
    };
    const clamp = (v: number) => Math.max(0, Math.min(255, Math.round(v)));
    const toHex = ([r, g, b]: RGB) =>
      `#${[r, g, b].map((v) => clamp(v).toString(16).padStart(2, "0")).join("")}`;
    const toHsl = ([r, g, b]: RGB): RGB => {
      r /= 255;
      g /= 255;
      b /= 255;
      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);
      let h = 0;
      let s = 0;
      const l = (max + min) / 2;
      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else h = (r - g) / d + 4;
        h *= 60;
      }
      return [Math.round(h), Math.round(s * 100), Math.round(l * 100)];
    };
    const rgb = parse(color);
    if (op === "convert") {
      const [h, s, l] = toHsl(rgb);
      return {
        hex: toHex(rgb),
        rgb: `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`,
        hsl: `hsl(${h}, ${s}%, ${l}%)`,
      };
    }
    if (!other) throw new Error("other is required for op=contrast");
    const luminance = (c: RGB) => {
      const [r, g, b] = c.map((v) => {
        v /= 255;
        return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
      });
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const l1 = luminance(rgb);
    const l2 = luminance(parse(other));
    const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
    const rounded = Math.round(ratio * 100) / 100;
    return {
      ratio: rounded,
      aaNormal: ratio >= 4.5,
      aaLarge: ratio >= 3,
      aaaNormal: ratio >= 7,
    };
  },
});
