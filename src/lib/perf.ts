// Lightweight web-vitals + long-task monitor. Zero deps. No-op on SSR.
// Logs to console in dev; in prod hooks into sendBeacon to /api/perf if you add one.

type Metric = { name: string; value: number; rating?: string };

const SLOW = { LCP: 2500, INP: 200, CLS: 0.1, FCP: 1800, TTFB: 800 } as const;

function rate(name: keyof typeof SLOW, v: number) {
  return v <= SLOW[name] ? "good" : v <= SLOW[name] * 1.5 ? "needs-improvement" : "poor";
}

function report(m: Metric) {
  // eslint-disable-next-line no-console
  if (m.rating === "poor") console.warn(`[perf] ${m.name}=${m.value.toFixed(1)} (${m.rating})`);
}

export function initPerf() {
  if (typeof window === "undefined" || (window as any).__perfInit) return;
  (window as any).__perfInit = true;

  try {
    // LCP
    new PerformanceObserver((list) => {
      const e = list.getEntries().at(-1) as PerformanceEntry & { renderTime?: number; loadTime?: number };
      const v = (e as any).renderTime || (e as any).loadTime || e.startTime;
      report({ name: "LCP", value: v, rating: rate("LCP", v) });
    }).observe({ type: "largest-contentful-paint", buffered: true });

    // CLS
    let cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any[]) if (!e.hadRecentInput) cls += e.value;
      report({ name: "CLS", value: cls, rating: rate("CLS", cls) });
    }).observe({ type: "layout-shift", buffered: true });

    // INP (event timing)
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as any[]) {
        if (e.duration > 40) report({ name: "INP", value: e.duration, rating: rate("INP", e.duration) });
      }
    }).observe({ type: "event", buffered: true, durationThreshold: 40 } as any);

    // Long tasks
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.duration > 100) report({ name: "LongTask", value: e.duration, rating: "poor" });
      }
    }).observe({ type: "longtask", buffered: true });

    // Errors
    window.addEventListener("error", (e) => console.error("[perf:error]", e.message));
    window.addEventListener("unhandledrejection", (e) => console.error("[perf:rejection]", e.reason));
  } catch {
    // some browsers throw on unsupported entry types — safe to ignore
  }
}
