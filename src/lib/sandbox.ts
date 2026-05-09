// Sandboxed execution layer for agent tool calls.
// - Strict allow-list of tool names
// - Per-tool timeout (ms)
// - Output size cap (bytes)
// - Per-user rate limiting (in-memory; per-isolate)
// - Structured result for audit logs
import { z } from "zod";

export type ToolResult = {
  ok: boolean;
  output?: unknown;
  error?: string;
  durationMs: number;
  truncated?: boolean;
};

export type ToolDef<I = unknown> = {
  name: string;
  description: string;
  schema: z.ZodType<I>;
  timeoutMs: number;
  maxOutputBytes: number;
  // Per-user calls per minute
  rateLimitPerMin: number;
  execute: (input: I, ctx: { userId: string; signal: AbortSignal }) => Promise<unknown>;
};

// ---- in-memory rate limiter (best-effort; per worker isolate) ----
const buckets = new Map<string, number[]>();
function rateLimit(key: string, limit: number) {
  const now = Date.now();
  const windowStart = now - 60_000;
  const arr = (buckets.get(key) ?? []).filter((t) => t > windowStart);
  if (arr.length >= limit) return false;
  arr.push(now);
  buckets.set(key, arr);
  return true;
}

function withTimeout<T>(p: (signal: AbortSignal) => Promise<T>, ms: number): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(new Error(`Timeout after ${ms}ms`)), ms);
  return p(ctrl.signal).finally(() => clearTimeout(timer));
}

function capOutput(value: unknown, maxBytes: number): { value: unknown; truncated: boolean } {
  let json: string;
  try {
    json = typeof value === "string" ? value : JSON.stringify(value);
  } catch {
    return { value: "[unserializable]", truncated: true };
  }
  if (json.length > maxBytes) {
    return { value: json.slice(0, maxBytes) + "…[truncated]", truncated: true };
  }
  return { value, truncated: false };
}

export class Sandbox {
  private registry = new Map<string, ToolDef<unknown>>();

  register<I>(tool: ToolDef<I>) {
    this.registry.set(tool.name, tool as unknown as ToolDef<unknown>);
  }

  list() {
    return Array.from(this.registry.values()).map((t) => ({
      name: t.name,
      description: t.description,
    }));
  }

  has(name: string) {
    return this.registry.has(name);
  }

  async run(name: string, rawInput: unknown, userId: string): Promise<ToolResult> {
    const start = Date.now();
    const tool = this.registry.get(name);
    if (!tool) {
      return { ok: false, error: `Tool "${name}" is not whitelisted`, durationMs: 0 };
    }
    if (!rateLimit(`${userId}:${name}`, tool.rateLimitPerMin)) {
      return {
        ok: false,
        error: `Rate limit exceeded for ${name} (${tool.rateLimitPerMin}/min)`,
        durationMs: Date.now() - start,
      };
    }
    const parsed = tool.schema.safeParse(rawInput);
    if (!parsed.success) {
      return {
        ok: false,
        error: `Invalid input: ${parsed.error.issues.map((i) => i.message).join("; ")}`,
        durationMs: Date.now() - start,
      };
    }
    try {
      const result = await withTimeout(
        (signal) => tool.execute(parsed.data, { userId, signal }),
        tool.timeoutMs,
      );
      const { value, truncated } = capOutput(result, tool.maxOutputBytes);
      return { ok: true, output: value, durationMs: Date.now() - start, truncated };
    } catch (err) {
      return {
        ok: false,
        error: String((err as Error)?.message ?? err).slice(0, 500),
        durationMs: Date.now() - start,
      };
    }
  }
}
