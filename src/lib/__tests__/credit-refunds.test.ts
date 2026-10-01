/**
 * Focused tests for the shared idempotent refund helper and the lost-credit
 * self-heal (src/lib/credit-refunds.server.ts).
 *
 * These cover the exact failure modes from the 2026-09-29 credit-refund
 * audit: refund retries, idempotent double-refund protection, and the
 * self-heal's skip conditions.
 */
import { describe, expect, it, vi } from "vitest";
import {
  healLostChatCredits,
  refundCreditIdempotent,
  type RefundDb,
} from "@/lib/credit-refunds.server";

interface FakeDbOpts {
  /** Rows returned for ai_balance_ledger refund-existence checks (select "id"). */
  refundRows?: unknown[];
  /** Rows returned for ai_balance_ledger spend scans (select "reason, created_at"). */
  spendRows?: { reason: string; created_at: string }[];
  /** Rows returned for audit_logs selects. */
  auditRows?: unknown[];
  rpcImpl?: (fn: string, args: Record<string, unknown>) => { data: unknown; error: { message: string } | null };
}

function makeFakeDb(opts: FakeDbOpts = {}) {
  const rpcCalls: { fn: string; args: Record<string, unknown> }[] = [];
  const db: RefundDb = {
    from: (table: string) => {
      let cols = "";
      let gteVal = "";
      let ltVal = "";
      let likePattern = "";
      const chain: Record<string, (...a: never[]) => unknown> = {
        select: (c: string) => {
          cols = c;
          return chain;
        },
        eq: () => chain,
        like: (_col: string, pattern: string) => {
          likePattern = pattern;
          return chain;
        },
        gte: (_col: string, v: string) => {
          gteVal = v;
          return chain;
        },
        lt: (_col: string, v: string) => {
          ltVal = v;
          return chain;
        },
        filter: () => chain,
        limit: () => {
          let data: unknown[];
          if (table === "ai_balance_ledger") {
            if (cols.includes("reason") && gteVal && ltVal) {
              // Spend scan: honor the created_at window and the reason
              // LIKE filter like the real DB.
              const prefix = likePattern.replace(/%/g, "");
              data = (opts.spendRows ?? []).filter(
                (r) =>
                  r.created_at >= gteVal &&
                  r.created_at < ltVal &&
                  (!prefix || r.reason.startsWith(prefix)),
              );
            } else {
              data = opts.refundRows ?? [];
            }
          } else {
            data = opts.auditRows ?? [];
          }
          return Promise.resolve({ data, error: null });
        },
      };
      return chain;
    },
    rpc: async (fn: string, args: Record<string, unknown>) => {
      rpcCalls.push({ fn, args });
      if (opts.rpcImpl) return opts.rpcImpl(fn, args);
      return { data: 100, error: null };
    },
  };
  return { db, rpcCalls };
}

const agoIso = (ms: number) => new Date(Date.now() - ms).toISOString();
const MIN = 60_000;
const HOUR = 3_600_000;

describe("refundCreditIdempotent", () => {
  it("refunds via manovik_topup_credit when no refund row exists", async () => {
    const { db, rpcCalls } = makeFakeDb();
    const outcome = await refundCreditIdempotent(db, {
      userId: "u1",
      amount: 1,
      refundReason: "chat.refund:turn-1",
    });
    expect(outcome).toBe("refunded");
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("manovik_topup_credit");
    expect(rpcCalls[0].args).toMatchObject({
      _user_id: "u1",
      _amount: 1,
      _reason: "chat.refund:turn-1",
    });
  });

  it("skips the RPC when a refund row already exists (idempotent)", async () => {
    const { db, rpcCalls } = makeFakeDb({ refundRows: [{ id: "r1" }] });
    const outcome = await refundCreditIdempotent(db, {
      userId: "u1",
      amount: 1,
      refundReason: "chat.refund:turn-1",
    });
    expect(outcome).toBe("already-refunded");
    expect(rpcCalls).toHaveLength(0);
  });

  it("retries a failed RPC and succeeds on the second attempt", async () => {
    let calls = 0;
    const { db, rpcCalls } = makeFakeDb({
      rpcImpl: () => {
        calls++;
        return calls === 1
          ? { data: null, error: { message: "db hiccup" } }
          : { data: 100, error: null };
      },
    });
    const outcome = await refundCreditIdempotent(db, {
      userId: "u1",
      amount: 2,
      refundReason: "image.refund:gen-9",
    });
    expect(outcome).toBe("refunded");
    expect(rpcCalls).toHaveLength(2);
  });

  it("returns failed (never throws) when every attempt fails", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    const { db, rpcCalls } = makeFakeDb({
      rpcImpl: () => ({ data: null, error: { message: "db down" } }),
    });
    const outcome = await refundCreditIdempotent(db, {
      userId: "u1",
      amount: 1,
      refundReason: "chat.refund:turn-2",
    });
    expect(outcome).toBe("failed");
    expect(rpcCalls).toHaveLength(3);
    err.mockRestore();
  });
});

describe("healLostChatCredits", () => {
  it("refunds an orphaned spend (old, no refund row, turn never completed)", async () => {
    const { db, rpcCalls } = makeFakeDb({
      spendRows: [{ reason: "chat.message:turn-orphan", created_at: agoIso(30 * MIN) }],
    });
    const healed = await healLostChatCredits(db, "u1");
    expect(healed).toBe(1);
    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].args).toMatchObject({ _reason: "chat.refund:turn-orphan" });
  });

  it("skips spends that already have a refund row", async () => {
    const { db, rpcCalls } = makeFakeDb({
      spendRows: [{ reason: "chat.message:turn-done", created_at: agoIso(30 * MIN) }],
      refundRows: [{ id: "r1" }],
    });
    // The refund-existence check inside refundCreditIdempotent sees the row.
    const healed = await healLostChatCredits(db, "u1");
    expect(healed).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("skips turns that completed (message.assistant audit row exists)", async () => {
    const { db, rpcCalls } = makeFakeDb({
      spendRows: [{ reason: "chat.message:turn-ok", created_at: agoIso(30 * MIN) }],
      auditRows: [{ id: "a1" }],
    });
    const healed = await healLostChatCredits(db, "u1");
    expect(healed).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("skips spends younger than 15 minutes (may still be in flight)", async () => {
    const { db, rpcCalls } = makeFakeDb({
      spendRows: [{ reason: "chat.message:turn-fresh", created_at: agoIso(5 * MIN) }],
    });
    const healed = await healLostChatCredits(db, "u1");
    expect(healed).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("skips spends older than the 7-day lookback window", async () => {
    const { db, rpcCalls } = makeFakeDb({
      spendRows: [{ reason: "chat.message:turn-ancient", created_at: agoIso(8 * 24 * HOUR) }],
    });
    const healed = await healLostChatCredits(db, "u1");
    expect(healed).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("ignores non-chat spend reasons", async () => {
    const { db, rpcCalls } = makeFakeDb({
      spendRows: [{ reason: "mission.step:abc:1", created_at: agoIso(2 * HOUR) }],
    });
    // The scan filters reason LIKE 'chat.message:%', so a mission spend
    // never appears and nothing is refunded.
    const healed = await healLostChatCredits(db, "u1");
    expect(healed).toBe(0);
    expect(rpcCalls).toHaveLength(0);
  });

  it("never throws when the ledger query fails", async () => {
    const db: RefundDb = {
      from: () => {
        throw new Error("db down");
      },
      rpc: async () => ({ data: null, error: null }),
    };
    await expect(healLostChatCredits(db, "u1")).resolves.toBe(0);
  });
});
