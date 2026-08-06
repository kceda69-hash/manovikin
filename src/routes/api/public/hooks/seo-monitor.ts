import { createFileRoute } from "@tanstack/react-router";

// Scheduled SEO monitoring. Called by pg_cron with the internal bearer token.
export const Route = createFileRoute("/api/public/hooks/seo-monitor")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        const token = request.headers.get("Authorization")?.slice("Bearer ".length);
        if (!apiKey || token !== apiKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
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
