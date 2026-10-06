import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedHook } from "@/lib/hook-auth";
import { log } from "@/lib/logger";

/**
 * Agent Fleet tick (pg_cron, hourly).
 * Authorised with `Bearer <hook-secret>` (MANOVIK_HOOK_SECRET) — same shape
 * as the other hooks. Fails closed with 403 when the secret is missing or
 * wrong. Runs every due fleet agent sequentially with per-agent isolation.
 */
export const Route = createFileRoute("/api/public/hooks/agent-fleet-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedHook(request)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        try {
          const { runDueAgents } = await import("@/lib/agent-fleet/tick.server");
          const result = await runDueAgents();
          log.info("fleet_tick_completed", {
            checked: result.checked,
            ran: result.ran,
            succeeded: result.succeeded,
            failed: result.failed,
          });
          return Response.json(result, {
            headers: { "Content-Type": "application/json" } },
          );
        } catch (e) {
          // Fail closed: a broken tick must never pretend success.
          const message = e instanceof Error ? e.message : "fleet tick failed";
          log.error("fleet_tick_failed", { error: message.slice(0, 300) });
          return new Response(JSON.stringify({ ok: false, error: message.slice(0, 300) }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
      },
    },
  },
});
