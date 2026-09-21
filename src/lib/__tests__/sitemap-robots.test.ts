// Bidirectional sitemap ↔ robots.txt consistency check.
//
// Runs on every `vitest run` (invoked in CI via .github/workflows/seo-audit.yml)
// so a change to public/robots.txt, src/lib/sitemap.ts, or any route file
// immediately fails the build if the two sources of truth drift apart.
//
// Rules enforced:
//   1. Every URL emitted into sitemap.xml must be crawlable per robots.txt
//      (no matching `Disallow` rule for User-agent: *).
//   2. Every `Disallow` rule in robots.txt must NOT match a URL that ended up
//      in the sitemap — i.e. we never advertise a page we then forbid.
//   3. robots.txt must publish the sitemap via a `Sitemap:` directive.
//
// This uses the real sitemap builder (src/lib/sitemap.ts) against the real
// route files under src/routes/, so it catches drift the static SEO audit
// script misses (that script parses a legacy inline `entries` array).

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { describe, expect, it } from "vitest";

import { BASE_URL, buildSitemapEntriesFromRouteFiles } from "@/lib/sitemap";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..", "..");
const ROBOTS_PATH = join(ROOT, "public", "robots.txt");

const routeFiles = Object.keys(import.meta.glob("../../routes/**/*.{ts,tsx}")).map((filePath) =>
  filePath.replace("../../routes/", "./"),
);

const sitemapPaths = buildSitemapEntriesFromRouteFiles(routeFiles).map((entry) => entry.path);

const robotsSrc = readFileSync(ROBOTS_PATH, "utf8");

/** Parse the `User-agent: *` group's Disallow rules. Robots is line-oriented
 *  and groups run from a `User-agent:` line until the next one; we only care
 *  about the wildcard group because that's what search crawlers use. */
function parseWildcardDisallows(src: string): string[] {
  const rules: string[] = [];
  let inWildcardGroup = false;
  for (const rawLine of src.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    if (!line) continue;
    const ua = /^User-agent:\s*(\S+)/i.exec(line);
    if (ua) {
      inWildcardGroup = ua[1] === "*";
      continue;
    }
    if (!inWildcardGroup) continue;
    const d = /^Disallow:\s*(\S*)/i.exec(line);
    if (d && d[1]) rules.push(d[1]);
  }
  return rules;
}

/** Does `rule` (a robots.txt Disallow value) block `path`?
 *  robots.txt matches by prefix; an empty rule means "block nothing". */
function ruleMatchesPath(rule: string, path: string): boolean {
  if (!rule) return false;
  if (rule === "/") return true;
  return path === rule || path.startsWith(rule);
}

const disallowRules = parseWildcardDisallows(robotsSrc);

describe("sitemap ↔ robots.txt consistency", () => {
  it("emits at least one sitemap entry and at least one Disallow rule", () => {
    // Guardrail: if either side is empty the checks below become vacuous.
    expect(sitemapPaths.length).toBeGreaterThan(0);
    expect(disallowRules.length).toBeGreaterThan(0);
  });

  it("advertises the sitemap in robots.txt", () => {
    const sitemapDirective = /^Sitemap:\s*(\S+)/im.exec(robotsSrc);
    expect(sitemapDirective, "robots.txt must contain a `Sitemap:` line").not.toBeNull();
    expect(sitemapDirective![1]).toBe(`${BASE_URL}/sitemap.xml`);
  });

  it("never advertises a URL that robots.txt Disallows", () => {
    const conflicts: Array<{ path: string; rule: string }> = [];
    for (const path of sitemapPaths) {
      for (const rule of disallowRules) {
        if (ruleMatchesPath(rule, path)) {
          conflicts.push({ path, rule });
        }
      }
    }
    expect(
      conflicts,
      `Sitemap advertises URLs blocked by robots.txt:\n${conflicts
        .map((c) => `  - ${c.path}  (matches Disallow: ${c.rule})`)
        .join(
          "\n",
        )}\nFix: either remove the Disallow rule or exclude the path from src/lib/sitemap.ts.`,
    ).toEqual([]);
  });

  it("never Disallows a rule that a sitemap URL matches (vice versa)", () => {
    // This is the same invariant expressed the other way: every Disallow rule
    // must fail to match every sitemap URL. Symmetric assertion so a stray
    // Disallow that unintentionally shadows a public path is caught.
    const shadowing = disallowRules
      .map((rule) => ({
        rule,
        hits: sitemapPaths.filter((path) => ruleMatchesPath(rule, path)),
      }))
      .filter((r) => r.hits.length > 0);
    expect(
      shadowing,
      `robots.txt Disallow rules shadow sitemap URLs:\n${shadowing
        .map((s) => `  - Disallow: ${s.rule}  →  ${s.hits.join(", ")}`)
        .join("\n")}`,
    ).toEqual([]);
  });
});
