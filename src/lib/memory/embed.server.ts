// Server-only embedding bridge for MANOVIK Knowledge Memory.
// Uses the Lovable AI Gateway embeddings endpoint (OpenAI-compatible).
// 1536 dims matches the `vector(1536)` column on manovik_memory_chunks.

const EMBED_URL = "https://ai.gateway.lovable.dev/v1/embeddings";
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
  const key = process.env["LOVABLE_API_KEY"];
  if (!key) throw new Error("MANOVIK memory is not configured on this deployment.");

  const out: number[][] = [];
  // OpenAI accepts large batches; keep them modest for latency and error isolation.
  for (let i = 0; i < inputs.length; i += 64) {
    const batch = inputs.slice(i, i + 64);
    const res = await fetch(EMBED_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Lovable-API-Key": key },
      body: JSON.stringify({ model: EMBED_MODEL, input: batch, dimensions: EMBED_DIMS }),
    });
    if (!res.ok) {
      const detail = await res.text();
      if (res.status === 429) throw new Error("Embedding rate limit reached. Retry shortly.");
      if (res.status === 402) throw new Error("AI credits exhausted for this workspace.");
      throw new Error(`Embedding failed [${res.status}]: ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { data?: Array<{ index: number; embedding: number[] }> };
    const rows = (json.data ?? []).slice().sort((a, b) => a.index - b.index);
    for (const r of rows) out.push(r.embedding);
  }
  return out;
}
