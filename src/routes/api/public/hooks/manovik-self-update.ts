import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { isAuthorizedHook } from "@/lib/hook-auth";
import { log } from "@/lib/logger";

export const Route = createFileRoute("/api/public/hooks/manovik-self-update")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedHook(request)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        try {
          const { fetchTechRadar } = await import("@/lib/self-update/tech-radar.server");
          const { refreshKnowledge } = await import("@/lib/self-update/knowledge-refresh.server");

          // 1. Fetch the tech radar (models, CVEs, headlines). One source
          //    failing never kills the run — fetchTechRadar isolates them.
          const items = await fetchTechRadar();

          // 2. Dedupe against recent brain updates and persist the new ones.
          //    eslint-disable-next-line @typescript-eslint/no-explicit-any
          const summary = await refreshKnowledge(supabaseAdmin as any, items);

          log.info("self_update_completed", {
            version: summary.version,
            newItems: summary.newItems,
            totalItems: summary.totalItems,
            inserted: summary.inserted,
          });
          return Response.json(
            {
              ok: true,
              version: summary.version,
              newItems: summary.newItems,
              totalItems: summary.totalItems,
              learnings: summary.learnings.length,
              inserted: summary.inserted,
            },
            { headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          // Fail closed: a broken radar run must never pretend success.
          const message = e instanceof Error ? e.message : "self-update failed";
          log.error("self_update_failed", { error: message.slice(0, 300) });
          return new Response(JSON.stringify({ ok: false, error: message.slice(0, 300) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
