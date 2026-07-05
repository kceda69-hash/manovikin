// Shared helpers for the SEO audit + snapshot scripts.
// Parses the sitemap route + robots.txt from source and rebuilds the
// canonical rendered outputs deterministically (no network, no server).

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
export const ROUTES_DIR = join(ROOT, "src", "routes");
export const SITEMAP_FILE = join(ROUTES_DIR, "sitemap[.]xml.ts");
export const ROBOTS_FILE = join(ROOT, "public", "robots.txt");
export const SNAPSHOT_DIR = join(ROOT, ".seo-snapshots");
export const CANONICAL_HOST = "https://manovik.in";

export const rel = (p) => relative(ROOT, p).split("\\").join("/");

export function read(path) {
  try { return readFileSync(path, "utf8"); }
  catch { return null; }
}

/** Extract sitemap entries { path, changefreq?, priority?, lastmod? } from the
 *  server route source. Parses each `{ ... }` literal that has `path: "..."`.
 *  Deterministic order = order they appear in source. */
export function parseSitemapEntries(src) {
  if (!src) return [];
  const entries = [];
  const re = /\{\s*path:\s*["'`]([^"'`]+)["'`]([^}]*)\}/g;
  let m;
  while ((m = re.exec(src))) {
    const [, path, tail] = m;
    const field = (name) => {
      const r = new RegExp(`${name}:\\s*["'\`]([^"'\`]+)["'\`]`).exec(tail);
      return r ? r[1] : undefined;
    };
    entries.push({
      path,
      changefreq: field("changefreq"),
      priority: field("priority"),
      lastmod: field("lastmod"),
    });
  }
  return entries;
}

/** Render sitemap XML in the same shape the server route emits. */
export function renderSitemap(entries, baseUrl = CANONICAL_HOST) {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${baseUrl}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ].filter(Boolean).join("\n"),
  );
  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
    ``,
  ].join("\n");
}

/** Parse robots.txt into structured groups + Disallow map. */
export function parseRobots(src) {
  const disallowed = new Map();
  const allowed = new Map();
  const sitemaps = [];
  if (!src) return { disallowed, allowed, sitemaps };
  src.split(/\r?\n/).forEach((line, i) => {
    const d = line.trim().match(/^Disallow:\s*(\S+)/i);
    if (d && !disallowed.has(d[1])) disallowed.set(d[1], i + 1);
    const a = line.trim().match(/^Allow:\s*(\S+)/i);
    if (a && !allowed.has(a[1])) allowed.set(a[1], i + 1);
    const s = line.trim().match(/^Sitemap:\s*(\S+)/i);
    if (s) sitemaps.push(s[1]);
  });
  return { disallowed, allowed, sitemaps };
}

export function isDisallowed(path, disallowed) {
  for (const d of disallowed.keys()) {
    if (d === "/") return false;
    if (path === d || path.startsWith(d + "/") || path.startsWith(d)) return true;
  }
  return false;
}

/** List route source files under src/routes/. */
export function listRouteFiles(dir = ROUTES_DIR) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { out.push(...listRouteFiles(full)); continue; }
    if (!/\.(tsx?|jsx?)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

export function routePathFromFile(relPath) {
  let p = relPath.replace(/\.[jt]sx?$/, "");
  if (p.startsWith("routes/")) p = p.slice("routes/".length);
  if (p === "__root") return null;
  if (p === "index") return "/";
  if (p.endsWith("/index")) return "/" + p.slice(0, -"/index".length);
  if (p.startsWith("api/") || p.startsWith("lovable/") || p.startsWith("email/")) return null;
  // Escape-dot directories like [.mcp]/ and [.well-known]/ are server routes,
  // not indexable pages. Same for the `mcp` JSON endpoint.
  if (p.startsWith("[.")) return null;
  if (p === "mcp") return null;
  if (p.includes("[.]xml")) return null;
  if (/\$|\*/.test(p)) return null;
  p = p.split(".").join("/");
  return "/" + p;
}

const NOINDEX_RE = /name:\s*["'`]robots["'`]\s*,\s*content:\s*["'`][^"'`]*noindex/i;

/** Read every static route file and record its indexability signals. */
export function inspectRoutes() {
  const inspected = [];
  for (const f of listRouteFiles()) {
    const relFromSrc = relative(join(ROOT, "src"), f).split("\\").join("/");
    const path = routePathFromFile(relFromSrc);
    if (!path) continue;
    const src = readFileSync(f, "utf8");
    inspected.push({
      file: f,
      path,
      src,
      noindex: NOINDEX_RE.test(src),
    });
  }
  return inspected;
}

/** Unified-ish diff for two strings. Not a real patch — enough for CI logs. */
export function simpleDiff(a, b) {
  const A = a.split("\n");
  const B = b.split("\n");
  const out = [];
  const max = Math.max(A.length, B.length);
  for (let i = 0; i < max; i++) {
    if (A[i] === B[i]) continue;
    if (A[i] !== undefined) out.push(`- ${A[i]}`);
    if (B[i] !== undefined) out.push(`+ ${B[i]}`);
  }
  return out.join("\n");
}
