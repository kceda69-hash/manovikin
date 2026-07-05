#!/usr/bin/env node
// Static SEO audit. Runs in CI to flag sitemap / robots / noindex / canonical
// drift before a deploy. No network calls — reads source files only.
//
// When running under GitHub Actions (GITHUB_ACTIONS=true), each failing
// finding is emitted as a workflow command (`::error file=...,line=...::`
// or `::warning ...`), so they appear as inline annotations on pull
// requests at the exact file + line that needs to change.

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const ROUTES_DIR = join(ROOT, "src", "routes");
const SITEMAP_FILE = join(ROUTES_DIR, "sitemap[.]xml.ts");
const ROBOTS_FILE = join(ROOT, "public", "robots.txt");
const CANONICAL_HOST = "https://manovik.in";
const IS_GHA = process.env.GITHUB_ACTIONS === "true";

/** @type {{level:'error'|'warning', file:string, line:number, title:string, message:string}[]} */
const findings = [];
const rel = (p) => relative(ROOT, p).split("\\").join("/");
const add = (level, file, line, title, message) =>
  findings.push({ level, file: rel(file), line: Math.max(1, line | 0), title, message });
const err = (file, line, title, message) => add("error", file, line, title, message);
const warn = (file, line, title, message) => add("warning", file, line, title, message);

function read(path) {
  try { return readFileSync(path, "utf8"); }
  catch { return null; }
}

/** Find the 1-based line number of the first regex match, or 1 if not found. */
function lineOf(src, re) {
  if (!src) return 1;
  const m = re.exec(src);
  if (!m) return 1;
  return src.slice(0, m.index).split(/\r?\n/).length;
}

// ---------- sitemap ----------
const sitemapSrc = read(SITEMAP_FILE);
if (!sitemapSrc) {
  err(SITEMAP_FILE, 1, "Sitemap missing", `Missing sitemap route at ${rel(SITEMAP_FILE)}`);
}

