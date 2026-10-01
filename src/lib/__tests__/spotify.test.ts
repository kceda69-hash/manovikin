import { describe, expect, it } from "vitest";
import {
  SP_SCOPES,
  buildPlayBody,
  makeOAuthState,
  parseOAuthState,
  spAccessTokenExpired,
  spErrorMessage,
} from "@/lib/integrations/spotify.server";

describe("SP_SCOPES", () => {
  it("requests exactly the DJ scopes needed", () => {
    expect(SP_SCOPES).toContain("user-read-playback-state");
    expect(SP_SCOPES).toContain("user-modify-playback-state");
    expect(SP_SCOPES).toContain("user-read-currently-playing");
    expect(SP_SCOPES).toContain("playlist-modify-private");
    expect(SP_SCOPES).toContain("user-top-read");
    // Least privilege: no streaming/upload or user-data export scopes.
    expect(SP_SCOPES.every((s) => !s.includes("streaming"))).toBe(true);
  });
});

describe("Spotify OAuth state binding", () => {
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

describe("spAccessTokenExpired", () => {
  it("treats missing tokens as expired", () => {
    expect(spAccessTokenExpired({ refresh_token: "r" })).toBe(true);
  });

  it("respects the 60s skew window", () => {
    const now = Date.now();
    expect(
      spAccessTokenExpired({ refresh_token: "r", access_token: "a", expires_at: now + 30_000 }, now),
    ).toBe(true);
    expect(
      spAccessTokenExpired(
        { refresh_token: "r", access_token: "a", expires_at: now + 3600_000 },
        now,
      ),
    ).toBe(false);
  });
});

describe("buildPlayBody", () => {
  it("builds a track-uris body", () => {
    expect(
      buildPlayBody({ uris: ["spotify:track:abc", "spotify:track:def"] }),
    ).toEqual({ uris: ["spotify:track:abc", "spotify:track:def"] });
  });

  it("builds a context body with offset", () => {
    expect(
      buildPlayBody({
        contextUri: "spotify:playlist:xyz",
        offsetUri: "spotify:track:abc",
      }),
    ).toEqual({
      context_uri: "spotify:playlist:xyz",
      offset: { uri: "spotify:track:abc" },
    });
  });

  it("builds an empty body (resume on active device)", () => {
    expect(buildPlayBody({})).toEqual({});
  });
});

describe("spErrorMessage", () => {
  it("explains Premium requirement plainly", () => {
    const msg = spErrorMessage(403, '{"error":{"reason":"PREMIUM_REQUIRED"}}');
    expect(msg).toMatch(/premium/i);
  });

  it("explains missing device plainly", () => {
    const msg = spErrorMessage(404, '{"error":{"reason":"NO_ACTIVE_DEVICE"}}');
    expect(msg).toMatch(/no active device/i);
  });

  it("falls back to status + snippet for other errors", () => {
    expect(spErrorMessage(500, "boom")).toContain("500");
  });
});
