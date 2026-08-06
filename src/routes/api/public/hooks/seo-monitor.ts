import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/** Constant-time compare; false on length mismatch. */
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
 * Scheduled SEO monitoring (pg_cron, daily).
 * Authorised with `Bearer <vault:seo_monitor_token>` — the same pattern as the
 * security self-scan hook. LOVABLE_API_KEY is also accepted for manual runs.
 */
export const Route = createFileRoute("/api/public/hooks/seo-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        if (!got) return Response.json({ error: "Forbidden" }, { status: 403 });

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenData } = await supabaseAdmin.rpc("get_seo_monitor_token" as never);
        const expected = typeof tokenData === "string" ? tokenData : null;
        const apiKey = process.env.LOVABLE_API_KEY;

        const authorised =
          (expected && safeEqual(got, expected)) || (apiKey && safeEqual(got, apiKey));
        if (!authorised) return Response.json({ error: "Forbidden" }, { status: 403 });

        try {
          const { runSeoMonitor } = await import("@/lib/seo-monitor.server");
          const result = await runSeoMonitor();
          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("[seo-monitor]", e);
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
