// Server-only tech radar for the MANOVIK self-update engine.
//
// Periodically fetches, from free keyless sources:
//   1. Latest AI model releases (OpenRouter's public model catalog).
//   2. New CVEs/security advisories relevant to the stack (NVD free tier).
//   3. Tech headlines (Google News RSS, same pattern as the morning briefing).
//
// Every fetched string is treated as UNTRUSTED third-party content:
// sanitized with the dossier's sanitizeFetchedText, never followed as
// instructions. Request URLs are SSRF-guarded with isBlockedUrl. Each
// source is isolated in try/catch so one failing source never kills the run.

import { isBlockedUrl, sanitizeFetchedText } from "@/lib/dossier/dossier.server";

export type RadarCategory = "model" | "security" | "tech";

export interface RadarItem {
  category: RadarCategory;
  title: string;
  detail: string;
  url: string;
  /** ISO-8601 timestamp (may be "" when the source gives none). */
  publishedAt: string;
}

type FetchImpl = typeof fetch;

const FETCH_TIMEOUT_MS = 12_000;
const USER_AGENT = "MANOVIK/1.0 (self-update tech radar)";

function timedSignal(): AbortSignal {
  return AbortSignal.timeout(FETCH_TIMEOUT_MS);
}

/** Drop the item when its URL fails the SSRF guard; "" URL is allowed. */
function safeUrl(raw: unknown): string {
  if (typeof raw !== "string" || !raw) return "";
  return isBlockedUrl(raw) ? "" : raw;
}

function toIso(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) {
    // OpenRouter `created` is Unix seconds.
    const d = new Date(value * 1000);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  if (typeof value === "string" && value) {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? "" : d.toISOString();
  }
  return "";
}

// ---------------------------------------------------------------------------
// Dedupe
// ---------------------------------------------------------------------------

/** Stable key for an item: category + normalized title. */
export function radarItemKey(item: Pick<RadarItem, "category" | "title">): string {
  const norm = item.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
  return `${item.category}|${norm}`;
}

/** Pure: keep only items whose key is not in `seenKeys`. */
export function dedupeRadarItems(items: RadarItem[], seenKeys: Set<string>): RadarItem[] {
  return items.filter((it) => !seenKeys.has(radarItemKey(it)));
}

// ---------------------------------------------------------------------------
// 1. AI model releases — OpenRouter public catalog (free, no key)
// ---------------------------------------------------------------------------

const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const MODEL_WINDOW_DAYS = 30;
const MODEL_LIMIT = 8;

interface OpenRouterModel {
  id?: unknown;
  name?: unknown;
  created?: unknown;
  description?: unknown;
  context_length?: unknown;
}

