// Structured JSON logger for MANOVIK server code. Logs are single-line JSON so
// they parse cleanly in Cloudflare Workers tail logs and external pipelines.
// Never log secrets, raw API keys, full prompts, or PII — only redacted summaries.

type Level = "debug" | "info" | "warn" | "error";

function emit(level: Level, event: string, data: Record<string, unknown> = {}) {
  const safe: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (/key|secret|token|password|authorization/i.test(k)) {
      safe[k] = "[redacted]";
      continue;
    }
    if (typeof v === "string" && v.length > 500) {
      safe[k] = v.slice(0, 500) + `…(+${v.length - 500})`;
    } else {
      safe[k] = v;
    }
  }
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    service: "manovik",
    event,
    ...safe,
  });
  const fn = level === "error" ? console.error : level === "warn" ? console.warn : console.log;
  fn(line);
}

export const log = {
  debug: (event: string, data?: Record<string, unknown>) => emit("debug", event, data),
  info: (event: string, data?: Record<string, unknown>) => emit("info", event, data),
  warn: (event: string, data?: Record<string, unknown>) => emit("warn", event, data),
  error: (event: string, data?: Record<string, unknown>) => emit("error", event, data),
};
