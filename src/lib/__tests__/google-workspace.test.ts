import { describe, expect, it, vi } from "vitest";
import {
  GW_SCOPES,
  accessTokenExpired,
  buildEventBody,
  buildSendRaw,
  makeOAuthState,
  parseOAuthState,
} from "@/lib/integrations/google-workspace.server";

describe("GW_SCOPES", () => {
  it("requests exactly the mail + calendar scopes the tools need", () => {
    expect(GW_SCOPES).toContain("https://www.googleapis.com/auth/gmail.readonly");
    expect(GW_SCOPES).toContain("https://www.googleapis.com/auth/gmail.send");
    expect(GW_SCOPES).toContain("https://www.googleapis.com/auth/calendar.readonly");
    expect(GW_SCOPES).toContain("https://www.googleapis.com/auth/calendar.events");
    // Least privilege: no full-drive / admin scopes.
    expect(GW_SCOPES.every((s) => s.includes("gmail") || s.includes("calendar"))).toBe(true);
  });
});

describe("OAuth state binding", () => {
  it("round-trips userId when the cookie nonce matches", () => {
    const userId = "123e4567-e89b-12d3-a456-426614174000";
    const { state, nonce } = makeOAuthState(userId);
    expect(parseOAuthState(state, nonce)).toEqual({ userId });
  });

  it("rejects mismatched, missing or malformed state", () => {
    const userId = "123e4567-e89b-12d3-a456-426614174000";
    const { state, nonce } = makeOAuthState(userId);
    expect(parseOAuthState(state, "wrong-nonce")).toBeNull();
    expect(parseOAuthState(state, null)).toBeNull();
    expect(parseOAuthState(null, nonce)).toBeNull();
    expect(parseOAuthState("not-a-uuid.abc123", nonce)).toBeNull();
    expect(parseOAuthState("no-dot-here", nonce)).toBeNull();
  });
});

describe("accessTokenExpired", () => {
  it("treats missing tokens as expired", () => {
    expect(accessTokenExpired({ refresh_token: "r" })).toBe(true);
  });

  it("treats tokens expiring within the skew window as expired", () => {
    const now = Date.now();
    expect(
      accessTokenExpired({ refresh_token: "r", access_token: "a", expires_at: now + 30_000 }, now),
    ).toBe(true);
    expect(
      accessTokenExpired(
        { refresh_token: "r", access_token: "a", expires_at: now + 3600_000 },
        now,
      ),
    ).toBe(false);
  });
});

describe("buildSendRaw", () => {
  it("builds a decodable base64url RFC 822 payload", () => {
    const raw = buildSendRaw("a@example.com", "Hello", "Body text — with unicode ✓");
    expect(raw).not.toMatch(/[+/=]/);
    const decoded = decodeURIComponent(
      escape(atob(raw.replace(/-/g, "+").replace(/_/g, "/"))),
    );
    expect(decoded).toContain("To: a@example.com");
    expect(decoded).toContain("Subject: Hello");
    expect(decoded).toContain("Body text — with unicode ✓");
  });
});

describe("buildEventBody", () => {
  it("builds a timed event with dateTime fields", () => {
    const body = buildEventBody({
      summary: "Call",
      start: "2026-10-02T14:00:00+05:30",
      end: "2026-10-02T14:30:00+05:30",
      attendees: ["b@example.com"],
    });
    expect(body.summary).toBe("Call");
    expect(body.start).toEqual({ dateTime: "2026-10-02T14:00:00+05:30" });
    expect(body.attendees).toEqual([{ email: "b@example.com" }]);
  });

  it("builds an all-day event with date fields", () => {
    const body = buildEventBody({
      summary: "Diwali",
      start: "2026-11-08",
      end: "2026-11-09",
    });
    expect(body.start).toEqual({ date: "2026-11-08" });
    expect(body.end).toEqual({ date: "2026-11-09" });
    expect(body).not.toHaveProperty("attendees");
  });
});

describe("gmail.send two-step confirmation (audit fix)", () => {
  it("stages without sending on first call, executes frozen payload on confirm", async () => {
    vi.resetModules();
    const sent: Array<Record<string, unknown>> = [];
    vi.doMock("@/lib/integrations/google-workspace.server", async (importOriginal) => {
      const mod = (await importOriginal()) as Record<string, unknown>;
      return { ...mod, gwSend: vi.fn(async (_u: string, p: Record<string, unknown>) => { sent.push(p); return { id: "m1" }; }) };
    });
    // In-memory pending-actions: stage stores, consume returns frozen payload once.
    const store = new Map<string, Record<string, unknown>>();
    vi.doMock("@/lib/pending-actions.server", () => ({
      PendingActionsUnavailableError: class extends Error {},
      stagePendingAction: vi.fn(async (_u: string, _k: string, p: Record<string, unknown>) => {
        store.set("tok123", p);
        return { id: "a1", token: "tok123", expiresAt: new Date(Date.now() + 600000).toISOString() };
      }),
      consumePendingAction: vi.fn(async (_u: string, _k: string, t: string) => {
        const p = store.get(t) ?? null;
        store.delete(t);
        return p;
      }),
    }));
    const { googleWorkspaceTools } = await import("@/lib/google-workspace-tool");
    const tool = googleWorkspaceTools.find((t) => t.name === "gmail.send")! as {
      execute: (
        input: { to: string; subject: string; body: string; confirmToken?: string },
        ctx: { userId: string; signal: AbortSignal },
      ) => Promise<unknown>;
    };
    const ctx = { userId: "u1", signal: new AbortController().signal };

    // Step 1: stage — nothing sent.
    const staged = (await tool.execute({ to: "a@b.c", subject: "Hi", body: "Hello" }, ctx)) as Record<string, unknown>;
    expect(staged.pending).toBe(true);
    expect(staged.confirmToken).toBe("tok123");
    expect(sent).toHaveLength(0);

    // Step 2: confirm with a DIFFERENT body — frozen payload wins.
    const done = (await tool.execute(
      { to: "evil@x.y", subject: "Hi", body: "PWNED", confirmToken: "tok123" },
      ctx,
    )) as Record<string, unknown>;
    expect(done.ok).toBe(true);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toEqual({ to: "a@b.c", subject: "Hi", body: "Hello" });

    // Step 3: replay the token — single-use.
    const replay = (await tool.execute(
      { to: "a@b.c", subject: "Hi", body: "Hello", confirmToken: "tok123" },
      ctx,
    )) as Record<string, unknown>;
    expect(replay.ok).toBe(false);
    expect(replay.error).toBe("confirmation_invalid");
    expect(sent).toHaveLength(1);
    vi.resetModules();
  });
});