/** Pure parser — exported for tests. */
export function parseOpenRouterModels(json: unknown, nowMs = Date.now(), limit = MODEL_LIMIT): RadarItem[] {
  const list = (json as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  const cutoff = nowMs - MODEL_WINDOW_DAYS * 24 * 60 * 60 * 1000;
  const items: Array<RadarItem & { createdMs: number }> = [];
  for (const m of list) {
    const model = m as OpenRouterModel;
    const createdMs =
      typeof model.created === "number" && Number.isFinite(model.created) ? model.created * 1000 : 0;
    if (createdMs < cutoff) continue;
    const name = typeof model.name === "string" ? model.name : typeof model.id === "string" ? model.id : "";
    if (!name) continue;
    const ctxLen = typeof model.context_length === "number" ? ` · ${Math.round(model.context_length / 1000)}k ctx` : "";
    items.push({
      category: "model",
      title: sanitizeFetchedText(`New model: ${name}`, 200),
      detail: sanitizeFetchedText(
        `${typeof model.description === "string" ? model.description : ""}${ctxLen}`.trim() || "No description.",
        400,
      ),
      url: safeUrl(typeof model.id === "string" ? `https://openrouter.ai/models/${model.id}` : ""),
      publishedAt: toIso(model.created),
      createdMs,
    });
  }
  return items
    .sort((a, b) => b.createdMs - a.createdMs)
    .slice(0, limit)
    .map(({ createdMs: _drop, ...rest }) => rest);
}

export async function fetchModelReleases(fetchImpl: FetchImpl = fetch): Promise<RadarItem[]> {
  const res = await fetchImpl(OPENROUTER_MODELS_URL, {
    signal: timedSignal(),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`openrouter models [${res.status}]`);
  return parseOpenRouterModels(await res.json());
}

// ---------------------------------------------------------------------------
// 2. Security advisories — NVD CVE API free tier (no key, 5 req / 30s)
// ---------------------------------------------------------------------------

const NVD_CVE_URL = "https://services.nvd.nist.gov/rest/json/cves/2.0";
const CVE_WINDOW_DAYS = 7;
const CVE_LIMIT = 10;

/** Stack-relevant keywords; a CVE matching any of these is kept. */
const STACK_KEYWORDS = [
  "react",
  "vite",
  "node.js",
  "nodejs",
  "postgres",
  "supabase",
  "typescript",
  "javascript",
  "npm",
  "tanstack",
  "cloudflare",
  "zod",
  "xss",
  "cross-site scripting",
  "sql injection",
  "ssrf",
  "csrf",
  "prototype pollution",
  "denial of service",
  "remote code execution",
];

function englishDescription(cve: Record<string, unknown>): string {
  const descs = (cve.descriptions ?? []) as Array<{ lang?: unknown; value?: unknown }>;
  const en = descs.find((d) => d.lang === "en" && typeof d.value === "string");
  return typeof en?.value === "string" ? en.value : "";
}

function baseScore(cve: Record<string, unknown>): number {
  const metrics = (cve.metrics ?? {}) as Record<string, Array<{ cvssData?: { baseScore?: unknown } }>>;
  for (const key of ["cvssMetricV40", "cvssMetricV31", "cvssMetricV30", "cvssMetricV2"]) {
    const arr = metrics[key];
    const score = arr?.[0]?.cvssData?.baseScore;
    if (typeof score === "number") return score;
  }
  return 0;
}

/** Pure parser — exported for tests. */
export function parseNvdCves(json: unknown, limit = CVE_LIMIT): RadarItem[] {
  const vulns = (json as { vulnerabilities?: unknown })?.vulnerabilities;
  if (!Array.isArray(vulns)) return [];
  const items: RadarItem[] = [];
  for (const v of vulns) {
    const cve = (v as { cve?: Record<string, unknown> })?.cve;
    if (!cve || typeof cve.id !== "string") continue;
    const desc = englishDescription(cve);
    const descLower = desc.toLowerCase();
    const relevant =
      STACK_KEYWORDS.some((k) => descLower.includes(k)) || baseScore(cve) >= 9.0;
    if (!relevant) continue;
    const score = baseScore(cve);
    items.push({
      category: "security",
      title: sanitizeFetchedText(`${cve.id}${score ? ` (CVSS ${score.toFixed(1)})` : ""}`, 200),
      detail: sanitizeFetchedText(desc || "No description published yet.", 500),
      url: safeUrl(`https://nvd.nist.gov/vuln/detail/${cve.id}`),
      publishedAt: toIso(cve.published),
    });
    if (items.length >= limit) break;
  }
  return items;
}

export async function fetchSecurityAdvisories(fetchImpl: FetchImpl = fetch): Promise<RadarItem[]> {
  const end = new Date();
  const start = new Date(end.getTime() - CVE_WINDOW_DAYS * 24 * 60 * 60 * 1000);
  const url =
    `${NVD_CVE_URL}?pubStartDate=${start.toISOString()}&pubEndDate=${end.toISOString()}` +
    `&resultsPerPage=50`;
  if (isBlockedUrl(url)) throw new Error("nvd url blocked by SSRF guard");
  const res = await fetchImpl(url, {
    signal: timedSignal(),
    headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`nvd cves [${res.status}]`);
  return parseNvdCves(await res.json());
}

// ---------------------------------------------------------------------------
// 3. Tech headlines — Google News RSS (same pattern as the morning briefing)
// ---------------------------------------------------------------------------

const TECH_RSS_URL =
  "https://news.google.com/rss/search?q=artificial%20intelligence%20technology&hl=en&gl=US&ceid=US:en";
const TECH_LIMIT = 8;

/** Pure parser — exported for tests. */
export function parseTechRssItems(xml: string, limit = TECH_LIMIT): RadarItem[] {
  const blocks = xml.split(/<item[\s>]/i).slice(1);
  const items: RadarItem[] = [];
  for (const block of blocks) {
    const tm = /<title>([\s\S]*?)<\/title>/i.exec(block);
    const lm = /<link>([\s\S]*?)<\/link>/i.exec(block);
    const pm = /<pubDate>([\s\S]*?)<\/pubDate>/i.exec(block);
    if (!tm) continue;
    const title = tm[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .trim();
    if (!title) continue;
    const url = safeUrl(lm?.[1]?.trim() ?? "");
    items.push({
      category: "tech",
      title: sanitizeFetchedText(title, 250),
      detail: sanitizeFetchedText("Tech headline via Google News RSS.", 200),
      url,
      publishedAt: toIso(pm?.[1]?.trim() ?? ""),
    });
    if (items.length >= limit) break;
  }
  return items;
}

export async function fetchTechHeadlines(fetchImpl: FetchImpl = fetch): Promise<RadarItem[]> {
  if (isBlockedUrl(TECH_RSS_URL)) throw new Error("tech rss url blocked by SSRF guard");
  const res = await fetchImpl(TECH_RSS_URL, {
    signal: timedSignal(),
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`tech rss [${res.status}]`);
  return parseTechRssItems(await res.text());
}

// ---------------------------------------------------------------------------
// Combined radar — one source failing never kills the run
// ---------------------------------------------------------------------------

export async function fetchTechRadar(fetchImpl: FetchImpl = fetch): Promise<RadarItem[]> {
  const settled = await Promise.allSettled([
    fetchModelReleases(fetchImpl),
    fetchSecurityAdvisories(fetchImpl),
    fetchTechHeadlines(fetchImpl),
  ]);
  const items: RadarItem[] = [];
  const labels = ["models", "cves", "tech-rss"] as const;
  settled.forEach((r, i) => {
    if (r.status === "fulfilled") {
      items.push(...r.value);
    } else {
      console.warn(`[tech-radar] ${labels[i]} unavailable:`, r.reason instanceof Error ? r.reason.message : r.reason);
    }
  });
  return items;
}
