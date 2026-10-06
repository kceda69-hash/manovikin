/**
 * Single choke point for AI model-id resolution.
 *
 * Root cause of the 2026-10-06 production 404s (models/<provider>/gemini-3.7-flash
 * is not found): the codebase uses gateway-style catalog ids (google/…,
 * openai/…) everywhere, but those only resolve on the Lovable AI gateway.
 * When the deployment points at its own OpenAI-compatible endpoint
 * (MANOVIK_AI_BASE_URL, e.g. Google's generativelanguage endpoint), the
 * provider prefix must NOT be sent — Google expects the bare model id.
 *
 * Rule: every place that puts a model id into a request body MUST pass it
 * through resolveEndpointModel() first. Never send a raw catalog id to the
 * wire.
 */

/** True when the deployment uses its own OpenAI-compatible endpoint. */
export function isSovereignEndpoint(): boolean {
  return ((process.env.MANOVIK_AI_BASE_URL ?? "").trim().length > 0);
}

/**
 * Resolve the model id to actually send to the backing endpoint.
 *
 * - Gateway mode (no MANOVIK_AI_BASE_URL): catalog id unchanged —
 *   the gateway understands provider/model ids.
 * - Sovereign mode: pin to the deployment's configured model
 *   (MANOVIK_AI_MODEL_ID for trained weights, else MANOVIK_AI_MODEL),
 *   falling back to the catalog id with any provider/ prefix stripped.
 */
export function resolveEndpointModel(catalogId: string): string {
  if (!isSovereignEndpoint()) return catalogId;
  return (
    process.env.MANOVIK_AI_MODEL_ID?.trim() ||
    process.env.MANOVIK_AI_MODEL?.trim() ||
    catalogId.replace(/^[a-z0-9_-]+\//i, "")
  );
}
