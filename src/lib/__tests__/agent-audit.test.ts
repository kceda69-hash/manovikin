/**
 * Tests for the shared agent-action audit helper and the hook secret.
 */
import { describe, expect, it, vi } from "vitest";
import { logAgentAction, type AgentAuditDb } from "@/lib/agent-audit.server";

function makeFakeDb(opts: { fail?: boolean } = {}): { db: AgentAuditDb; rows: unknown[] } {
  const rows: unknown[] = [];
  const db: AgentAuditDb = {
    from: (_table: string) => ({
      insert: async (row: unknown) => {
        if (opts.fail) return { error: { message: "db down" } };
        rows.push(row);
        return { error: null };
      },
    }),
  };
  return { db, rows };
}

describe("logAgentAction", () => {
  it("writes to audit_logs with an agent.-prefixed event type", async () => {
    const { db, rows } = makeFakeDb();
    await logAgentAction(
      { userId: "u1", action: "gmail.send", summary: "Email sent", metadata: { to: "a@b.c" } },
      db,
    );
    expect(rows).toHaveLength(1);
    const row = rows[0] as Record<string, unknown>;
    expect(row.user_id).toBe("u1");
    expect(row.event_type).toBe("agent.gmail.send");
    expect(row.summary).toBe("Email sent");
  });

  it("never throws when the DB write fails", async () => {
    const { db } = makeFakeDb({ fail: true });
    await expect(
      logAgentAction({ userId: "u1", action: "spotify.play", summary: "x" }, db),
    ).resolves.toBeUndefined();
  });

  it("never throws when the DB client throws", async () => {
    const db: AgentAuditDb = {
      from: () => {
        throw new Error("connection reset");
      },
    };
    await expect(
      logAgentAction({ userId: "u1", action: "device.command", summary: "x" }, db),
    ).resolves.toBeUndefined();
  });
});

describe("hookSecret (audit fix: no LOVABLE_API_KEY fallback)", () => {
  it("returns MANOVIK_HOOK_SECRET when set", async () => {
    vi.resetModules();
    process.env.MANOVIK_HOOK_SECRET = "s3cret";
    process.env.LOVABLE_API_KEY = "shared-key";
    const { hookSecret } = await import("@/lib/hook-auth");
    expect(hookSecret()).toBe("s3cret");
    delete process.env.MANOVIK_HOOK_SECRET;
    delete process.env.LOVABLE_API_KEY;
    vi.resetModules();
  });

  it("does NOT fall back to LOVABLE_API_KEY (fail closed)", async () => {
    vi.resetModules();
    delete process.env.MANOVIK_HOOK_SECRET;
    process.env.LOVABLE_API_KEY = "shared-key";
    const { hookSecret, isAuthorizedHook } = await import("@/lib/hook-auth");
    expect(hookSecret()).toBe("");
    const req = new Request("https://x.test/", { headers: { authorization: "Bearer shared-key" } });
    expect(isAuthorizedHook(req)).toBe(false);
    delete process.env.LOVABLE_API_KEY;
    vi.resetModules();
  });

  it("authorizes the configured secret with constant-time comparison", async () => {
    vi.resetModules();
    process.env.MANOVIK_HOOK_SECRET = "s3cret";
    const { isAuthorizedHook } = await import("@/lib/hook-auth");
    const okReq = new Request("https://x.test/", { headers: { authorization: "Bearer s3cret" } });
    const badReq = new Request("https://x.test/", { headers: { authorization: "Bearer wrong" } });
    expect(isAuthorizedHook(okReq)).toBe(true);
    expect(isAuthorizedHook(badReq)).toBe(false);
    delete process.env.MANOVIK_HOOK_SECRET;
    vi.resetModules();
  });
});
