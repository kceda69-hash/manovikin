import { createFileRoute } from "@tanstack/react-router";
import { isAuthorizedHookOrCronToken } from "@/lib/hook-auth";
import { log } from "@/lib/logger";

/**
 * AI health probe (pg_cron, every 15 min).
 *
 * Authorised with `Bearer <vault:ai_health_token>` or MANOVIK_HOOK_SECRET —
 * the same dual-auth shape as agent-fleet-tick. Unauthenticated calls 403.
 *
 * Runs an end-to-end probe through the production model chain, records the
 * result in public.ai_health_checks, and on failure creates a de-duped alert
 * in public.ai_health_alerts + emails admins. Recovery auto-resolves.
 */
export const Route = createFileRoute("/api/public/hooks/ai-health")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data: tokenData } = await supabaseAdmin.rpc("get_ai_health_token" as never);
        const cronToken = typeof tokenData === "string" ? tokenData : null;
        if (!isAuthorizedHookOrCronToken(request, cronToken)) {
          return Response.json({ error: "Forbidden" }, { status: 403 });
        }

        try {
          const { runAiHealthProbe } = await import("@/lib/ai-health.server");
          const result = await runAiHealthProbe();

          // Record the check. (ai_health_checks is new; not in generated types yet.)
          const { error: insertErr } = await (supabaseAdmin.from as unknown as (
            t: string,
          ) => {
            insert: (
              r: Record<string, unknown>,
            ) => Promise<{ error: { message: string } | null }>;
          })("ai_health_checks").insert({
            ok: result.ok,
            model: result.model,
            latency_ms: result.latencyMs,
            error: result.error,
          });
          if (insertErr) log.warn("ai_health.record_failed", { error: insertErr.message });

          if (result.ok) {
            await autoResolveAlerts(supabaseAdmin);
          } else {
            await maybeAlert(supabaseAdmin, result);
          }

          return Response.json({ ok: result.ok, result });
        } catch (e) {
          log.error("ai_health.handler_failed", { error: e instanceof Error ? e.message : String(e) });
          return Response.json({ ok: false, error: String(e) }, { status: 500 });
        }
      },
    },
  },
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Db = any;

/** Auto-resolve open alerts when the probe recovers. */
async function autoResolveAlerts(db: Db): Promise<void> {
  try {
    const { error } = await (db.from("ai_health_alerts") as {
      update: (p: Record<string, unknown>) => {
        is: (c: string, v: null) => Promise<{ error: { message: string } | null }>;
      };
    })
      .update({ resolved_at: new Date().toISOString() })
      .is("resolved_at", null);
    if (error) log.warn("ai_health.autoresolve_failed", { error: error.message });
    else log.info("ai_health.recovered", {});
  } catch (e) {
    log.warn("ai_health.autoresolve_failed", { error: String(e) });
  }
}

/**
 * Create a de-duped alert + email admins on failure. Skips when an
 * unacknowledged, unresolved alert already exists (avoids alert spam every
 * 15 min during an ongoing outage).
 */
async function maybeAlert(
  db: Db,
  result: { error: string | null; model: string | null; latencyMs: number; attempts: unknown },
): Promise<void> {
  try {
    const { data: open } = await db
      .from("ai_health_alerts")
      .select("id")
      .eq("resolved_at", null)
      .is("acknowledged_at", null)
      .order("created_at", { ascending: false })
      .limit(1);
    if (open && open.length > 0) {
      log.info("ai_health.alert_deduped", {});
      return;
    }

    const message = `MANOVIK AI health probe failed: ${result.error ?? "unknown error"}`;
    const { data: inserted, error: insertErr } = await db
      .from("ai_health_alerts")
      .insert({
        severity: "critical",
        message,
        details: {
          model: result.model,
          latencyMs: result.latencyMs,
          attempts: result.attempts,
        },
      })
      .select("id")
      .single();
    if (insertErr) {
      log.warn("ai_health.alert_failed", { error: insertErr.message });
      return;
    }
    const alertId = (inserted as { id: string } | null)?.id ?? "unknown";
    await notifyAdmins(alertId, message, result);
  } catch (e) {
    log.warn("ai_health.alert_failed", { error: String(e) });
  }
}

/** Email admins about the AI outage (mirrors seo-monitor's notifyAdmins). */
async function notifyAdmins(
  alertId: string,
  message: string,
  result: { error: string | null; model: string | null; latencyMs: number; attempts: unknown },
): Promise<void> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const recipients = await getAdminEmails(supabaseAdmin);
    if (!recipients.length) return;

    const subject = `[MANOVIK AI CRITICAL] ${message.slice(0, 90)}`;
    const html = `<div style="font-family:system-ui,sans-serif;line-height:1.5">
        <h2 style="margin:0 0 8px">AI health probe failed</h2>
        <p style="margin:0 0 12px"><strong>${escapeHtml(message)}</strong></p>
        <p>The production AI backend did not respond to the health probe. Users may be unable to chat.</p>
        <pre style="background:#f4f4f5;padding:12px;border-radius:6px;font-size:12px;overflow:auto">${escapeHtml(
          JSON.stringify({ model: result.model, latencyMs: result.latencyMs, attempts: result.attempts }, null, 2),
        )}</pre>
      </div>`;
    const text = `AI health probe failed\n\n${message}\n\n${JSON.stringify({ model: result.model, latencyMs: result.latencyMs }, null, 2)}`;

    for (const to of recipients) {
      const { error } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: crypto.randomUUID(),
          to,
          from: `MANOVIK AI <noreply@${process.env.APP_ORIGIN?.replace(/^https?:\/\//, "") ?? "manovik.in"}>`,
          subject,
          html,
          text,
          purpose: "transactional",
          label: "ai-health-alert",
          idempotency_key: `ai-health-alert-${alertId}-${to}`,
          queued_at: new Date().toISOString(),
        },
      });
      if (error) log.warn("ai_health.enqueue_failed", { error: error.message });
    }
  } catch (e) {
    log.warn("ai_health.notify_failed", { error: String(e) });
  }
}

/** Admin emails: same logic as seo-monitor (user_roles + AI_HEALTH_ALERT_EMAIL). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function getAdminEmails(db: any): Promise<string[]> {
  const extra = (process.env.AI_HEALTH_ALERT_EMAIL || process.env.SEO_ALERT_EMAIL || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const out = new Set<string>(extra);
  try {
    const { data: roles } = await db.from("user_roles").select("user_id").eq("role", "admin");
    for (const r of roles ?? []) {
      const { data } = await db.auth.admin.getUserById(r.user_id as string);
      const email = data?.user?.email?.toLowerCase();
      if (email) out.add(email);
    }
  } catch (e) {
    log.warn("ai_health.recipients_failed", { error: String(e) });
  }
  return [...out];
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
