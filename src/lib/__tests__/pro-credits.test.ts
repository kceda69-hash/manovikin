/**
 * Tests for the atomic Pro credit grant (src/lib/pro-credits.server.ts).
 *
 * The billing bug: the client payment-verification path and the Razorpay
 * webhook both call grantProCreditsOnce for the same purchase within
 * milliseconds. The old check-then-act let both callers see an unset flag
 * and grant twice — 1600 credits for one ₹699 payment. These tests pin the
 * fix: exactly one caller wins the atomic claim; the loser grants nothing.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

interface GrantFakeOpts {
  /** Row returned by the initial purchases read (null = no such purchase). */
  row?: { id: string; user_id: string; metadata: Record<string, unknown> } | null;
  /** Whether the conditional claim UPDATE matches a row (true = won the race). */
  claimWins?: boolean;
  /** Existing ledger rows with reason pro_purchase:<id>. */
  priorGrants?: unknown[];
  /** If set, the topup RPC fails with this message. */
  rpcError?: string;
  /** If set, the initial read throws. */
  readThrows?: boolean;
}

const state = vi.hoisted(() => ({
  opts: {} as GrantFakeOpts,
  rpcCalls: [] as { fn: string; args: Record<string, unknown> }[],
  claimUpdates: [] as Record<string, unknown>[],
  releaseUpdates: [] as Record<string, unknown>[],
}));

vi.mock("@/integrations/supabase/client.server", () => {
  const chainFor = (table: string) => {
    let updateVals: Record<string, unknown> | null = null;
    let usedOr = false;
    let classified = false;
    // Classify at the terminal: the claim is the conditional UPDATE
    // (carries .or()); the release is the plain UPDATE awaited bare.
    const classifyUpdate = () => {
      if (classified || !updateVals) return;
      classified = true;
      if (usedOr) state.claimUpdates.push(updateVals);
      else state.releaseUpdates.push(updateVals);
    };
    const chain: Record<string, (...a: never[]) => unknown> = {
      select: () => chain,
      eq: () => chain,
      or: () => {
        usedOr = true;
        return chain;
      },
      update: (vals: Record<string, unknown>) => {
        updateVals = vals;
        return chain;
      },
      limit: () =>
        Promise.resolve({
          data: table === "ai_balance_ledger" ? (state.opts.priorGrants ?? []) : [],
          error: null,
        }),
      maybeSingle: () => {
        classifyUpdate();
        if (state.opts.readThrows && table === "purchases" && !updateVals) {
          return Promise.reject(new Error("db down"));
        }
        if (table === "purchases" && updateVals) {
          return Promise.resolve({
            data: usedOr && state.opts.claimWins ? { id: "p1", user_id: "u1" } : null,
            error: null,
          });
        }
        if (table === "purchases") {
          return Promise.resolve({ data: state.opts.row ?? null, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      },
      // Thenable so `await`-ing the bare chain (the release path does
      // `.update(...).eq(...)` with no terminal) still classifies it.
      then: (resolve: (v: unknown) => void) => {
        classifyUpdate();
        resolve({ data: null, error: null });
      },
    };
    return chain;
  };
  return {
    supabaseAdmin: {
      from: (t: string) => chainFor(t),
      rpc: async (fn: string, args: Record<string, unknown>) => {
        state.rpcCalls.push({ fn, args });
        return state.opts.rpcError
          ? { data: null, error: { message: state.opts.rpcError } }
          : { data: 800, error: null };
      },
    },
  };
});

import { grantProCreditsOnce, PRO_CREDIT_GRANT } from "@/lib/pro-credits.server";

function setup(opts: GrantFakeOpts) {
  state.opts = { claimWins: true, ...opts };
  state.rpcCalls = [];
  state.claimUpdates = [];
  state.releaseUpdates = [];
}

beforeEach(() => {
  vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("grantProCreditsOnce", () => {
  it("grants 800 credits exactly once when the claim wins", async () => {
    setup({ row: { id: "p1", user_id: "u1", metadata: {} } });
    await grantProCreditsOnce("p1");
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.rpcCalls[0].fn).toBe("manovik_topup_credit");
    expect(state.rpcCalls[0].args).toMatchObject({
      _user_id: "u1",
      _amount: PRO_CREDIT_GRANT,
      _reason: "pro_purchase:p1",
    });
    expect(PRO_CREDIT_GRANT).toBe(800);
    // The claim flipped the flag on.
    expect(state.claimUpdates).toHaveLength(1);
    expect(state.claimUpdates[0].metadata).toMatchObject({ pro_credits_granted: true });
  });

  it("grants nothing when the claim loses the race (concurrent caller won)", async () => {
    setup({
      row: { id: "p1", user_id: "u1", metadata: {} },
      claimWins: false, // the other path's UPDATE already flipped the flag
    });
    await grantProCreditsOnce("p1");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("grants nothing when the flag is already set", async () => {
    setup({
      row: { id: "p1", user_id: "u1", metadata: { pro_credits_granted: true } },
      claimWins: false, // conditional UPDATE matches no unclaimed row
    });
    await grantProCreditsOnce("p1");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("grants nothing when the ledger already has the grant row", async () => {
    setup({
      row: { id: "p1", user_id: "u1", metadata: {} },
      claimWins: true,
      priorGrants: [{ id: "ledger-1" }],
    });
    await grantProCreditsOnce("p1");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("releases the claim when the topup RPC fails so a redelivery can retry", async () => {
    setup({
      row: { id: "p1", user_id: "u1", metadata: { webhook_event: "payment.captured" } },
      rpcError: "db down",
    });
    await grantProCreditsOnce("p1");
    expect(state.rpcCalls).toHaveLength(1);
    expect(state.releaseUpdates).toHaveLength(1);
    const meta = state.releaseUpdates[0].metadata as Record<string, unknown>;
    expect(meta.pro_credits_granted).toBe(false);
    // Other metadata keys survive the release merge.
    expect(meta.webhook_event).toBe("payment.captured");
  });

  it("does nothing for an unknown purchase id", async () => {
    setup({ row: null, claimWins: false });
    await grantProCreditsOnce("nope");
    expect(state.rpcCalls).toHaveLength(0);
  });

  it("never throws when the database read fails", async () => {
    setup({ readThrows: true });
    await expect(grantProCreditsOnce("p1")).resolves.toBeUndefined();
    expect(state.rpcCalls).toHaveLength(0);
  });
});
