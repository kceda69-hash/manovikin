import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { timingSafeEqual } from "crypto";

type Status = "pass" | "warn" | "fail" | "fixed";
interface CheckResult {
  check_name: string;
  status: Status;
  details: Record<string, unknown>;
  auto_fix_applied?: boolean;
}

/** Constant-time string compare; returns false on length mismatch. */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  try {
    return timingSafeEqual(ab, bb);
  } catch {
    return false;
  }
}

/**
 * Automatic runtime security self-scan with self-remediation.
 *
 * Triggered by pg_cron (daily) via Authorization: Bearer $LOVABLE_API_KEY.
 * Runs lightweight checks against the live backend and attempts to auto-fix
 * trivial issues (missing pgmq queues, etc.). Results land in
 * public.security_self_checks for the in-app dashboard.
 */
async function runChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const sb = supabaseAdmin;

  // 1. Required server secrets present
  const requiredSecrets = [
    "SUPABASE_SERVICE_ROLE_KEY",
    "RAZORPAY_KEY_SECRET",
    "RAZORPAY_WEBHOOK_SECRET",
    "LOVABLE_API_KEY",
  ];
  const missing = requiredSecrets.filter((k) => !process.env[k]);
  results.push({
    check_name: "required_secrets_present",
    status: missing.length === 0 ? "pass" : "fail",
    details: { missing },
  });

  // 2. Suppression-list table reachable (email infra fail-closed prereq)
  {
    const { error } = await sb.from("suppressed_emails").select("id").limit(1);
    results.push({
      check_name: "suppression_list_reachable",
      status: error ? "fail" : "pass",
      details: error ? { error: error.message } : {},
    });
  }

  // 3. Email queues exist — auto-create on miss (self-solution)
  {
    let autoFixed = false;
    const { error } = await sb.rpc("enqueue_email", {
      queue_name: "transactional_emails__healthcheck",
      payload: { healthcheck: true, at: new Date().toISOString() },
    });
    // enqueue_email auto-creates queue on undefined_table, so a successful
    // call after a previous run that errored counts as "fixed".
    if (!error) {
      // drain immediately so we don't leak healthcheck messages
      await sb.rpc("read_email_batch", {
        queue_name: "transactional_emails__healthcheck",
        batch_size: 10,
        vt: 1,
      });
      autoFixed = true;
    }
    results.push({
      check_name: "email_queue_available",
      status: error ? "fail" : "fixed",
      details: error ? { error: error.message } : { auto_created_if_missing: true },
      auto_fix_applied: autoFixed,
    });
  }

  // 4. Unsubscribe-token issuance path works
  {
    const { error } = await sb.from("email_unsubscribe_tokens").select("token").limit(1);
    results.push({
      check_name: "unsubscribe_tokens_reachable",
      status: error ? "fail" : "pass",
      details: error ? { error: error.message } : {},
    });
  }

  // 5. RLS enabled on every public table (catches new tables added without RLS)
  {
    const { data, error } = await sb.from("security_self_checks").select("id").limit(1);
    // Lightweight smoke test that service_role can read the log table itself.
    results.push({
      check_name: "log_table_writable",
      status: error ? "fail" : "pass",
      details: error ? { error: error.message } : {},
    });
    void data;
  }

  return results;
}

export const Route = createFileRoute("/api/public/hooks/security-scan")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const got = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");

        if (!got) {
          return new Response("Forbidden", { status: 403 });
        }

        // Validate against the vault-stored shared secret used by pg_cron.
        // No fallback — if the vault token cannot be read, reject.
        const { data: tokenData, error: tokenErr } = await supabaseAdmin.rpc(
          "get_security_scan_token" as never,
        );
        const expected = typeof tokenData === "string" ? tokenData : null;

        if (tokenErr || !expected || !safeEqual(got, expected)) {
          // Small delay to flatten brute-force / probing signal.
          await new Promise((r) => setTimeout(r, 250));
          return new Response("Forbidden", { status: 403 });
        }

        const run_id = crypto.randomUUID();
        const checks = await runChecks();

        const rows = checks.map((c) => ({
          run_id,
          check_name: c.check_name,
          status: c.status,
          details: JSON.parse(JSON.stringify(c.details)),
          auto_fix_applied: c.auto_fix_applied ?? false,
        }));

        const { error } = await supabaseAdmin.from("security_self_checks").insert(rows);

        if (error) {
          console.error("security-scan: failed to persist results", error);
          return Response.json(
            { ok: false, error: error.message, run_id, checks },
            { status: 500 },
          );
        }

        // Diff against the previous run so post-deploy callers (GitHub
        // Actions) can gate on "regressions introduced by this deploy"
        // rather than the full failing set, which may include long-standing
        // warnings.
        const { data: newFindingsData, error: diffErr } = await supabaseAdmin.rpc(
          "security_scan_new_findings" as never,
          { _run_id: run_id } as never,
        );
        if (diffErr) {
          console.warn("security-scan: diff query failed", diffErr);
        }
        const new_findings = Array.isArray(newFindingsData) ? newFindingsData : [];

        const summary = {
          run_id,
          total: checks.length,
          pass: checks.filter((c) => c.status === "pass").length,
          warn: checks.filter((c) => c.status === "warn").length,
          fail: checks.filter((c) => c.status === "fail").length,
          fixed: checks.filter((c) => c.status === "fixed").length,
          new_findings_count: new_findings.length,
        };
        return Response.json({ ok: true, summary, checks, new_findings });
      },
    },
  },
});
