import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedHookOrCronToken } from "@/lib/hook-auth";
import { log } from "@/lib/logger";

/**
 * Agent Fleet tick (pg_cron, hourly — see 20261009160000_fleet_tick_cron.sql).
 * Authorised with `Bearer <hook-secret>` (MANOVIK_HOOK_SECRET) or the
 * per-database RPC cron token (vault-backed, resolved via
 * get_fleet_tick_token()) — same dual-auth shape as run-schedules.
 * Fails closed with 403 when neither matches. Runs every due fleet agent
 * sequentially with per-agent isolation.
 */
export const Route = createFileRoute("/api/public/hooks/agent-fleet-tick")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // The vault token function only exists after the fleet_tick_cron
        // migration is applied; until then, data is null and the hook-secret
        // path still works on its own.
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenData } = await supabaseAdmin.rpc("get_fleet_tick_token" as never);
        const cronToken = typeof tokenData === "string" ? tokenData : null;
        if (!isAuthorizedHookOrCronToken(request, cronToken)) {
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
