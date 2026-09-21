import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";
import { hookSecret } from "@/lib/hook-auth";

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Scheduled agents tick (pg_cron, hourly).
 * Authorised with `Bearer <hook-secret>` (MANOVIK_HOOK_SECRET, or
 * LOVABLE_API_KEY on Lovable-cloud deployments) — same shape as the other hooks.
 */
export const Route = createFileRoute("/api/public/hooks/run-schedules")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!got) return Response.json({ error: "Forbidden" }, { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenData } = await supabaseAdmin.rpc("get_schedules_run_token" as never);
        const cronToken = typeof tokenData === "string" ? tokenData : null;
        const apiKey = hookSecret();

        const authorised =
          (cronToken && safeEqual(got, cronToken)) || (apiKey && safeEqual(got, apiKey));
        if (!authorised) return Response.json({ error: "Forbidden" }, { status: 403 });
        try {
          const { runDueSchedules } = await import("@/lib/schedules/runner.server");
          return Response.json({ ok: true, ...(await runDueSchedules()) });
        } catch (err) {
          return Response.json(
            { ok: false, error: String((err as Error)?.message ?? err) },
            { status: 500 },
          );
        }
      },
    },
  },
});
