import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

/**
 * Sovereign-mode aware AI provider factory.
 *
 * MANOVIK AI can run in two modes:
 *
 * 1. Lovable-managed (default in Lovable preview):
 *    Uses ai.gateway.lovable.dev with LOVABLE_API_KEY.
 *
 * 2. Sovereign / self-hosted (Docker bundle, your own server):
 *    Set MANOVIK_AI_BASE_URL and MANOVIK_AI_API_KEY in your env to point
 *    at any OpenAI-compatible endpoint:
 *      - Ollama:   http://ollama:11434/v1   (key can be "ollama")
 *      - vLLM:     http://vllm:8000/v1
 *      - OpenAI:   https://api.openai.com/v1
 *      - OpenRouter, Together, Groq, LM Studio, etc.
 *
 * The gateway picks sovereign mode automatically when MANOVIK_AI_BASE_URL is set.
 */
export const createLovableAiGatewayProvider = (
  lovableApiKey: string,
  sovereignKeyOverride?: string,
) => {
  const sovereignBaseUrl = process.env.MANOVIK_AI_BASE_URL;
  const sovereignKey = sovereignKeyOverride ?? process.env.MANOVIK_AI_API_KEY;

  if (sovereignBaseUrl) {
    return createOpenAICompatible({
      name: "manovik-sovereign",
      baseURL: sovereignBaseUrl,
      headers: {
        Authorization: `Bearer ${sovereignKey ?? "manovik"}`,
      },
    });
  }

  return createOpenAICompatible({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: {
      "Lovable-API-Key": lovableApiKey,
      "X-Lovable-AIG-SDK": "vercel-ai-sdk",
    },
  });
};
