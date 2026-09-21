// Lightweight client-side error instrumentation.
// - Captures `error` + `unhandledrejection` globally
// - De-duplicates within a short window to avoid console spam
// - Logs structured records that show up in browser console + replay tools
// - Stays a no-op on the server
let installed = false;
const recent = new Map<string, number>();
const DEDUPE_MS = 2000;

function key(e: unknown): string {
  if (e instanceof Error) return `${e.name}:${e.message}`;
  try {
    return String(e).slice(0, 200);
  } catch {
    return "unknown";
  }
}

function report(
  kind: "error" | "unhandledrejection",
  err: unknown,
  extra?: Record<string, unknown>,
) {
  const k = `${kind}|${key(err)}`;
  const now = Date.now();
  const last = recent.get(k) ?? 0;
  if (now - last < DEDUPE_MS) return;
  recent.set(k, now);
  const rec = {
    kind,
    message: err instanceof Error ? err.message : String(err),
    stack: err instanceof Error ? err.stack : undefined,
    url: typeof location !== "undefined" ? location.href : undefined,
    ua: typeof navigator !== "undefined" ? navigator.userAgent : undefined,
    at: new Date(now).toISOString(),
    ...extra,
  };
  // eslint-disable-next-line no-console
  console.error("[manovik:client-error]", rec);
}

export function initClientErrorMonitor() {
  if (installed || typeof window === "undefined") return;
  installed = true;
  window.addEventListener("error", (e) => {
    report("error", e.error ?? e.message, {
      filename: e.filename,
      lineno: e.lineno,
      colno: e.colno,
    });
  });
  window.addEventListener("unhandledrejection", (e) => {
    report("unhandledrejection", e.reason);
  });
}
