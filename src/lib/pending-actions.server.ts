/**
 * Server-enforced confirmation queue for high-stakes agent actions.
 *
 * Problem it solves: tool descriptions like "only send after the user
 * approves" are prompt prose — a careless or prompt-injected model can
 * ignore them and the action executes anyway. This module makes the gate
 * structural:
 *
 *   1. STAGE — the tool validates its args, freezes the exact payload in
 *      manovik_pending_actions, and returns a short-lived confirmToken.
 *      Nothing is executed.
 *   2. CONFIRM — the tool is called again with the confirmToken. The server
 *      atomically consumes the token (single UPDATE … WHERE status='pending'
 *      AND expires_at > now(), so concurrent/replayed confirms can't
 *      double-execute) and runs the FROZEN payload — re-supplied args are
 *      ignored, so the model can't bait-and-switch between stage and confirm.
 *
 * Tokens live 10 minutes and are single-use. If the migration hasn't been
 * applied yet, staging throws PendingActionsUnavailableError and the tool
 * must fail closed (never execute unconfirmed).
 */
import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type PendingActionKind = "gmail.send" | "calendar.create" | "calendar.cancel";

export const PENDING_ACTION_TTL_MS = 10 * 60 * 1000;

export class PendingActionsUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PendingActionsUnavailableError";
  }
}

/** Minimal query-builder surface so unit tests can inject a fake DB. */
export interface PendingActionsDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from(table: string): any;
}

export interface StagedAction {
  id: string;
  token: string;
  expiresAt: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const defaultDb = supabaseAdmin as any as PendingActionsDb;

function isMissingTable(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return e.code === "42P01" || (typeof e.message === "string" && e.message.includes("does not exist"));
}

/** Freeze a payload and mint a single-use confirmation token. */
export async function stagePendingAction(
  userId: string,
  kind: PendingActionKind,
  payload: Record<string, unknown>,
  db: PendingActionsDb = defaultDb,
): Promise<StagedAction> {
  const token =
    crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
  const expiresAt = new Date(Date.now() + PENDING_ACTION_TTL_MS).toISOString();
  const { data, error } = await db
    .from("manovik_pending_actions")
    .insert({ user_id: userId, kind, payload, token, status: "pending", expires_at: expiresAt })
    .select("id, token")
    .single();
  if (error) {
    if (isMissingTable(error)) {
      throw new PendingActionsUnavailableError(
        "The confirmation queue is not set up yet — apply supabase/migrations/20261006120000_pending_actions.sql in the Supabase SQL editor, then retry. The action was NOT executed.",
      );
    }
    throw new Error(`pending_action_stage_failed: ${(error as { message?: string }).message ?? "unknown"}`);
  }
  // Opportunistic cleanup of expired rows; never blocks the caller.
  void db
    .from("manovik_pending_actions")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .then(
      () => undefined,
      () => undefined,
    );
  const row = data as { id: string; token: string };
  return { id: row.id, token: row.token, expiresAt };
}

/**
 * Atomically consume a confirmation token and return the frozen payload,
 * or null when the token is unknown, expired, already used, or belongs to
 * a different user/kind. The UPDATE … WHERE is a single statement, so two
 * concurrent confirms can't both succeed.
 */
export async function consumePendingAction(
  userId: string,
  kind: PendingActionKind,
  token: string,
  db: PendingActionsDb = defaultDb,
): Promise<Record<string, unknown> | null> {
  const { data, error } = await db
    .from("manovik_pending_actions")
    .update({ status: "consumed" })
    .eq("token", token)
    .eq("user_id", userId)
    .eq("kind", kind)
    .eq("status", "pending")
    .gt("expires_at", new Date().toISOString())
    .select("payload")
    .maybeSingle();
  if (error) {
    if (isMissingTable(error)) {
      throw new PendingActionsUnavailableError(
        "The confirmation queue is not set up yet — apply supabase/migrations/20261006120000_pending_actions.sql in the Supabase SQL editor, then retry. The action was NOT executed.",
      );
    }
    return null;
  }
  if (!data) return null;
  return (data as { payload: Record<string, unknown> }).payload;
}
