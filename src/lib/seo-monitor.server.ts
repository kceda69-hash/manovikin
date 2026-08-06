// Automated SEO monitoring: pulls Google Search Console state, stores a
// snapshot, compares it against the previous run, and raises alerts when
// crawl (sitemap) or indexing errors increase. Server-only.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { log } from "@/lib/logger";

const GATEWAY = "https://connector-gateway.lovable.dev/google_search_console";
const SITE_URL = "https://manovik.in/";
const FROM_DOMAIN = "manovik.in";
const SENDER_DOMAIN = "notify.manovik.in";
const APP_ORIGIN = process.env.APP_ORIGIN || "https://manovik.in";

const enc = (u: string) => encodeURIComponent(u);

function headers() {
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

async function gsc(path: string, init: RequestInit = {}) {
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: { ...headers(), ...(init.headers as Record<string, string> | undefined) },
  });
  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    /* keep raw text */
  }
  return { ok: res.ok, status: res.status, body: body as any };
}

type SitemapRow = {
  path: string;
  errors?: string | number;
  warnings?: string | number;
  contents?: Array<{ submitted?: string | number; indexed?: string | number }>;
};

const num = (v: unknown) => (v == null ? 0 : Number(v) || 0);

export type MonitorResult = {
  ok: boolean;
  snapshotId: string | null;
  alerts: Array<{ kind: string; severity: string; message: string }>;
  metrics: {
    sitemapErrors: number;
    sitemapWarnings: number;
    indexedUrls: number | null;
    clicks: number;
    impressions: number;
    avgPosition: number | null;
  };
};

