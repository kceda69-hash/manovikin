import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const Body = z.object({
  prompt: z.string().trim().min(1).max(20000),
  system: z.string().trim().max(4000).optional(),
  model: z.string().trim().max(80).optional(),
});

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

/**
 * Public MANOVIK API — POST /api/public/v1/ask
 * Auth: `Authorization: Bearer mnvk_...` (keys issued at /keys).
 */
export const Route = createFileRoute("/api/public/v1/ask")({
  server: {
    handlers: {
      OPTIONS: async () => new Response(null, { status: 204, headers: CORS }),
      POST: async ({ request }) => {
        const presented =
          request.headers
            .get("Authorization")
            ?.replace(/^Bearer\s+/i, "")
            .trim() ?? "";
        if (!presented.startsWith("mnvk_")) {
          return Response.json(
            { error: "Missing or malformed API key" },
            { status: 401, headers: CORS },
          );
        }

        const { createHash } = await import("node:crypto");
        const hash = createHash("sha256").update(presented).digest("hex");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: key } = await supabaseAdmin
          .from("manovik_api_keys")
          .select("id, user_id, scopes, revoked_at, expires_at, use_count")
          .eq("key_hash", hash)
          .maybeSingle();

        if (!key || key.revoked_at || (key.expires_at && new Date(key.expires_at) < new Date())) {
          return Response.json({ error: "Invalid API key" }, { status: 401, headers: CORS });
        }
        if (!(key.scopes as string[]).includes("ask")) {
          return Response.json(
            { error: "Key lacks the 'ask' scope" },
            { status: 403, headers: CORS },
          );
        }

        let body: z.infer<typeof Body>;
        try {
          body = Body.parse(await request.json());
        } catch {
          return Response.json({ error: "Invalid request body" }, { status: 400, headers: CORS });
        }

        try {
          const { askManovik } = await import("@/lib/mcp/ai-call");
          const result = await askManovik({
            prompt: body.prompt,
            system: body.system,
            model: body.model,
          });

          await supabaseAdmin
            .from("manovik_api_keys")
            .update({ last_used_at: new Date().toISOString(), use_count: (key.use_count ?? 0) + 1 })
            .eq("id", key.id);

          return Response.json(
            { answer: result.text, model: result.model, tier: result.tier },
            { headers: CORS },
          );
        } catch (err) {
          return Response.json(
            { error: String((err as Error)?.message ?? err) },
            { status: 502, headers: CORS },
          );
        }
      },
    },
  },
});
