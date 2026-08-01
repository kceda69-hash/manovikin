// Reference data for MANOVIK supply-chain & model-provenance scanning.
// Pure data — no runtime deps, safe to import from tests and the browser.

/** Registries we consider trustworthy for resolved package tarballs. */
export const TRUSTED_REGISTRY_HOSTS = [
  "registry.npmjs.org",
  "registry.yarnpkg.com",
];

/** Hosts allowed to receive model/inference traffic. */
export const TRUSTED_AI_HOSTS = [
  "ai.gateway.lovable.dev",
  "connector-gateway.lovable.dev",
];

/**
 * Model ids MANOVIK is allowed to call. Anything outside this list is
 * unverified provenance: the gateway rejects unknown ids at runtime (400),
 * so an unlisted id is a hard failure, not a style issue.
 */
export const APPROVED_MODEL_IDS = [
  // chat / reasoning
  "google/gemini-3-flash-preview",
  "google/gemini-3.1-flash-lite",
  "google/gemini-3.5-flash",
  "google/gemini-3.6-flash",
  "google/gemini-3.1-pro-preview",
  "google/gemini-2.5-pro",
  "google/gemini-2.5-flash",
  "google/gemini-2.5-flash-lite",
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5-nano",
  "openai/gpt-5.2",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.4-nano",
  "openai/gpt-5.4-pro",
  "openai/gpt-5.5",
  "openai/gpt-5.5-pro",
  "openai/gpt-5.6-sol",
  "openai/gpt-5.6-terra",
  "openai/gpt-5.6-luna",
  // image
  "google/gemini-2.5-flash-image",
  "google/gemini-3-pro-image",
  "google/gemini-3.1-flash-image",
];

/** Models that support the OpenAI priority ("fast mode") serving tier. */
export const PRIORITY_CAPABLE_MODELS = [
  "openai/gpt-5",
  "openai/gpt-5-mini",
  "openai/gpt-5.2",
  "openai/gpt-5.4",
  "openai/gpt-5.4-mini",
  "openai/gpt-5.5",
  "openai/gpt-5.6-sol",
  "openai/gpt-5.6-terra",
  "openai/gpt-5.6-luna",
];

/** Models that must be called with reasoning_effort: "none". */
export const REASONING_NONE_REQUIRED = /^openai\/gpt-5\.6-/;

/**
 * Package names + version ranges with publicly documented malicious releases.
 * Matching is by name; the note tells the operator which versions to avoid.
 */
export const KNOWN_COMPROMISED_PACKAGES: Record<string, string> = {
  "event-stream": "3.3.6 shipped the flatmap-stream crypto stealer.",
  "flatmap-stream": "Malicious by design — remove entirely.",
  "node-ipc": "9.2.2/11.0.0 shipped destructive protestware payloads.",
  "ua-parser-js": "0.7.29 / 0.8.0 / 1.0.0 were hijacked with a coin miner.",
  "coa": "2.0.3+ patch releases were hijacked.",
  "rc": "1.2.9 / 1.3.9 / 2.3.9 were hijacked.",
  colors: "1.4.44-liberty-2 was sabotaged with an infinite loop.",
  faker: "6.6.6 was sabotaged by the maintainer.",
  "@lottiefiles/lottie-player": "2.0.5-2.0.7 shipped a wallet-drainer.",
};

/** High-traffic packages typosquatters imitate. */
export const TYPOSQUAT_TARGETS = [
  "react",
  "react-dom",
  "zod",
  "vite",
  "typescript",
  "tailwindcss",
  "lodash",
  "axios",
  "express",
  "next",
  "eslint",
  "vitest",
  "sonner",
  "recharts",
];

/** Env var names that indicate a direct third-party AI provider bypassing the gateway. */
export const DIRECT_AI_PROVIDER_ENV = [
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GOOGLE_API_KEY",
  "GEMINI_API_KEY",
  "GROQ_API_KEY",
  "MISTRAL_API_KEY",
  "TOGETHER_API_KEY",
  "REPLICATE_API_TOKEN",
  "HUGGINGFACE_API_KEY",
  "OPENROUTER_API_KEY",
  "PERPLEXITY_API_KEY",
  "XAI_API_KEY",
  "DEEPSEEK_API_KEY",
];

/** Levenshtein distance, capped for short package names. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  const m = a.length;
  const n = b.length;
  if (Math.abs(m - n) > 2) return 3;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) {
      cur[j] = Math.min(
        (prev[j] ?? 0) + 1,
        (cur[j - 1] ?? 0) + 1,
        (prev[j - 1] ?? 0) + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[n] ?? 3;
}