/** Run one monitoring cycle. Safe to call repeatedly (cron). */
export async function runSeoMonitor(): Promise<MonitorResult> {
  const sitemaps = await gsc(`/webmasters/v3/sites/${enc(SITE_URL)}/sitemaps`);
  const end = new Date().toISOString().slice(0, 10);
  const startDate = new Date(Date.now() - 7 * 86400_000).toISOString().slice(0, 10);
  const totals = await gsc(`/webmasters/v3/sites/${enc(SITE_URL)}/searchAnalytics/query`, {
    method: "POST",
    body: JSON.stringify({ startDate, endDate: end, dimensions: [] }),
  });

  const rows: SitemapRow[] = sitemaps.body?.sitemap ?? [];
  const sitemapErrors = rows.reduce((a, r) => a + num(r.errors), 0);
  const sitemapWarnings = rows.reduce((a, r) => a + num(r.warnings), 0);
  const submitted = rows.reduce(
    (a, r) => a + (r.contents ?? []).reduce((b, c) => b + num(c.submitted), 0),
    0,
  );
  const indexedUrls = rows.length
    ? rows.reduce((a, r) => a + (r.contents ?? []).reduce((b, c) => b + num(c.indexed), 0), 0)
    : null;

  const t = totals.body?.rows?.[0];
  const clicks = Math.round(num(t?.clicks));
  const impressions = Math.round(num(t?.impressions));
  const avgPosition = t?.position != null ? Number(t.position) : null;
  const reachable = sitemaps.ok && totals.ok;

  // Previous snapshot for delta comparison
  const { data: prev } = await supabaseAdmin
    .from("seo_monitor_snapshots")
    .select("*")
    .order("captured_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: snapshot } = await supabaseAdmin
    .from("seo_monitor_snapshots")
    .insert({
      site_url: SITE_URL,
      sitemap_errors: sitemapErrors,
      sitemap_warnings: sitemapWarnings,
      indexed_urls: indexedUrls,
      clicks,
      impressions,
      avg_position: avgPosition,
      ok: reachable,
      raw: {
        sitemapStatus: sitemaps.status,
        analyticsStatus: totals.status,
        submitted,
        sitemaps: rows.map((r) => ({
          path: r.path,
          errors: num(r.errors),
          warnings: num(r.warnings),
        })),
      },
    })
    .select("id")
    .maybeSingle();

  const alerts: Array<{ kind: string; severity: string; message: string; details: any }> = [];

  if (!reachable) {
    alerts.push({
      kind: "gsc_unreachable",
      severity: "critical",
      message: "Search Console could not be reached during the scheduled SEO check.",
      details: { sitemapStatus: sitemaps.status, analyticsStatus: totals.status },
    });
  }

  const prevErrors = prev ? Number(prev.sitemap_errors ?? 0) : null;
  if (reachable && sitemapErrors > 0 && (prevErrors === null || sitemapErrors > prevErrors)) {
    alerts.push({
      kind: "crawl_errors_increased",
      severity: sitemapErrors >= 5 ? "critical" : "warning",
      message: `Sitemap crawl errors increased to ${sitemapErrors}${
        prevErrors !== null ? ` (was ${prevErrors})` : ""
      }.`,
      details: { current: sitemapErrors, previous: prevErrors, sitemaps: rows.map((r) => r.path) },
    });
  }

  const prevWarnings = prev ? Number(prev.sitemap_warnings ?? 0) : null;
  if (
    reachable &&
    sitemapWarnings > 0 &&
    prevWarnings !== null &&
    sitemapWarnings > prevWarnings * 1.5
  ) {
    alerts.push({
      kind: "crawl_warnings_increased",
      severity: "warning",
      message: `Sitemap crawl warnings rose from ${prevWarnings} to ${sitemapWarnings}.`,
      details: { current: sitemapWarnings, previous: prevWarnings },
    });
  }

  const prevIndexed = prev?.indexed_urls != null ? Number(prev.indexed_urls) : null;
  if (
    reachable &&
    indexedUrls !== null &&
    prevIndexed !== null &&
    prevIndexed > 0 &&
    indexedUrls < prevIndexed * 0.8
  ) {
    alerts.push({
      kind: "indexing_dropped",
      severity: "critical",
      message: `Indexed URLs dropped from ${prevIndexed} to ${indexedUrls} — possible indexing errors.`,
      details: { current: indexedUrls, previous: prevIndexed },
    });
  }

  if (reachable && submitted > 0 && indexedUrls !== null && indexedUrls === 0) {
    alerts.push({
      kind: "nothing_indexed",
      severity: "critical",
      message: `Google reports 0 indexed URLs for ${submitted} submitted sitemap URLs.`,
      details: { submitted },
    });
  }

  const inserted: Array<{ kind: string; severity: string; message: string }> = [];
  for (const a of alerts) {
    // De-dupe: skip if an unacknowledged alert of the same kind already exists.
    const { data: open } = await supabaseAdmin
      .from("seo_monitor_alerts")
      .select("id")
      .eq("kind", a.kind)
      .is("acknowledged_at", null)
      .maybeSingle();
    if (open) continue;

    const { data: row } = await supabaseAdmin
      .from("seo_monitor_alerts")
      .insert({
        kind: a.kind,
        severity: a.severity,
        message: a.message,
        details: a.details,
        snapshot_id: snapshot?.id ?? null,
      })
      .select("id")
      .maybeSingle();

    inserted.push({ kind: a.kind, severity: a.severity, message: a.message });
    if (row?.id) await notifyAdmins(row.id, a.severity, a.message, a.details);
  }

  log.info("seo_monitor.run", {
    sitemapErrors,
    sitemapWarnings,
    indexedUrls,
    newAlerts: inserted.length,
  });

  return {
    ok: reachable,
    snapshotId: snapshot?.id ?? null,
    alerts: inserted,
    metrics: { sitemapErrors, sitemapWarnings, indexedUrls, clicks, impressions, avgPosition },
  };
}

async function adminEmails(): Promise<string[]> {
  const extra = (process.env.SEO_ALERT_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<string>(extra);
  const { data: roles } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "admin");
  for (const r of roles ?? []) {
    const { data } = await supabaseAdmin.auth.admin.getUserById(r.user_id as string);
    const email = data?.user?.email?.toLowerCase();
    if (email) out.add(email);
  }
  return [...out];
}

async function notifyAdmins(alertId: string, severity: string, message: string, details: unknown) {
  let recipients: string[] = [];
  try {
    recipients = await adminEmails();
  } catch (e) {
    log.warn("seo_monitor.recipients_failed", { error: String(e) });
  }
  if (!recipients.length) return;

  const subject = `[MANOVIK SEO ${severity === "critical" ? "CRITICAL" : "alert"}] ${message.slice(0, 90)}`;
  const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">
    <h2 style="margin:0 0 8px">SEO monitoring alert</h2>
    <p style="margin:0 0 12px"><strong>${escapeHtml(message)}</strong></p>
    <pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:12px;overflow:auto">${escapeHtml(
      JSON.stringify(details, null, 2),
    )}</pre>
    <p><a href="${APP_ORIGIN}/seo">Open the SEO health dashboard</a></p>
  </div>`;
  const text = `SEO monitoring alert\n\n${message}\n\n${JSON.stringify(details, null, 2)}\n\n${APP_ORIGIN}/seo`;

  for (const to of recipients) {
    const { error } = await supabaseAdmin.rpc("enqueue_email", {
      queue_name: "transactional_emails",
      payload: {
        message_id: crypto.randomUUID(),
        to,
        from: `MANOVIK AI <noreply@${FROM_DOMAIN}>`,
        sender_domain: SENDER_DOMAIN,
        subject,
        html,
        text,
        purpose: "transactional",
        label: "seo-alert",
        idempotency_key: `seo-alert-${alertId}-${to}`,
        queued_at: new Date().toISOString(),
      },
    });
    if (error) log.warn("seo_monitor.enqueue_failed", { error: error.message });
  }

  await supabaseAdmin
    .from("seo_monitor_alerts")
    .update({ notified_at: new Date().toISOString() })
    .eq("id", alertId);
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string,
  );
}
