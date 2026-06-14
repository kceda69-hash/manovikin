import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

function assertAdmin(userId: string) {
  const raw = process.env.SEO_ADMIN_USER_IDS ?? process.env.ADMIN_USER_IDS ?? "";
  const admins = raw.split(",").map((s) => s.trim()).filter(Boolean);
  if (admins.length === 0 || !admins.includes(userId)) {
    throw new Response("Forbidden", { status: 403 });
  }
}


const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const SITE_URL = "https://manovik.in/";
const SITEMAP_URL = "https://manovik.in/sitemap.xml";

function authHeaders() {
  const lk = process.env.LOVABLE_API_KEY;
  const gk = process.env.GOOGLE_SEARCH_CONSOLE_API_KEY;
  if (!lk) throw new Error("LOVABLE_API_KEY missing");
  if (!gk) throw new Error("GOOGLE_SEARCH_CONSOLE_API_KEY missing");
  return {
    Authorization: `Bearer ${lk}`,
    "X-Connection-Api-Key": gk,
    "Content-Type": "application/json",
  };
}

async function gsc(path: string, init: RequestInit = {}): Promise<{ ok: boolean; status: number; body: any; raw: string }> {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...authHeaders(), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  const body = text ? safeJson(text) : null;
  return { ok: res.ok, status: res.status, body, raw: text };
}

function safeJson(s: string): any {
  try { return JSON.parse(s); } catch { return s; }
}

const enc = (u: string) => encodeURIComponent(u);

// Internal helper for trusted callers (cron webhook). Not exported as a serverFn.
export async function submitSitemapInternal() {
  const r = await gsc(
    `/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps/${enc(SITEMAP_URL)}`,
    { method: "PUT" },
  );
  return { ok: r.ok, status: r.status, body: r.body };
}

/** Verify ownership of manovik.in via META tag (must already be deployed). */
export const verifySite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.userId);
    const verify = await gsc(`/siteVerification/v1/webResource?verificationMethod=META`, {
      method: "POST",
      body: JSON.stringify({ site: { identifier: SITE_URL, type: "SITE" } }),
    });
    if (!verify.ok) {
      return { verified: false, status: verify.status, error: verify.body };
    }
    const add = await gsc(`/webmasters/v3/sites/${enc(SITE_URL)}`, { method: "PUT" });
    return { verified: true, addStatus: add.status, addBody: add.body };
  });

/** Submit (or re-submit) the sitemap. */
export const submitSitemap = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.userId);
    return submitSitemapInternal();
  });

/** Fetch sitemap status + recent search-analytics summary. */
export const getSeoHealth = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    assertAdmin(context.userId);

    const sites = await gsc(`/webmasters/v3/sites`);
    const sitemaps = await gsc(`/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps`);

    const today = new Date();
    const end = today.toISOString().slice(0, 10);
    const startDate = new Date(today.getTime() - 28 * 86400_000).toISOString().slice(0, 10);

    const totals = await gsc(
      `/webmasters/v3/sites/${enc(SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({ startDate, endDate: end, dimensions: [] }),
      },
    );
    const byDate = await gsc(
      `/webmasters/v3/sites/${enc(SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({ startDate, endDate: end, dimensions: ["date"], rowLimit: 30 }),
      },
    );
    const topQueries = await gsc(
      `/webmasters/v3/sites/${enc(SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({ startDate, endDate: end, dimensions: ["query"], rowLimit: 10 }),
      },
    );
    const topPages = await gsc(
      `/webmasters/v3/sites/${enc(SITE_URL)}/searchAnalytics/query`,
      {
        method: "POST",
        body: JSON.stringify({ startDate, endDate: end, dimensions: ["page"], rowLimit: 10 }),
      },
    );

    return {
      site: SITE_URL,
      range: { startDate, endDate: end },
      verified: sites.ok && JSON.stringify(sites.body).includes(SITE_URL),
      sites: sites.body,
      sitemaps: sitemaps.body,
      totals: totals.body,
      byDate: byDate.body,
      topQueries: topQueries.body,
      topPages: topPages.body,
    };
  });

const inspectInput = z.object({ url: z.string().url() });
export const inspectUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => inspectInput.parse(d))
  .handler(async ({ data }) => {
    const r = await gsc(`/v1/urlInspection/index:inspect`, {
      method: "POST",
      body: JSON.stringify({ inspectionUrl: data.url, siteUrl: SITE_URL }),
    });
    return { ok: r.ok, status: r.status, body: r.body };
  });
