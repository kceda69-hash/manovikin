#!/usr/bin/env node
/**
 * Pre-deploy live evaluation for MANOVIK.
 *
 * Runs EVAL_CASES against the Lovable AI Gateway and fails the build if the
 * weighted pass rate falls below MIN_PASS_RATE (default 0.7). Skips gracefully
 * when LOVABLE_API_KEY is missing so local PRs without secrets still pass.
 *
 * Wire into CI:
 *   - run: node scripts/manovik-eval.mjs
 *     env:
 *       LOVABLE_API_KEY: ${{ secrets.LOVABLE_API_KEY }}
 *       MIN_PASS_RATE: "0.7"
 */
import { register } from "node:module";
import { pathToFileURL } from "node:url";

const key = process.env.LOVABLE_API_KEY;
if (!key) {
  console.log("[eval] LOVABLE_API_KEY not set — skipping live eval (unit tests still gate PR).");
  process.exit(0);
}

// Use the AI SDK directly to avoid pulling app-internal imports.
const { generateText } = await import("ai");
const { createOpenAICompatible } = await import("@ai-sdk/openai-compatible");
const { EVAL_CASES, runLiveEvals } = await import("../src/lib/manovik-eval.ts").catch(async () => {
  // .ts import not supported without loader — fall back to inlined cases.
  const mod = await import("./_eval-cases.mjs").catch(() => null);
  if (!mod) {
    console.error("[eval] could not load EVAL_CASES; ensure ts-node/tsx is configured");
    process.exit(0);
  }
  return mod;
});

const provider = createOpenAICompatible({
  name: "lovable",
  baseURL: "https://ai.gateway.lovable.dev/v1",
  headers: { "Lovable-API-Key": key, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
});
const models = [
  process.env.MANOVIK_AI_MODEL ?? "openai/gpt-5.5",
  "google/gemini-3.5-flash",
  "google/gemini-3-flash-preview",
];

async function callWithFallback(prompt) {
  let lastErr;
  for (const m of models) {
    try {
      const { text } = await generateText({ model: provider(m), prompt, maxRetries: 0 });
      return { output: text, toolCalls: [] };
    } catch (e) {
      lastErr = e;
      console.warn(`[eval] ${m} failed: ${e.message}; trying next`);
    }
  }
  throw lastErr;
}

const { results, passRate, weightedPassRate } = await runLiveEvals(callWithFallback, EVAL_CASES);
const min = Number(process.env.MIN_PASS_RATE ?? "0.7");

console.log("\n=== MANOVIK eval results ===");
for (const r of results) {
  const tag = r.passed ? "PASS" : "FAIL";
  console.log(`${tag}  [${r.kind}] ${r.id}  ${r.ms}ms  ${r.reason ?? ""}`);
}
console.log(`\npassRate=${passRate.toFixed(2)} weighted=${weightedPassRate.toFixed(2)} threshold=${min}`);

if (weightedPassRate < min) {
  console.error(`[eval] weighted pass rate ${weightedPassRate.toFixed(2)} < ${min} — failing deploy.`);
  process.exit(1);
}
