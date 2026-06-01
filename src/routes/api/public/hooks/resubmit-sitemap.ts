import { createFileRoute } from "@tanstack/react-router";
import { submitSitemap } from "@/lib/seo.functions";

export const Route = createFileRoute("/api/public/hooks/resubmit-sitemap")({
  server: {
    handlers: {
      POST: async () => {
        try {
          const result = await submitSitemap();
          console.log("[resubmit-sitemap]", result);
          return Response.json({ ok: true, result });
        } catch (e) {
          console.error("[resubmit-sitemap]", e);
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});
