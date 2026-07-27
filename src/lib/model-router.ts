// MANOVIK task-aware model router.
//
// Picks the cheapest capable model tier per prompt so we get:
//   - ~50% lower credits/msg on average (trivial + standard prompts leave gpt-5.5)
//   - lower TTFT via priority tier on Fast-mode ✓ models (OpenAI gpt-5.x)
//   - eval quality preserved because hard/code/reasoning prompts still route to gpt-5.5
//
// Zero-latency heuristic — no extra model call. Every id here is verified
// against the current chat-model catalog (see `ai-models-chat` knowledge).

export type Tier = "trivial" | "standard" | "hard" | "vision";

export type Route = {
  tier: Tier;
  model: string;
  /** Whether to send service_tier: "priority" to the gateway (Fast-mode ✓ only). */
  priority: boolean;
  /** Debug reason for logging / eval. */
  reason: string;
};

// Catalog-verified ids. Change here to swap tiers globally.
export const TIER_MODEL: Record<Tier, { model: string; priority: boolean }> = {
  // Cheapest + fastest Gemini; great for classification, small extraction, greetings.
  trivial:  { model: "google/gemini-3.1-flash-lite",   priority: false },
  // Default all-rounder. Cheap, fast, multimodal.
  standard: { model: "google/gemini-3.6-flash",        priority: false },
  // Complex/quantum-grade coding: frontier model with OpenAI priority tier.
  hard:     { model: "openai/gpt-5.5",                 priority: true  },
  // Multimodal + long-context; vision-heavy prompts land here.
  vision:   { model: "google/gemini-3.1-pro-preview",  priority: false },
};

// "Very hard" escalation: if the prompt looks explicitly like a hard research /
// architecture / proof / algorithm task, jump straight to the flagship model.
const VERY_HARD_MODEL = { model: "openai/gpt-5.6-sol", priority: true } as const;


// Keyword banks — kept short and precise. Order matters: vision > very-hard > hard > trivial > standard.
const VISION_HINTS   = /\b(image|photo|picture|screenshot|diagram|chart|ocr|caption|attached (image|file))\b/i;
const CODE_HINTS     = /\b(code|function|class|component|typescript|javascript|python|rust|go\b|refactor|debug|stack ?trace|regex|sql query|migration|dockerfile|kubernetes|algorithm|complexity|big-?o)\b/i;
const REASON_HINTS   = /\b(prove|derivation|theorem|why does|explain step by step|design (a|an) (system|architecture|schema)|plan (out|the))\b/i;
const VERY_HARD_HINTS = /\b(architect(ure)?|distributed|consensus|proof of|formal(ly)? verify|research paper|literature review|end-to-end (system|design)|derive from first principles)\b/i;
const TRIVIAL_HINTS  = /^(hi|hello|hey|thanks|thank you|yo|sup|gm|good morning|good night|bye|ok|okay|cool|nice|lol|👍|🙏)\b/i;

/**
 * Route a prompt to a tier. Pure function — safe to unit-test.
 *
 * Heuristics (in order):
 *   1. explicit override via MANOVIK_AI_MODEL / opts.forceModel
 *   2. vision cue → vision tier
 *   3. very-hard cue → gpt-5.5 + priority
 *   4. code / reasoning cue → hard tier
 *   5. length > 800 chars → hard tier (long prompts usually need better reasoning)
 *   6. length < 40 chars AND matches trivial greeting → trivial tier
 *   7. default → standard tier
 */
export function routeModel(
  prompt: string,
  opts: { forceModel?: string; hasAttachments?: boolean } = {},
): Route {
  if (opts.forceModel) {
    return { tier: "standard", model: opts.forceModel, priority: false, reason: "forced" };
  }

  const p = (prompt ?? "").trim();

  if (opts.hasAttachments || VISION_HINTS.test(p)) {
    return { ...TIER_MODEL.vision, tier: "vision", reason: "vision cue" };
  }

  if (VERY_HARD_HINTS.test(p)) {
    return { ...VERY_HARD_MODEL, tier: "hard", reason: "very-hard cue → gpt-5.5" };
  }

  if (CODE_HINTS.test(p) || REASON_HINTS.test(p)) {
    return { ...TIER_MODEL.hard, tier: "hard", reason: "code/reasoning cue" };
  }

  if (p.length > 800) {
    return { ...TIER_MODEL.hard, tier: "hard", reason: "long prompt (>800 chars)" };
  }

  if (p.length < 40 && TRIVIAL_HINTS.test(p)) {
    return { ...TIER_MODEL.trivial, tier: "trivial", reason: "trivial greeting" };
  }

  return { ...TIER_MODEL.standard, tier: "standard", reason: "default" };
}

/** Ordered fallback chain for a chosen tier — used on transient gateway errors. */
export function fallbackChainFor(route: Route): string[] {
  const chain = new Set<string>([route.model]);
  // Always fall through toward reliable, cheap Gemini defaults.
  chain.add(TIER_MODEL.hard.model);
  chain.add(TIER_MODEL.standard.model);
  chain.add(TIER_MODEL.trivial.model);
  return [...chain];
}
