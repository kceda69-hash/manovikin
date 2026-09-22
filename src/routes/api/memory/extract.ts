import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { aiKeys, pickKeyIndex } from "@/lib/ai-key-failover";
import {
  buildExchangeText,
  shouldAttemptExtraction,
  extractMemoryFacts,
} from "@/lib/memory/extract.server";
import { storeMemoryFacts } from "@/lib/memory/store.server";

const Body = z.object({
  userText: z.string().max(1500),
  assistantText: z.string().max(2500),
  model: z.string().max(80).optional(),
});

/**
 * Client-triggered auto-memory extraction.
 *
 * Why this exists: the chat stream's onFinish used to run extraction as a
 * fire-and-forget promise, but Cloudflare Workers suspend the execution
 * context once the streaming Response completes — the background LLM call
 * and DB writes were silently killed. This endpoint runs extraction
 * synchronously inside its own request, so the worker stays alive until
 * the memories are stored. The client calls it (fire-and-forget) after
 * each completed turn.
 */
export const Route = createFileRoute("/api/memory/extract")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        try {
          const auth = request.headers.get("authorization") ?? "";
          const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
          if (!token) return new Response("Unauthorized", { status: 401 });
          const { data, error } = await supabaseAdmin.auth.getUser(token);
          const userId = data?.user?.id;
          if (error || !userId) return new Response("Unauthorized", { status: 401 });

          const json = await request.json().catch(() => null);
          const parsed = Body.safeParse(json);
          if (!parsed.success) return new Response("Bad request", { status: 400 });

          const exchange = buildExchangeText(parsed.data.userText, parsed.data.assistantText);
          if (!shouldAttemptExtraction(exchange)) {
            return Response.json({ ok: true, stored: 0, reason: "gate" });
          }

          const sovereign = !!process.env.MANOVIK_AI_BASE_URL;
          const apiKey = process.env.LOVABLE_API_KEY ?? "";
          const keys = aiKeys();
          const facts = await extractMemoryFacts(exchange, {
            model: parsed.data.model || process.env.MANOVIK_AI_MODEL || "gemini-3.8-flash",
            apiKey,
            sovereignKey: sovereign ? keys[pickKeyIndex()] : undefined,
          });
          if (facts.length === 0) {
            return Response.json({ ok: true, stored: 0, reason: "no-facts" });
          }
          const stored = await storeMemoryFacts(userId, facts);
          return Response.json({ ok: true, stored });
        } catch (e) {
          console.warn(
            "[auto-memory] extract endpoint failed:",
            e instanceof Error ? e.message : e,
          );
          return Response.json({ ok: false, stored: 0 }, { status: 500 });
        }
      },
    },
  },
});
