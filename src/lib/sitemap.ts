export const BASE_URL = "https://manovik.in";

export type SitemapChangeFrequency =
  | "always"
  | "hourly"
  | "daily"
  | "weekly"
  | "monthly"
  | "yearly"
  | "never";

export interface SitemapEntry {
  path: string;
  changefreq: SitemapChangeFrequency;
  priority: string;
}

const DOT_TOKEN = "__SITEMAP_LITERAL_DOT__";

// Kept out of the sitemap. Every entry here must also be Disallow'd in
// public/robots.txt (enforced by src/lib/__tests__/sitemap-robots.test.ts).
const EXCLUDED_PATHS = new Set([
  "/sitemap.xml",
  "/admin",
  "/chat",
  "/balance",
  "/audit",
  "/billing",
  "/seo",
  "/unsubscribe",
]);

const EXCLUDED_PREFIXES = [
  "/api",
  "/auth",
  "/email",
  "/lovable",
  "/receipt",
  "/.mcp",
  "/.well-known",
];

export function routeFilePathToPublicPath(filePath: string): string | null {
  const normalized = filePath
    .replace(/^\.\//, "")
    .replace(/^src\/routes\//, "")
    .replace(/\.(tsx|ts)$/, "");

  if (!normalized || normalized === "__root") {
    return null;
  }

  const pathParts = normalized
    .split("/")
    .flatMap((segment, index, allSegments) => {
      const isLeaf = index === allSegments.length - 1;
      if (segment === "__root" || (isLeaf && segment === "index")) {
        return [];
      }

      const escapedWholeSegment = segment.match(/^\[(\..+)]$/);
      if (escapedWholeSegment) {
        return [escapedWholeSegment[1]];
      }

      return segment
        .replace(/\[\.\]/g, DOT_TOKEN)
        .split(".")
        .filter(Boolean)
        .map((part) => part.replace(new RegExp(DOT_TOKEN, "g"), "."))
        .map((part) => {
          const escapedSegment = part.match(/^\[(.+)]$/);
          return escapedSegment ? escapedSegment[1] : part;
        });
    });

  if (pathParts.some((part) => part.includes("$") || part.includes("*"))) {
    return null;
  }

  return pathParts.length === 0 ? "/" : `/${pathParts.join("/")}`;
}

export function shouldIncludeInSitemap(path: string): boolean {
  if (EXCLUDED_PATHS.has(path)) {
    return false;
  }

  return !EXCLUDED_PREFIXES.some(
    (prefix) => path === prefix || path.startsWith(`${prefix}/`),
  );
}

export function sitemapMetadataForPath(path: string): Omit<SitemapEntry, "path"> {
  if (path === "/") {
    return { changefreq: "weekly", priority: "1.0" };
  }

  if (path === "/best-ai-coding-agent" || path === "/ai-coding-assistant") {
    return { changefreq: "weekly", priority: "0.9" };
  }

  if (path.startsWith("/vs-")) {
    return { changefreq: "monthly", priority: "0.8" };
  }

  if (path.startsWith("/blog/")) {
    return { changefreq: "monthly", priority: "0.7" };
  }

  if (["/privacy", "/terms", "/refund", "/unsubscribe"].includes(path)) {
    return { changefreq: "yearly", priority: "0.3" };
  }

  if (path.startsWith("/.mcp/") || path.startsWith("/.well-known/")) {
    return { changefreq: "yearly", priority: "0.1" };
  }

  if (path === "/contact" || path === "/students") {
    return { changefreq: "monthly", priority: "0.6" };
  }

  return { changefreq: "monthly", priority: "0.5" };
}

export function buildSitemapEntriesFromRouteFiles(
  routeFiles: Iterable<string>,
): SitemapEntry[] {
  const paths = new Set<string>();

  for (const filePath of routeFiles) {
    const path = routeFilePathToPublicPath(filePath);
    if (path && shouldIncludeInSitemap(path)) {
      paths.add(path);
    }
  }

  return [...paths]
    .sort((a, b) => (a === "/" ? -1 : b === "/" ? 1 : a.localeCompare(b)))
    .map((path) => ({ path, ...sitemapMetadataForPath(path) }));
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function buildSitemapXml(entries: SitemapEntry[]): string {
  const urls = entries.map((entry) =>
    [
      `  <url>`,
      `    <loc>${escapeXml(`${BASE_URL}${entry.path}`)}</loc>`,
      `    <changefreq>${entry.changefreq}</changefreq>`,
      `    <priority>${entry.priority}</priority>`,
      `  </url>`,
    ].join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}