const baseUrlMatch = sitemapSrc?.match(/BASE_URL\s*=\s*["'`]([^"'`]+)["'`]/);
const baseUrl = baseUrlMatch?.[1];
if (sitemapSrc && baseUrl !== CANONICAL_HOST) {
  const ln = lineOf(sitemapSrc, /BASE_URL\s*=/);
  err(SITEMAP_FILE, ln, "Sitemap BASE_URL mismatch",
    `BASE_URL is "${baseUrl}", expected "${CANONICAL_HOST}"`);
}

/** path -> line in sitemap source */
const sitemapPaths = new Map();
if (sitemapSrc) {
  const re = /\bpath:\s*["'`]([^"'`]+)["'`]/g;
  let m;
  while ((m = re.exec(sitemapSrc))) {
    const ln = sitemapSrc.slice(0, m.index).split(/\r?\n/).length;
    if (!sitemapPaths.has(m[1])) sitemapPaths.set(m[1], ln);
  }
  if (sitemapPaths.size === 0) {
    err(SITEMAP_FILE, 1, "Sitemap empty", "Sitemap contains no entries");
  }
}

// ---------- robots ----------
const robotsSrc = read(ROBOTS_FILE);
if (!robotsSrc) {
  err(ROBOTS_FILE, 1, "robots.txt missing", `Missing ${rel(ROBOTS_FILE)}`);
}
/** path -> line in robots.txt */
const disallowed = new Map();
if (robotsSrc) {
  const lines = robotsSrc.split(/\r?\n/);
  lines.forEach((line, i) => {
    const d = line.trim().match(/^Disallow:\s*(\S+)/i);
    if (d && !disallowed.has(d[1])) disallowed.set(d[1], i + 1);
  });
  if (!/Sitemap:\s*https?:\/\//i.test(robotsSrc)) {
    warn(ROBOTS_FILE, lines.length, "robots.txt missing Sitemap directive",
      "robots.txt has no Sitemap: directive — crawlers fall back to /sitemap.xml");
  }
}

function isDisallowed(path) {
  for (const d of disallowed.keys()) {
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

function routePathFromFile(relPath) {
  let p = relPath.replace(/\.[jt]sx?$/, "");
  if (p.startsWith("routes/")) p = p.slice("routes/".length);
  if (p === "__root") return null;
  if (p === "index") return "/";
  if (p.endsWith("/index")) return "/" + p.slice(0, -"/index".length);
  if (p.startsWith("api/") || p.startsWith("lovable/") || p.startsWith("email/")) return null;
  if (p.startsWith("[.")) return null; // [.mcp]/, [.well-known]/ — server routes, not pages
  if (p === "mcp") return null;         // JSON MCP endpoint
  if (p.includes("[.]xml")) return null;
  if (/\$|\*/.test(p)) return null;
  p = p.split(".").join("/");
  return "/" + p;
}

const files = listRouteFiles(ROUTES_DIR);
const inspected = [];
for (const f of files) {
  const relFromSrc = relative(join(ROOT, "src"), f).split("\\").join("/");
  const path = routePathFromFile(relFromSrc);
  if (!path) continue;
  const src = readFileSync(f, "utf8");
  const noindexRe = /name:\s*["'`]robots["'`]\s*,\s*content:\s*["'`][^"'`]*noindex/i;
  const canonicalRe = /rel:\s*["'`]canonical["'`]\s*,\s*href:\s*["'`]([^"'`]+)["'`]/;
  const ogUrlRe = /property:\s*["'`]og:url["'`]\s*,\s*content:\s*["'`]([^"'`]+)["'`]/;
  const noindex = noindexRe.test(src);
  const canonicalMatch = src.match(canonicalRe);
  const ogUrlMatch = src.match(ogUrlRe);
  inspected.push({
    file: f,
    path,
    src,
    noindex,
    noindexLine: noindex ? lineOf(src, noindexRe) : 0,
    canonical: canonicalMatch?.[1],
    canonicalLine: canonicalMatch ? lineOf(src, canonicalRe) : 0,
    ogUrl: ogUrlMatch?.[1],
    ogUrlLine: ogUrlMatch ? lineOf(src, ogUrlRe) : 0,
    headLine: lineOf(src, /head:\s*\(/),
  });
}

// ---------- cross-checks ----------
for (const r of inspected) {
  const inSitemap = sitemapPaths.has(r.path);
  const blocked = isDisallowed(r.path);

  if (inSitemap && r.noindex) {
    err(r.file, r.noindexLine, "Conflict: sitemap + noindex",
      `${r.path} is listed in the sitemap but has a robots noindex meta. Remove one.`);
  }
  if (inSitemap && blocked) {
    const robotsLine = [...disallowed.entries()].find(([d]) =>
      r.path === d || r.path.startsWith(d + "/") || r.path.startsWith(d),
    )?.[1] ?? 1;
    err(ROBOTS_FILE, robotsLine, "Conflict: sitemap + robots Disallow",
      `${r.path} is listed in the sitemap but Disallow'd in robots.txt.`);
  }
  if (inSitemap && r.canonical) {
    const expected = `${CANONICAL_HOST}${r.path}`;
    if (r.canonical !== expected) {
      err(r.file, r.canonicalLine, "Canonical mismatch",
        `canonical "${r.canonical}" should be "${expected}".`);
    }
  }
  if (inSitemap && !r.canonical) {
    warn(r.file, r.headLine, "Missing canonical",
      `${r.path} is in the sitemap but has no <link rel="canonical">.`);
  }
  if (inSitemap && r.ogUrl) {
    const expected = `${CANONICAL_HOST}${r.path}`;
    if (r.ogUrl !== expected) {
      err(r.file, r.ogUrlLine, "og:url mismatch",
        `og:url "${r.ogUrl}" should be "${expected}".`);
    }
  }
  if (!inSitemap && !r.noindex && !blocked) {
    err(r.file, r.headLine, "Route not indexed and not hidden",
      `${r.path} is a public route but is not in the sitemap, not noindex'd, and not Disallow'd. Add it to the sitemap or hide it explicitly.`);
  }
}

// ---------- sitemap entries with no matching file ----------
const knownPaths = new Set(inspected.map((r) => r.path));
for (const [p, ln] of sitemapPaths) {
  if (!knownPaths.has(p)) {
    warn(SITEMAP_FILE, ln, "Sitemap entry has no matching route",
      `Sitemap entry "${p}" has no matching static route file (OK for dynamic content).`);
  }
}

// ---------- snapshot diff (indexability drift) ----------
// Diffs the current robots.txt + rendered sitemap.xml against committed
// snapshots under .seo-snapshots/. Any diff is a WARNING with a compact
// per-line diff attached, so PR reviewers see intentional indexability
// changes explicitly. Regenerate with `bun run seo:snapshot`.
import { existsSync } from "node:fs";
import {
  SNAPSHOT_DIR, parseSitemapEntries, renderSitemap, simpleDiff,
} from "./seo-lib.mjs";

const snapshotRobots = read(join(SNAPSHOT_DIR, "robots.txt"));
const snapshotSitemap = read(join(SNAPSHOT_DIR, "sitemap.xml"));
const liveSitemap = sitemapSrc ? renderSitemap(parseSitemapEntries(sitemapSrc)) : "";

if (!existsSync(SNAPSHOT_DIR)) {
  warn(SITEMAP_FILE, 1, "SEO snapshot missing",
    `No .seo-snapshots/ committed. Run 'bun run seo:snapshot' and commit the result to detect future indexability drift.`);
} else {
  if (snapshotRobots !== null && robotsSrc !== null && snapshotRobots !== robotsSrc) {
    warn(ROBOTS_FILE, 1, "robots.txt drift vs snapshot",
      `robots.txt differs from .seo-snapshots/robots.txt. Confirm this is intentional, then run 'bun run seo:snapshot' to update. Diff:\n${simpleDiff(snapshotRobots, robotsSrc)}`);
  }
  if (snapshotSitemap !== null && liveSitemap && snapshotSitemap !== liveSitemap) {
    warn(SITEMAP_FILE, 1, "sitemap.xml drift vs snapshot",
      `Rendered sitemap.xml differs from .seo-snapshots/sitemap.xml. Confirm this is intentional, then run 'bun run seo:snapshot' to update. Diff:\n${simpleDiff(snapshotSitemap, liveSitemap)}`);
  }
}

// ---------- indexability validation ----------
// Explicit "does the sitemap match what's actually indexable" pass:
//   - every sitemap URL must resolve to a public route file (or be flagged)
//   - no sitemap URL may ship a robots noindex meta
//   - no sitemap URL may be Disallow'd in robots.txt
//   - every route that ships noindex SHOULD also be Disallow'd (defense in depth)
const pathToRoute = new Map(inspected.map((r) => [r.path, r]));
for (const [p] of sitemapPaths) {
  const r = pathToRoute.get(p);
  if (!r) continue; // already warned above
  if (r.noindex) {
    err(r.file, r.noindexLine, "Sitemap URL is noindex",
      `${p} is advertised in the sitemap but ships <meta name="robots" content="noindex">. Remove one.`);
  }
  if (isDisallowed(p, disallowed)) {
    err(ROBOTS_FILE, 1, "Sitemap URL is Disallow'd",
      `${p} is advertised in the sitemap but Disallow'd in robots.txt. Remove one.`);
  }
}
for (const r of inspected) {
  if (r.noindex && !isDisallowed(r.path, disallowed)) {
    warn(ROBOTS_FILE, 1, "noindex route not in robots.txt",
      `${r.path} ships noindex but is not Disallow'd in robots.txt. Add a Disallow so crawlers skip it before rendering.`);
  }
}





// ---------- report ----------
function gha(f) {
  // https://docs.github.com/en/actions/using-workflows/workflow-commands-for-github-actions
  // Escape message for the workflow command line.
  const esc = (s) =>
    String(s).replace(/%/g, "%25").replace(/\r/g, "%0D").replace(/\n/g, "%0A");
  const cmd = f.level; // 'error' or 'warning'
  console.log(
    `::${cmd} file=${f.file},line=${f.line},title=${esc(f.title)}::${esc(f.message)}`,
  );
}

const errors = findings.filter((f) => f.level === "error");
const warnings = findings.filter((f) => f.level === "warning");

if (IS_GHA) {
  for (const f of findings) gha(f);
  // Job summary so the PR check page has a readable rollup too.
  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const rows = (list) =>
      list.length
        ? list
            .map((f) => `| ${f.level} | \`${f.file}:${f.line}\` | ${f.title} | ${f.message.replace(/\|/g, "\\|")} |`)
            .join("\n")
        : "| _none_ | | | |";
    const md = [
      `# SEO audit`,
      ``,
      `- routes checked: **${inspected.length}**`,
      `- sitemap entries: **${sitemapPaths.size}**`,
      `- robots Disallow rules: **${disallowed.size}**`,
      `- errors: **${errors.length}**, warnings: **${warnings.length}**`,
      ``,
      `| level | location | title | message |`,
      `| --- | --- | --- | --- |`,
      rows([...errors, ...warnings]),
      ``,
    ].join("\n");
    try {
      const { appendFileSync } = await import("node:fs");
      appendFileSync(summary, md);
    } catch { /* non-fatal */ }
  }
}

const fmt = (label, list) =>
  list.length
    ? `\n${label} (${list.length}):\n` +
      list.map((f) => `  - ${f.file}:${f.line}  ${f.title} — ${f.message}`).join("\n")
    : "";

if (warnings.length) console.warn("SEO audit warnings:" + fmt("WARN", warnings));
if (errors.length) {
  console.error("\nSEO audit failed:" + fmt("ERROR", errors));
  process.exit(1);
}
console.log(
  `SEO audit passed: ${inspected.length} routes checked, ${sitemapPaths.size} sitemap entries, ${disallowed.size} robots Disallow rules.`,
);
