// Server-only auto-memory storage for MANOVIK's Jarvis build (Phase 1).
//
// Persists extracted facts into the existing knowledge-memory tables
// (manovik_memory_docs / manovik_memory_chunks) with source='auto', so they
// flow through the same retrieval path as user-saved docs and show up in the
// /memory UI where the user can review or delete them.
//
// Defensive by design: never throws, enforces a per-user daily cap, and
// de-duplicates against existing memories so repeated topics don't pile up.
// Embeddings are best-effort — if the embedding endpoint is down, facts are
// still stored (with NULL vectors) and remain retrievable via the keyword
// fallback in retrieve.server.ts.

import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { chunkText, embedTexts } from "@/lib/memory/embed.server";
import { sanitizeMemoryText } from "@/lib/memory/retrieve.server";
import type { MemoryFact } from "@/lib/memory/extract.server";

const DAILY_AUTO_CAP = 25;
const SIMILARITY_SKIP_THRESHOLD = 0.88;

function startOfTodayUTC(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

/** Normalize for exact-duplicate comparison. Pure and testable. */
export function normalizeFact(fact: string): string {
  return (fact ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

async function dailyAutoCount(userId: string): Promise<number> {
  const { count, error } = await supabaseAdmin
    .from("manovik_memory_docs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("source", "auto")
    .gte("created_at", startOfTodayUTC());
  if (error) throw new Error(error.message);
  return count ?? 0;
}

async function existingChunkTexts(userId: string): Promise<Set<string>> {
  // Only pull recent chunks — dedupe is a guardrail, not an audit.
  const { data, error } = await supabaseAdmin
    .from("manovik_memory_chunks")
    .select("content")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(2000);
  if (error) throw new Error(error.message);
  return new Set((data ?? []).map((r) => normalizeFact(String(r.content ?? ""))));
}

/** Best-effort semantic dedupe; returns false (keep) when embeddings are down. */
async function isNearDuplicate(userId: string, fact: string): Promise<boolean> {
  try {
    const [vector] = await embedTexts([fact]);
    if (!vector) return false;
    const { data, error } = await supabaseAdmin.rpc(
      "manovik_match_memory" as never,
      {
        _user_id: userId,
        query_embedding: JSON.stringify(vector),
        match_count: 3,
      } as never,
    );
    if (error) return false;
    const rows = (data ?? []) as Array<{ similarity?: number }>;
    return rows.some((r) => (r.similarity ?? 0) >= SIMILARITY_SKIP_THRESHOLD);
  } catch {
    return false;
  }
}

/**
 * Store extracted facts. Returns the number of new memories saved.
 * Never throws — failures are logged and the turn is simply not memorized.
 */
export async function storeMemoryFacts(userId: string, facts: MemoryFact[]): Promise<number> {
  try {
    if (!userId || facts.length === 0) return 0;

    const used = await dailyAutoCount(userId);
    if (used >= DAILY_AUTO_CAP) {
      console.warn("[auto-memory] daily cap reached for user", userId);
      return 0;
    }

    const seen = await existingChunkTexts(userId);
    const fresh = facts.filter((f) => {
      const n = normalizeFact(f.fact);
      return n.length >= 10 && !seen.has(n);
    });
    if (fresh.length === 0) return 0;

    let saved = 0;
    for (const f of fresh.slice(0, 5)) {
      if (used + saved >= DAILY_AUTO_CAP) break;
      const clean = sanitizeMemoryText(f.fact, 500);
      if (clean.length < 10) continue;
      if (await isNearDuplicate(userId, clean)) continue;

      const title = `Auto-memory · ${f.category}`;
      const { data: doc, error: docErr } = await supabaseAdmin
        .from("manovik_memory_docs")
        .insert({
          user_id: userId,
          title,
          source: "auto",
          status: "indexing",
          chars: clean.length,
          metadata: { category: f.category, auto: true },
        })
        .select("id")
        .single();
      if (docErr || !doc) {
        console.warn("[auto-memory] doc insert failed:", docErr?.message);
        continue;
      }

      try {
        const chunks = chunkText(clean);
        let vectors: number[][] = [];
        try {
          vectors = await embedTexts(chunks);
        } catch (e) {
          // Embeddings down — store without vectors; keyword fallback still finds them.
          console.warn("[auto-memory] embedding skipped:", e instanceof Error ? e.message : e);
        }
        const rows = chunks.map((content, i) => ({
          doc_id: (doc as { id: string }).id,
          user_id: userId,
          chunk_index: i,
          content,
          embedding: vectors[i] ? JSON.stringify(vectors[i]) : null,
        }));
        const { error: chunkErr } = await supabaseAdmin
          .from("manovik_memory_chunks")
          .insert(rows as never);
        if (chunkErr) throw new Error(chunkErr.message);
        await supabaseAdmin
          .from("manovik_memory_docs")
          .update({ status: "ready" })
          .eq("id", (doc as { id: string }).id);
        saved += 1;
      } catch (e) {
        await supabaseAdmin
          .from("manovik_memory_docs")
          .update({ status: "failed" })
          .eq("id", (doc as { id: string }).id);
        console.warn("[auto-memory] chunk store failed:", e instanceof Error ? e.message : e);
      }
    }
    if (saved > 0) console.info("[auto-memory] stored", saved, "fact(s) for user", userId);
    return saved;
  } catch (e) {
    console.warn("[auto-memory] store skipped:", e instanceof Error ? e.message : e);
    return 0;
  }
}
