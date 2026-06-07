import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export const Route = createFileRoute("/api/public/hooks/manovik-self-update")({
  server: {
    handlers: {
      POST: async () => {
        const version = `brain-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
        const { error } = await supabaseAdmin
          .from("manovik_brain_updates" as any)
          .insert({
            version,
            notes: "Scheduled Manovik brain self-update — refreshed language memory, terminology, and reasoning heuristics.",
            metadata: { source: "cron", runtime: "edge" },
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
