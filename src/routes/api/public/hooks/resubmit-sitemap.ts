import { createFileRoute } from "@tanstack/react-router";
import { submitSitemapInternal } from "@/lib/seo.functions";
import { isAuthorizedHook } from "@/lib/hook-auth";

export const Route = createFileRoute("/api/public/hooks/resubmit-sitemap")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        if (!isAuthorizedHook(request)) {
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
