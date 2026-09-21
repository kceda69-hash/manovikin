#!/usr/bin/env node
// Auto-repair mechanical SEO regressions the audit flags.
//
// Fixes applied (deterministic, source-only, no network):
//   1. Canonical / og:url pointing at the wrong host or path         → rewrite to https://manovik.in<route>
//   2. Sitemap entry that is also noindex or Disallow'd              → remove from sitemap
//   3. Route ships noindex but is not Disallow'd in robots.txt       → add Disallow line
//   4. Sitemap BASE_URL drifted                                      → reset to canonical host
//
// Modes:
//   node scripts/seo-autofix.mjs           → apply fixes, refresh snapshot
//   node scripts/seo-autofix.mjs --check   → CI mode; exits 1 if any fix would be applied
//
// Runs after seo:audit in CI so trivially fixable regressions never merge.

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import {
  ROOT,
  ROBOTS_FILE,
  SITEMAP_FILE,
  CANONICAL_HOST,
  read,
  parseSitemapEntries,
  parseRobots,
  isDisallowed,
  inspectRoutes,
  rel,
} from "./seo-lib.mjs";

const CHECK = process.argv.includes("--check");
const changes = []; // { file, summary }

function edit(file, before, after, summary) {
  if (before === after) return;
  changes.push({ file: rel(file), summary });
  if (!CHECK) writeFileSync(file, after);
}

// ---------- load state ----------
const routes = inspectRoutes();
const robotsSrc = read(ROBOTS_FILE) ?? "";
const sitemapSrc = read(SITEMAP_FILE) ?? "";
const { disallowed } = parseRobots(robotsSrc);
const entries = parseSitemapEntries(sitemapSrc);
const sitemapPaths = new Set(entries.map((e) => e.path));

// ---------- fix 1: canonical + og:url drift on route files ----------
const CANONICAL_RE = /(rel:\s*["'`]canonical["'`]\s*,\s*href:\s*)["'`]([^"'`]+)["'`]/g;
const OGURL_RE = /(property:\s*["'`]og:url["'`]\s*,\s*content:\s*)["'`]([^"'`]+)["'`]/g;

for (const r of routes) {
  const expected = `${CANONICAL_HOST}${r.path}`;
  let next = r.src;
  next = next.replace(
    CANONICAL_RE,
    (_m, pre, url) => `${pre}"${url === expected ? url : expected}"`,
  );
  next = next.replace(OGURL_RE, (_m, pre, url) => `${pre}"${url === expected ? url : expected}"`);
  if (next !== r.src) edit(r.file, r.src, next, `Rewrote canonical/og:url → ${expected}`);
}

// ---------- fix 2: sitemap entry that ships noindex or is Disallow'd ----------
const noindexPaths = new Set(routes.filter((r) => r.noindex).map((r) => r.path));
const badSitemapEntries = entries.filter(
  (e) => noindexPaths.has(e.path) || isDisallowed(e.path, disallowed),
);
if (badSitemapEntries.length) {
  let next = sitemapSrc;
  for (const e of badSitemapEntries) {
    // Remove the whole `{ path: "...", ... },` object literal (with trailing comma + newline).
    const re = new RegExp(
      String.raw`\s*\{\s*path:\s*["'\`]${e.path.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'\`][^}]*\},?`,
      "g",
    );
    next = next.replace(re, "");
  }
  edit(
    SITEMAP_FILE,
    sitemapSrc,
    next,
    `Removed ${badSitemapEntries.length} sitemap entr${badSitemapEntries.length === 1 ? "y" : "ies"} (noindex/Disallow'd): ${badSitemapEntries.map((e) => e.path).join(", ")}`,
  );
}

// ---------- fix 3: noindex route missing from robots.txt Disallow ----------
const missingDisallow = routes
  .filter((r) => r.noindex && !isDisallowed(r.path, disallowed))
  .map((r) => r.path);
if (missingDisallow.length) {
  const lines = robotsSrc.split(/\r?\n/);
  // Insert after the last existing Disallow, else after Allow: /, else at top of first group.
  let insertAt = lines.findLastIndex((l) => /^Disallow:/i.test(l.trim()));
  if (insertAt < 0) insertAt = lines.findLastIndex((l) => /^Allow:/i.test(l.trim()));
  if (insertAt < 0) insertAt = 0;
  const additions = missingDisallow.map((p) => `Disallow: ${p}`);
  lines.splice(insertAt + 1, 0, ...additions);
  edit(
    ROBOTS_FILE,
    robotsSrc,
    lines.join("\n"),
    `Added ${additions.length} Disallow rule(s) for noindex routes: ${missingDisallow.join(", ")}`,
  );
}

// ---------- fix 4: sitemap BASE_URL drift ----------
const baseMatch = sitemapSrc.match(/(BASE_URL\s*=\s*)["'`]([^"'`]+)["'`]/);
if (baseMatch && baseMatch[2] !== CANONICAL_HOST) {
  const currentSrc = read(SITEMAP_FILE) ?? "";
  const next = currentSrc.replace(/(BASE_URL\s*=\s*)["'`][^"'`]+["'`]/, `$1"${CANONICAL_HOST}"`);
  edit(SITEMAP_FILE, currentSrc, next, `Reset BASE_URL → ${CANONICAL_HOST}`);
}

// ---------- report ----------
if (!changes.length) {
  console.log("SEO autofix: no changes needed.");
  process.exit(0);
}

console.log(`SEO autofix: ${changes.length} change(s)${CHECK ? " would be applied" : " applied"}:`);
for (const c of changes) console.log(`  - ${c.file}  ${c.summary}`);

if (CHECK) {
  console.error(
    "\n[--check] Autofix would modify files. Run 'bun run seo:autofix' locally and commit the result.",
  );
  process.exit(1);
}

// Refresh committed snapshot so the audit's snapshot diff stays green.
if (existsSync(join(ROOT, "scripts", "seo-snapshot.mjs"))) {
  const r = spawnSync(process.execPath, ["scripts/seo-snapshot.mjs"], {
    cwd: ROOT,
    stdio: "inherit",
  });
  if (r.status !== 0) process.exit(r.status ?? 1);
}
