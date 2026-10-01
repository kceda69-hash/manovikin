import { describe, expect, it, vi } from "vitest";
import {
  AMBIENT_FRAMES_PER_DAY_CAP,
  CREDIT_PRICES,
  isBillingExempt,
  spendCredits,
  utcDayKey,
  type RpcCapable,
} from "@/lib/credits.server";

const rpcOk = (data: unknown = 799): RpcCapable => ({
  rpc: async () => ({ data, error: null }),
});
const rpcInsufficient: RpcCapable = {
  rpc: async () => ({ data: -1, error: null }),
};
const rpcThrowing: RpcCapable = {
  rpc: async () => {
    throw new Error("db down");
  },
};

describe("CREDIT_PRICES", () => {
  it("every price is a positive integer", () => {
    for (const [key, price] of Object.entries(CREDIT_PRICES)) {
      expect(Number.isInteger(price), key).toBe(true);
      expect(price, key).toBeGreaterThan(0);
    }
  });

  it("heavy paths cost more than a plain chat turn", () => {
    expect(CREDIT_PRICES.dossierBrief).toBeGreaterThan(CREDIT_PRICES.chatTurn);
    expect(CREDIT_PRICES.briefingDaily).toBeGreaterThan(CREDIT_PRICES.chatTurn);
  });
});

describe("spendCredits", () => {
  it("returns ok when the RPC succeeds", async () => {
    await expect(spendCredits(rpcOk(), "u1", 1, "mission.step:x:1")).resolves.toBe("ok");
  });

  it("returns insufficient when the RPC reports -1", async () => {
    await expect(spendCredits(rpcInsufficient, "u1", 1, "mission.step:x:1")).resolves.toBe(
      "insufficient",
    );
  });

  it("returns failed (never throws) when the RPC throws", async () => {
    const err = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(spendCredits(rpcThrowing, "u1", 1, "mission.step:x:1")).resolves.toBe("failed");
    err.mockRestore();
  });

  it("passes amount and reason through to the RPC", async () => {
    const rpc = vi.fn(async () => ({ data: 10, error: null }));
    await spendCredits({ rpc }, "user-9", 3, "dossier.brief:123");
    expect(rpc).toHaveBeenCalledWith("manovik_spend_credit", {
      _user_id: "user-9",
      _amount: 3,
      _reason: "dossier.brief:123",
    });
  });
});

describe("isBillingExempt", () => {
  it("returns true for admins", async () => {
    await expect(isBillingExempt(rpcOk(true), "admin-1")).resolves.toBe(true);
  });

  it("returns false for non-admins", async () => {
    await expect(isBillingExempt(rpcOk(false), "user-1")).resolves.toBe(false);
  });

  it("returns false (never throws) when the RPC throws", async () => {
    await expect(isBillingExempt(rpcThrowing, "user-1")).resolves.toBe(false);
  });
});

describe("ambient cap", () => {
  it("caps daily frames at a sane bound", () => {
    expect(AMBIENT_FRAMES_PER_DAY_CAP).toBe(96);
  });
});

describe("utcDayKey", () => {
  it("formats as YYYY-MM-DD", () => {
    expect(utcDayKey(new Date("2026-10-01T12:00:00Z"))).toBe("2026-10-01");
  });
});
