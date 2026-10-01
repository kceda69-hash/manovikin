/**
 * Server-only idempotent credit refunds + lost-credit self-healing.
 *
 * Every credit spend in MANOVIK is a reservation against a unique id
 * (chat turn, image generation, mission step...). When the work fails after
 * the spend, the credit must come back — durably, exactly once, and without
 * breaking the request that is already failing.
 *
 * Durability: callers AWAIT the refund before the response stream closes
 * (or before the error Response is returned), so the Cloudflare worker
 * stays alive until the refund commits — never fire-and-forget.
 *
 * Idempotency: keyed by the unique refund reason (e.g.
 * `chat.refund:<turnId>`). A ledger row with that reason is written exactly
 * once; if it already exists the refund is skipped, so retries and
 * double-fires can never credit the user twice.
 *
 * Never throws: billing must not break error handling. All failures are
 * logged and surface as "failed"; the self-heal pass retries them later.
 */
import { log } from "@/lib/logger";

/** Minimal structural DB surface the refund helpers need.
 *  Loosely typed on purpose — the generated SupabaseClient narrows
 *  from()/rpc() to known tables/functions, which must still be
 *  assignable here (same rationale as RpcCapable in credits.server.ts). */
export interface RefundDb {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rpc: (...args: any[]) => PromiseLike<{ data: any; error: { message: string } | null }>;
}

export type RefundOutcome = "refunded" | "already-refunded" | "failed";

/** Refund attempts and pacing. The whole refund is bounded by
 *  REFUND_DEADLINE_MS so a struggling database delays an already-failed
 *  request by seconds, not minutes. */
const REFUND_MAX_ATTEMPTS = 3;
const REFUND_ATTEMPT_TIMEOUT_MS = 8_000;
const REFUND_RETRY_BACKOFF_MS = [1_500, 3_000];
const REFUND_DEADLINE_MS = 20_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function attemptRefundOnce(
  db: RefundDb,
  userId: string,
  amount: number,
  refundReason: string,
): Promise<RefundOutcome> {
  const { data: existing, error: checkErr } = await db
    .from("ai_balance_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("reason", refundReason)
    .limit(1);
  if (checkErr) throw new Error(`refund ledger check failed: ${checkErr.message}`);
  if (existing && existing.length > 0) return "already-refunded";
  const { error } = await db.rpc("manovik_topup_credit", {
    _user_id: userId,
    _amount: amount,
    _reason: refundReason,
  });
  if (error) throw new Error(`refund topup failed: ${error.message}`);
  return "refunded";
}

/**
 * Refund a spent credit, idempotently, with retries. The refund reason must
 * be unique per charge (e.g. `chat.refund:<turnId>`, `image.refund:<genId>`).
 * Never throws.
 */
export async function refundCreditIdempotent(
  db: RefundDb,
  opts: {
    userId: string;
    amount: number;
    refundReason: string;
    context?: Record<string, unknown>;
  },
): Promise<RefundOutcome> {
  const { userId, amount, refundReason, context } = opts;
  const deadline = Date.now() + REFUND_DEADLINE_MS;
  for (let attempt = 1; attempt <= REFUND_MAX_ATTEMPTS; attempt++) {
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    try {
      const outcome = await Promise.race([
        attemptRefundOnce(db, userId, amount, refundReason),
        sleep(Math.min(REFUND_ATTEMPT_TIMEOUT_MS, remaining)).then(
          () => "timeout" as const,
        ),
      ]);
      if (outcome === "refunded" || outcome === "already-refunded") {
        if (outcome === "refunded") {
          log.info("credit.refund.ok", { userId, refundReason, attempt, ...context });
        }
        return outcome;
      }
      log.warn("credit.refund.attempt_failed", {
        userId,
        refundReason,
        attempt,
        outcome,
        ...context,
      });
    } catch (e) {
      log.warn("credit.refund.attempt_failed", {
        userId,
        refundReason,
        attempt,
        error: e instanceof Error ? e.message : String(e).slice(0, 200),
        ...context,
      });
    }
    if (attempt < REFUND_MAX_ATTEMPTS) {
      const backoff = REFUND_RETRY_BACKOFF_MS[attempt - 1] ?? 3_000;
      await sleep(Math.min(backoff, Math.max(0, deadline - Date.now())));
    }
  }
  log.error("credit.refund.exhausted", { userId, refundReason, ...context });
  return "failed";
}

/**
 * Self-healing: refund credits for chat turns that were charged but never
 * completed and never refunded (e.g. the worker died mid-turn before the
 * refund could commit). Runs at the start of each turn, best-effort.
 *
 * Only considers spends older than 15 minutes so a turn that is still
 * in-flight in a concurrent request is never touched. Only the
 * `chat.message:<turnId>` reason format is eligible (older rows predate
 * turn tracking and are left alone). Scans up to 7 days back, 100 rows —
 * a successfully finished turn writes a message.assistant audit row
 * carrying its turnId, so completed turns are never refunded.
 *
 * Returns the number of refunds issued. Never throws.
 */
export async function healLostChatCredits(db: RefundDb, userId: string): Promise<number> {
  try {
    const now = Date.now();
    const cutoff = new Date(now - 15 * 60 * 1000).toISOString();
    const weekAgo = new Date(now - 7 * 24 * 3600 * 1000).toISOString();
    const { data: spends, error: spendsErr } = await db
      .from("ai_balance_ledger")
      .select("reason, created_at")
      .eq("user_id", userId)
      .eq("delta", -1)
      .like("reason", "chat.message:%")
      .gte("created_at", weekAgo)
      .lt("created_at", cutoff)
      .limit(100);
    if (spendsErr) throw new Error(spendsErr.message);
    if (!spends || spends.length === 0) return 0;
    let healed = 0;
    for (const spend of spends) {
      const turnId = String(spend.reason ?? "").split(":")[1];
      if (!turnId) continue;
      // A successfully finished turn writes a message.assistant audit row
      // carrying its turnId — if present, the charge stands.
      const { data: completed } = await db
        .from("audit_logs")
        .select("id")
        .eq("user_id", userId)
        .eq("event_type", "message.assistant")
        .filter("metadata->>turnId", "eq", turnId)
        .limit(1);
      if (completed && completed.length > 0) continue;
      log.warn("credit.self_heal_refund", { userId, turnId });
      const outcome = await refundCreditIdempotent(db, {
        userId,
        amount: 1,
        refundReason: `chat.refund:${turnId}`,
        context: { source: "self-heal", turnId },
      });
      if (outcome === "refunded") healed++;
    }
    return healed;
  } catch (e) {
    log.warn("credit.self_heal_failed", {
      userId,
      error: e instanceof Error ? e.message : String(e).slice(0, 200),
    });
    return 0;
  }
}
