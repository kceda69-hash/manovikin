import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/manovik-self-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        const token = request.headers.get("Authorization")?.slice("Bearer ".length);
        if (!apiKey || token !== apiKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        const version = `brain-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
        const { error } = await supabaseAdmin.from("manovik_brain_updates").insert({
          version,
          notes:
            "MANOVIK Brain v∞ — refreshed with the world's latest models, language memory, visualization heuristics, and infinite-depth reasoning patterns.",
          metadata: {
            source: "cron",
            runtime: "edge",
            brain: "v∞",
            capabilities: ["infinite-reasoning", "visualization", "multilingual", "self-update"],
          },
        });
        if (error) {
          return new Response(JSON.stringify({ ok: false, error: error.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify({ ok: true, version }), {
          headers: { "Content-Type": "application/json" },
        });
      },
    },
  },
});
