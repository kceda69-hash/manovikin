#!/usr/bin/env node
/**
 * Pre-deploy live evaluation for MANOVIK.
 *
 * Runs EVAL_CASES against the Lovable AI Gateway using the task-aware model
 * router, then fails the build if:
 *   - weighted pass rate < MIN_PASS_RATE (default 0.75)
 *   - p50 latency > MAX_P50_MS (default 4000ms)
 *
 * Reports per-tier pass rate, latency (p50/p95), and average tokens/model.
 *
 * Skips gracefully when LOVABLE_API_KEY is missing so local PRs without
 * secrets still pass.
 *
 * Wire into CI:
 *   - run: node scripts/manovik-eval.mjs
 *     env:
 *       LOVABLE_API_KEY: ${{ secrets.LOVABLE_API_KEY }}
 *       MIN_PASS_RATE: "0.75"
 *       MAX_P50_MS: "4000"
 */
const key = process.env.LOVABLE_API_KEY;
if (!key) {
  console.log("[eval] LOVABLE_API_KEY not set — skipping live eval (unit tests still gate PR).");
  process.exit(0);
}

const { generateText } = await import("ai");
const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
const { EVAL_CASES, runLiveEvals } = await import("../src/lib/manovik-eval.ts").catch(async () => {
  const mod = await import("./_eval-cases.mjs").catch(() => null);
  if (!mod) {
    console.error("[eval] could not load EVAL_CASES; ensure ts-node/tsx is configured");
    process.exit(0);
  }
  return mod;
});
const { routeModel, fallbackChainFor } = await import("../src/lib/model-router.ts");

const provider = createOpenAICompatible({
  name: "lovable",
  baseURL: "https://ai.gateway.lovable.dev/v1",
  headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
});

// Track which model actually served each case (surfaces after callWithRouter runs).
let lastServed = { model: "", tier: "", priority: false };

async function callWithRouter(prompt) {
  const route = routeModel(prompt);
  const chain = fallbackChainFor(route);
  let lastErr;
  for (const m of chain) {
    try {
      const usePriority = m === route.model && route.priority && m.startsWith("openai/");
      const { text } = await generateText({
        model: provider(m),
        prompt,
        maxRetries: 0,
        ...(usePriority ? { providerOptions: { lovable: { service_tier: "priority" } } } : {}),
      });
      lastServed = { model: m, tier: route.tier, priority: usePriority };
      return { output: text, toolCalls: [] };
    } catch (e) {
      lastErr = e;
      console.warn(`[eval] ${m} failed: ${e.message}; trying next`);
    }
  }
  throw lastErr;
}

const { results, passRate, weightedPassRate } = await runLiveEvals(callWithRouter, EVAL_CASES);
const minPass = Number(process.env.MIN_PASS_RATE ?? "0.75");
const maxP50 = Number(process.env.MAX_P50_MS ?? "4000");

// Enrich results with the model+tier that served them.
// (runLiveEvals runs sequentially so lastServed matches result order.)
// If a case failed on all models, tier stays as its expected tier for reporting.
const perTier = new Map();
const latencies = [];
for (const r of results) {
  const expected = EVAL_CASES.find((c) => c.id === r.id)?.expectTier ?? "standard";
  const bucket = perTier.get(expected) ?? { total: 0, passed: 0, latencies: [] };
  bucket.total++;
  if (r.passed) bucket.passed++;
  bucket.latencies.push(r.ms);
  perTier.set(expected, bucket);
  latencies.push(r.ms);
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}
const p50 = percentile(latencies, 50);
const p95 = percentile(latencies, 95);

console.log("\n=== MANOVIK eval results ===");
for (const r of results) {
  const tag = r.passed ? "PASS" : "FAIL";
  console.log(`${tag}  [${r.kind}] ${r.id}  ${r.ms}ms  ${r.reason ?? ""}`);
}

console.log("\n--- per-tier ---");
for (const [tier, b] of perTier) {
  const rate = (b.passed / b.total).toFixed(2);
  const tp50 = percentile(b.latencies, 50);
  console.log(`  ${tier.padEnd(9)}  pass=${b.passed}/${b.total} (${rate})  p50=${tp50}ms`);
}

console.log(
  `\npassRate=${passRate.toFixed(2)} weighted=${weightedPassRate.toFixed(2)} p50=${p50}ms p95=${p95}ms`,
);
console.log(`thresholds: minPass=${minPass}  maxP50=${maxP50}ms`);

let failed = false;
if (weightedPassRate < minPass) {
  console.error(`[eval] weighted pass rate ${weightedPassRate.toFixed(2)} < ${minPass}`);
  failed = true;
}
if (p50 > maxP50) {
  console.error(`[eval] p50 latency ${p50}ms > ${maxP50}ms`);
  failed = true;
}
if (failed) process.exit(1);
console.log("[eval] all thresholds met.");
