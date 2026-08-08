import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const MAX_DOC_CHARS = 200_000;

/** List the signed-in user's knowledge documents. */
export const listMemoryDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;
    const { data, error } = await supabase
      .from("manovik_memory_docs")
      .select("id, title, source, status, chars, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return { docs: data ?? [] };
  });

/** Add a document: chunk it, embed each chunk, store both. */
export const addMemoryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        title: z.string().trim().min(1).max(200),
        content: z.string().trim().min(1).max(MAX_DOC_CHARS),
        source: z.string().trim().max(40).default("paste"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { chunkText, embedTexts } = await import("@/lib/memory/embed.server");

    const chunks = chunkText(data.content);
    if (chunks.length === 0) throw new Error("Nothing to store.");
    if (chunks.length > 400) throw new Error("Document too large — split it into smaller notes.");

    const { data: doc, error } = await supabase
      .from("manovik_memory_docs")
      .insert({
        user_id: userId,
        title: data.title,
        source: data.source,
        status: "indexing",
        chars: data.content.length,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    try {
      const vectors = await embedTexts(chunks);
      const rows = chunks.map((content, i) => ({
        doc_id: doc.id,
        user_id: userId,
        chunk_index: i,
        content,
        embedding: JSON.stringify(vectors[i] ?? []),
      }));
      for (let i = 0; i < rows.length; i += 100) {
        const { error: insErr } = await supabase.from("manovik_memory_chunks").insert(rows.slice(i, i + 100));
        if (insErr) throw new Error(insErr.message);
      }
      await supabase.from("manovik_memory_docs").update({ status: "ready" }).eq("id", doc.id);
      return { id: doc.id as string, chunks: chunks.length };
    } catch (err) {
      await supabase.from("manovik_memory_docs").update({ status: "failed" }).eq("id", doc.id);
      throw err;
    }
  });

export const deleteMemoryDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { error } = await supabase
      .from("manovik_memory_docs")
      .delete()
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Semantic search across the user's own memory. */
export const searchMemory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({ query: z.string().trim().min(1).max(2000), limit: z.number().int().min(1).max(12).default(6) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = context as Ctx;
    const { embedTexts } = await import("@/lib/memory/embed.server");
    const [vector] = await embedTexts([data.query]);
    if (!vector) return { matches: [] };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("manovik_match_memory" as never, {
      _user_id: userId,
      query_embedding: JSON.stringify(vector),
      match_count: data.limit,
    } as never);
    if (error) throw new Error(error.message);
    return { matches: (rows ?? []) as Array<{ id: string; doc_id: string; title: string; content: string; similarity: number }> };
  });
