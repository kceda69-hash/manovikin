/**
 * Shared per-agent-action audit logging (agent-safety audit fix).
 *
 * Problem: audit_logs was written only by chat turns, admin actions, credit
 * refunds and balance ops — nothing from mission steps, sentinel, schedule
 * runs, device commands, gmail/calendar writes, smart-home, Spotify or
 * dossiers. An incident on any autonomous surface was unreconstructable.
 *
 * Every autonomous action should call logAgentAction() with a short summary
 * and redacted metadata. Writes go to the existing audit_logs table
 * (event_type prefixed "agent."). Logging never throws: a failed audit
 * write must not break the action it observes — failures go to the
 * structured worker log so gaps stay visible in tail logs.
 *
 * Privacy: never put secrets, full email bodies, or raw tokens in summary
 * or metadata. The structured logger redacts *-key/*-secret/*-token fields,
 * but prefer truncated identifiers anyway.
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { log } from "@/lib/logger";

export interface AgentActionLog {
  userId: string;
  /** Machine-readable action name, e.g. "mission.step", "device.command". */
  action: string;
  /** Human-readable one-liner. Keep it short and secret-free. */
  summary: string;
  threadId?: string | null;
  metadata?: Record<string, unknown>;
}

/** Minimal DB surface so unit tests can inject a fake. */
export interface AgentAuditDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultDb = supabaseAdmin as any as AgentAuditDb;

export async function logAgentAction(entry: AgentActionLog, db: AgentAuditDb = defaultDb): Promise<void> {
  try {
    const { error } = await db.from("audit_logs").insert({
      user_id: entry.userId,
      thread_id: entry.threadId ?? null,
      event_type: `agent.${entry.action}`,
      summary: entry.summary,
      metadata: entry.metadata ?? {},
    });
    if (error) {
      log.warn("agent_audit_write_failed", {
        action: entry.action,
        error: error.message ?? "unknown",
      });
    }
  } catch (e) {
    log.warn("agent_audit_write_failed", {
      action: entry.action,
      error: e instanceof Error ? e.message : "unknown",
    });
  }
}
