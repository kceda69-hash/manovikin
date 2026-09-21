#!/usr/bin/env node
// Regenerate committed snapshots of robots.txt + rendered sitemap.xml under
// .seo-snapshots/. The audit script diffs these against the live source so
// unintentional changes to indexability show up in code review.
//
//   bun run seo:snapshot   # regenerate after intentional changes
//   bun run seo:audit      # fails/warns on drift

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  ROBOTS_FILE,
  SITEMAP_FILE,
  SNAPSHOT_DIR,
  read,
  parseSitemapEntries,
  renderSitemap,
} from "./seo-lib.mjs";

mkdirSync(SNAPSHOT_DIR, { recursive: true });

const robots = read(ROBOTS_FILE) ?? "";
const sitemapSrc = read(SITEMAP_FILE) ?? "";
const entries = parseSitemapEntries(sitemapSrc);
const sitemap = renderSitemap(entries);

writeFileSync(join(SNAPSHOT_DIR, "robots.txt"), robots);
writeFileSync(join(SNAPSHOT_DIR, "sitemap.xml"), sitemap);

console.log(
  `Wrote snapshots to .seo-snapshots/ — robots.txt (${robots.length} bytes), ` +
    `sitemap.xml (${entries.length} entries).`,
);
