import { describe, expect, it } from "vitest";
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
