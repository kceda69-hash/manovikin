import { createFileRoute } from "@tanstack/react-router";
import { submitSitemapInternal } from "@/lib/seo.functions";

export const Route = createFileRoute("/api/public/hooks/resubmit-sitemap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env.LOVABLE_API_KEY;
        const token = request.headers.get("Authorization")?.slice("Bearer ".length);
        if (!apiKey || token !== apiKey) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }
        try {
          const result = await submitSitemapInternal();
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
