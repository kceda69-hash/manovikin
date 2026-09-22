// Server-only embedding bridge for MANOVIK Knowledge Memory.
// Sovereign-first: uses MANOVIK_AI_BASE_URL + MANOVIK_AI_EMBED_MODEL when set
// (any OpenAI-compatible /v1/embeddings endpoint, e.g. Ollama with
// nomic-embed-text — note the DB column expects EMBED_DIMS dimensions).
// Falls back to the Lovable AI Gateway embeddings endpoint otherwise.
// 1536 dims matches the `vector(1536)` column on manovik_memory_chunks.

const GATEWAY_EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
export const EMBED_MODEL = "openai/text-embedding-3-small";
export const EMBED_DIMS = 1536;

/** Split long text into overlapping chunks that stay well inside the token cap. */
export function chunkText(text: string, size = 1200, overlap = 150): string[] {
  const clean = text.replace(/\r\n/g, "\n").trim();
  if (!clean) return [];
  const chunks: string[] = [];
  let i = 0;
  while (i < clean.length) {
    chunks.push(clean.slice(i, i + size));
    if (i + size >= clean.length) break;
    i += size - overlap;
  }
  return chunks;
}

export async function embedTexts(inputs: string[]): Promise<number[][]> {
  if (inputs.length === 0) return [];

  const sovereignBaseUrl = process.env.MANOVIK_AI_BASE_URL;
  const sovereignKey = process.env.MANOVIK_AI_API_KEY;
  const lovableKey = process.env["LOVABLE_API_KEY"];

  let url: string;
  let headers: Record<string, string>;
  let body: Record<string, unknown>;
  if (sovereignBaseUrl) {
    // Any OpenAI-compatible embeddings endpoint. The model must return
    // EMBED_DIMS-dimensional vectors to match the manovik_memory_chunks column.
    url = `${sovereignBaseUrl.replace(/\/$/, "")}/embeddings`;
    headers = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${sovereignKey ?? "manovik"}`,
    };
    body = {
      model: process.env.MANOVIK_AI_EMBED_MODEL ?? "text-embedding-004",
      input: [] as string[],
      // OpenAI-compatible param name; request 1536 dims to match the DB column.
      dimensions: EMBED_DIMS,
    };
  } else {
    if (!lovableKey) throw new Error("MANOVIK memory is not configured on this deployment.");
    url = GATEWAY_EMBED_URL;
    headers = { "Content-Type": "application/json", "Lovable-API-Key": lovableKey };
    body = { model: EMBED_MODEL, input: [] as string[], dimensions: EMBED_DIMS };
  }

  const out: number[][] = [];
  // OpenAI accepts large batches; keep them modest for latency and error isolation.
  for (let i = 0; i < inputs.length; i += 64) {
    const batch = inputs.slice(i, i + 64);
    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ ...body, input: batch }),
    });
    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) throw new Error("Embedding rate limit reached. Retry shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Embedding failed [${res.status}]: ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
    const rows = (json.data ?? []).slice().sort((a, b) => a.index - b.index);
    for (const r of rows) {
      if (r.embedding.length !== EMBED_DIMS) {
        throw new Error(
          `Embedding model returned ${r.embedding.length} dimensions, but MANOVIK memory needs ${EMBED_DIMS}. ` +
            `Set MANOVIK_AI_EMBED_MODEL to a ${EMBED_DIMS}-dimensional model on your sovereign endpoint.`,
        );
      }
      out.push(r.embedding);
    }
  }
  return out;
}
