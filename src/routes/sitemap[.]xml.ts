import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

import { buildSitemapEntriesFromRouteFiles, buildSitemapXml } from "@/lib/sitemap";

const routeModules = import.meta.glob("./**/*.{ts,tsx}");

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const entries = buildSitemapEntriesFromRouteFiles(Object.keys(routeModules));
        const xml = buildSitemapXml(entries);

        return new Response(xml, {
          headers: {
            "Content-Type": "application/xml",
            "Cache-Control": "public, max-age=3600",
          },
        });
      },
    },
  },
});
