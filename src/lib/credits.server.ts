/**
 * Server-only credit pricing for MANOVIK's heavy paths.
 *
 * The chat turn (1 credit) and image generation (2 credits) were already
 * metered. The Jarvis features — missions, ambient watch, briefings,
 * scheduled routines, dossiers — burned model calls off the meter, so a
 * one-time 800-credit grant could generate unbounded API cost. This module
 * prices what burns; each heavy path calls spendCredits() before doing work.
 *
 * Never throws: billing must not break the feature. All failures surface as
 * "failed" so callers can decide (usually: skip the work, keep the error).
 */

export const CREDIT_PRICES = {
  /** One chat turn (existing). */
  chatTurn: 1,
  /** One image generation (existing). */
  imageGenerate: 2,
  /** Per autonomous-mission step (controller call + tool run). */
  missionStep: 1,
  /** Per analyzed Ambient Watch frame. */
  ambientFrame: 1,
  /** One morning-briefing delivery. */
  briefingDaily: 2,
  /** One scheduled-routine run. */
  routineRun: 1,
  /** One public professional dossier. */
  dossierBrief: 3,
} as const;

/** Max Ambient Watch frames analyzed per user per day (~every 15 min). */
export const AMBIENT_FRAMES_PER_DAY_CAP = 96;

export type SpendOutcome = "ok" | "insufficient" | "failed";

/** Minimal structural type for the admin client: only the RPC we need.
 *  Loosely typed on purpose — the generated SupabaseClient narrows rpc()
 *  to known function names, which must still be assignable here. */
export type RpcCapable = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (...args: any[]) => PromiseLike<{ data: any; error: { message: string } | null }>;
};

/**
 * Atomically spend credits via the manovik_spend_credit RPC (it refuses the
 * spend when the balance is too low — no partial/negative balances).
 * Never throws.
 */
export async function spendCredits(
  admin: RpcCapable,
  userId: string,
  amount: number,
  reason: string,
): Promise<SpendOutcome> {
  try {
    const { data, error } = await admin.rpc("manovik_spend_credit", {
      _user_id: userId,
      _amount: amount,
      _reason: reason,
    });
    if (error) {
      console.error("[credits] spend RPC failed", reason, error.message);
      return "failed";
    }
    // The RPC returns -1 when the balance can't cover the amount.
    if (typeof data === "number" && data < 0) return "insufficient";
    return "ok";
  } catch (e) {
    console.error("[credits] spend exception", reason, e instanceof Error ? e.message : e);
    return "failed";
  }
}

/** Admins (Nick) are exempt from metering. Never throws; defaults to false. */
export async function isBillingExempt(admin: RpcCapable, userId: string): Promise<boolean> {
  try {
    const { data } = await admin.rpc("has_role", { _user_id: userId, _role: "admin" });
    return !!data;
  } catch {
    return false;
  }
}

/** UTC day key for per-day reason prefixes, e.g. "2026-10-01". */
export function utcDayKey(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}
