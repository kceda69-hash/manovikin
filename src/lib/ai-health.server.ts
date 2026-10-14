/**
 * AI health probe: end-to-end verification of the production AI path.
 *
 * Sends a trivial prompt through the real model chain (manoStreamChain) and
 * asserts a non-empty response. This exercises the exact code path, secrets,
 * and model fallbacks a real chat uses — page-load checks and unit tests
 * cannot catch a silently-dead AI backend.
 *
 * Called by POST /api/public/hooks/ai-health (pg_cron every 15 min).
 * Results go to public.ai_health_checks; failures create de-duped alerts in
 * public.ai_health_alerts and email admins. Recovery auto-resolves open alerts.
 */
import { streamText } from "ai";
import { createLovableAiGatewayProvider, createFreeGptProvider } from "@/lib/ai-gateway";
import { manoStreamChain } from "@/lib/mano/mano1";
import { log } from "@/lib/logger";

const PROBE_PROMPT = "Reply with exactly one word: pong";
const PROBE_TIMEOUT_MS = 10_000;
// Worst case across the chain; must stay under the 60s client watchdog so a
// signed-in chat would still get its free-GPT fallback in time.
export const AI_HEALTH_BUDGET_MS = 50_000;

export interface AiHealthResult {
  ok: boolean;
  model: string | null;
  latencyMs: number;
  error: string | null;
  /** Per-model probe outcomes, for diagnostics. */
  attempts: Array<{ model: string; ok: boolean; latencyMs: number; error: string | null }>;
}

/** Probe one model; resolves with text or throws. */
async function probeModel(
  model: string,
  gateway: ReturnType<typeof createLovableAiGatewayProvider>,
): Promise<string> {
  const result = streamText({
    model: gateway(model),
    system: "You are a health probe. Follow the user instruction literally.",
    prompt: PROBE_PROMPT,
    temperature: 0,
    maxRetries: 0,
  });
  const reader = result.textStream.getReader();
  const deadlineAt = Date.now() + PROBE_TIMEOUT_MS;
  try {
    for (;;) {
      const remaining = deadlineAt - Date.now();
      if (remaining <= 0) throw new Error(`Timed out waiting for ${model}`);
      const raced = await Promise.race([
        reader.read().then((r) => ({ kind: "read" as const, ...r })),
        new Promise<{ kind: "timeout" }>((resolve) =>
          setTimeout(() => resolve({ kind: "timeout" as const }), remaining),
        ),
      ]);
      if (raced.kind === "timeout") throw new Error(`Timed out waiting for ${model}`);
      if (raced.done) throw new Error(`Empty response from ${model}`);
      if (raced.value) {
        const text = raced.value.trim();
        if (text) return text;
      }
    }
  } finally {
    try {
      await reader.cancel("probe-done");
    } catch {
      /* best effort */
    }
  }
}

/**
 * Run the end-to-end AI health probe. Tries each model in the production
 * chain (including the keyless free-GPT last resort); returns on the first
 * model that produces text.
 */
export async function runAiHealthProbe(): Promise<AiHealthResult> {
  const startedAt = Date.now();
  const chain = manoStreamChain(PROBE_PROMPT);
  const attempts: AiHealthResult["attempts"] = [];

  // The free-GPT fallback is keyless; try it last like the real chat path.
  const { FREE_GPT_MODEL } = await import("@/lib/ai-gateway");
  const freeGpt = { freeGpt: true as const, model: FREE_GPT_MODEL, label: "free-gpt" };

  for (const substrate of chain) {
    if (Date.now() - startedAt > AI_HEALTH_BUDGET_MS) break;
    const attemptStarted = Date.now();
    try {
      const gateway = createLovableAiGatewayProvider(process.env.LOVABLE_API_KEY ?? "");
      const text = await probeModel(substrate, gateway);
      const latencyMs = Date.now() - attemptStarted;
      attempts.push({ model: substrate, ok: true, latencyMs, error: null });
      return {
        ok: true,
        model: substrate,
        latencyMs: Date.now() - startedAt,
        error: null,
        attempts,
      };
    } catch (err) {
      const latencyMs = Date.now() - attemptStarted;
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ model: substrate, ok: false, latencyMs, error: message });
      log.warn("ai_health.probe_failed", { model: substrate, error: message });
    }
  }

  // Last resort: keyless free GPT, mirroring the chat path.
  if (Date.now() - startedAt <= AI_HEALTH_BUDGET_MS) {
    const attemptStarted = Date.now();
    try {
      const text = await probeModel(freeGpt.model, createFreeGptProvider() as never);
      const latencyMs = Date.now() - attemptStarted;
      attempts.push({ model: freeGpt.label, ok: true, latencyMs, error: null });
      return {
        ok: true,
        model: freeGpt.label,
        latencyMs: Date.now() - startedAt,
        error: null,
        attempts,
      };
    } catch (err) {
      const latencyMs = Date.now() - attemptStarted;
      const message = err instanceof Error ? err.message : String(err);
      attempts.push({ model: freeGpt.label, ok: false, latencyMs, error: message });
      log.warn("ai_health.probe_failed", { model: freeGpt.label, error: message });
    }
  }

  const latencyMs = Date.now() - startedAt;
  const error = attempts.length
    ? `All ${attempts.length} models failed; last: ${attempts[attempts.length - 1]!.error}`
    : "No models in chain";
  log.error("ai_health.all_failed", { attempts: attempts.length, latencyMs });
  return { ok: false, model: null, latencyMs, error, attempts };
}
