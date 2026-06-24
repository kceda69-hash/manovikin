#!/usr/bin/env node
// Static SEO audit. Runs in CI to flag sitemap / robots / noindex / canonical
// drift before a deploy. No network calls — reads source files only.
//
// Checks:
//  1. robots.txt exists and is parseable
//  2. Every route in the sitemap has a `canonical` link pointing at itself
//     (absolute https://manovik.in/<path>)
//  3. Every route in the sitemap has matching og:url (when og tags are present)
//  4. No route in the sitemap is marked `noindex`
//  5. No route in the sitemap is Disallow'd in robots.txt
//  6. Every public, static route file is either in the sitemap, marked
//     noindex, or Disallow'd in robots.txt (no silently-unlisted pages)
//  7. Sitemap BASE_URL matches the canonical domain

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const ROUTES_DIR = join(ROOT, "src", "routes");
const SITEMAP_FILE = join(ROUTES_DIR, "sitemap[.]xml.ts");
const ROBOTS_FILE = join(ROOT, "public", "robots.txt");
const CANONICAL_HOST = "https://manovik.in";

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

function read(path) {
  try { return readFileSync(path, "utf8"); }
  catch { return null; }
}

// ---------- sitemap ----------
const sitemapSrc = read(SITEMAP_FILE);
if (!sitemapSrc) err(`Missing sitemap route at ${relative(ROOT, SITEMAP_FILE)}`);

const baseUrlMatch = sitemapSrc?.match(/BASE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
const baseUrl = baseUrlMatch?.[1];
if (sitemapSrc && baseUrl !== CANONICAL_HOST) {
  err(`Sitemap BASE_URL is "${baseUrl}", expected "${CANONICAL_HOST}"`);
}

const sitemapPaths = new Set();
if (sitemapSrc) {
  const re = /\bpath:\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(sitemapSrc))) sitemapPaths.add(m[1]);
  if (sitemapPaths.size === 0) err("Sitemap contains no entries");
}

// ---------- robots ----------
const robotsSrc = read(ROBOTS_FILE);
if (!robotsSrc) err(`Missing ${relative(ROOT, ROBOTS_FILE)}`);
const disallowed = new Set();
if (robotsSrc) {
  for (const line of robotsSrc.split(/\r?\n/)) {
    const t = line.trim();
    const d = t.match(/^Disallow:\s*(\S+)/i);
    if (d) disallowed.add(d[1]);
  }
  if (!/Sitemap:\s*https?:\/\//i.test(robotsSrc)) {
    warn("robots.txt has no Sitemap: directive");
  }
}

function isDisallowed(path) {
  for (const d of disallowed) {
    if (d === "/") return false;
    if (path === d || path.startsWith(d + "/") || path.startsWith(d)) return true;
  }
  return false;
}

// ---------- routes ----------
function listRouteFiles(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) { out.push(...listRouteFiles(full)); continue; }
    if (!/\.(tsx?|jsx?)$/.test(name)) continue;
    out.push(full);
  }
  return out;
}

function routePathFromFile(rel) {
  // strip extension and the leading "routes/"
  let p = rel.replace(/\.[jt]sx?$/, "");
  if (p.startsWith("routes/")) p = p.slice("routes/".length);
  // ignore special files
  if (p === "__root") return null;
  if (p === "index") return "/";
  if (p.endsWith("/index")) return "/" + p.slice(0, -"/index".length);
  if (p.startsWith("api/") || p.startsWith("lovable/") || p.startsWith("email/")) return null;
  if (p.includes("[.]xml")) return null;
  // dynamic / param routes — skip from static-coverage check
  if (/\$|\*/.test(p)) return null;
  // dot-separated -> slashes (TanStack flat routes)
  p = p.split(".").join("/");
  return "/" + p;
}

const files = listRouteFiles(ROUTES_DIR);
const inspected = [];
for (const f of files) {
  const rel = relative(join(ROOT, "src"), f);
  const path = routePathFromFile(rel);
  if (!path) continue;
  const src = readFileSync(f, "utf8");
  const noindex = /name:\s*["'`]robots["'`]\s*,\s*content:\s*["'`][^"'`]*noindex/i.test(src);
  const canonicalMatch = src.match(/rel:\s*["'`]canonical["'`]\s*,\s*href:\s*["'`]([^"'`]+)["'`]/);
  const ogUrlMatch = src.match(/property:\s*["'`]og:url["'`]\s*,\s*content:\s*["'`]([^"'`]+)["'`]/);
  inspected.push({ file: rel, path, src, noindex, canonical: canonicalMatch?.[1], ogUrl: ogUrlMatch?.[1] });
}

// ---------- cross-checks ----------
for (const r of inspected) {
  const inSitemap = sitemapPaths.has(r.path);
  const blocked = isDisallowed(r.path);

  if (inSitemap && r.noindex) {
    err(`${r.path}: in sitemap but has noindex meta (${r.file})`);
  }
  if (inSitemap && blocked) {
    err(`${r.path}: in sitemap but blocked by robots.txt (${r.file})`);
  }
  if (inSitemap && r.canonical) {
    const expected = `${CANONICAL_HOST}${r.path}`;
    if (r.canonical !== expected) {
      err(`${r.path}: canonical "${r.canonical}" should be "${expected}" (${r.file})`);
    }
  }
  if (inSitemap && !r.canonical) {
    warn(`${r.path}: in sitemap but missing canonical link (${r.file})`);
  }
  if (inSitemap && r.ogUrl) {
    const expected = `${CANONICAL_HOST}${r.path}`;
    if (r.ogUrl !== expected) {
      err(`${r.path}: og:url "${r.ogUrl}" should be "${expected}" (${r.file})`);
    }
  }
  if (!inSitemap && !r.noindex && !blocked) {
    err(`${r.path}: public route is not in sitemap, not noindex'd, and not Disallow'd (${r.file})`);
  }
}

// ---------- sitemap entries with no matching file ----------
const knownPaths = new Set(inspected.map((r) => r.path));
for (const p of sitemapPaths) {
  // dynamic content (e.g. blog posts not auto-detected via static file map) may still be valid
  if (!knownPaths.has(p)) warn(`Sitemap entry "${p}" has no matching static route file`);
}

// ---------- report ----------
const fmt = (label, list) =>
  list.length ? `\n${label} (${list.length}):\n` + list.map((l) => `  - ${l}`).join("\n") : "";

if (warnings.length) console.warn("SEO audit warnings:" + fmt("WARN", warnings));
if (errors.length) {
  console.error("\nSEO audit failed:" + fmt("ERROR", errors));
  process.exit(1);
}
console.log(`SEO audit passed: ${inspected.length} routes checked, ${sitemapPaths.size} sitemap entries, ${disallowed.size} robots Disallow rules.`);
