import { describe, expect, it } from "vitest";
import { bootDisplayName } from "@/lib/boot-greeting";

describe("bootDisplayName", () => {
  it("prefers given_name over full_name and name", () => {
    expect(
      bootDisplayName({
        user_metadata: { given_name: "Aria", full_name: "Aria Stark", name: "Someone Else" },
      }),
    ).toBe("Aria");
  });

  it("falls back to full_name then name, extracting the first name", () => {
    expect(bootDisplayName({ user_metadata: { full_name: "Bruce Wayne" } })).toBe("Bruce");
    expect(bootDisplayName({ user_metadata: { name: "  Diana   Prince  " } })).toBe("Diana");
  });

  it("never derives a name from email-like values", () => {
    expect(bootDisplayName({ user_metadata: { name: "kceda69@gmail.com" } })).toBeNull();
    expect(bootDisplayName({ user_metadata: { given_name: "user@x.io" } })).toBeNull();
  });

  it("rejects non-string, empty, and too-short values", () => {
    expect(bootDisplayName({ user_metadata: {} })).toBeNull();
    expect(bootDisplayName({ user_metadata: { name: "   " } })).toBeNull();
    expect(bootDisplayName({ user_metadata: { name: 42 } })).toBeNull();
    expect(bootDisplayName({ user_metadata: { name: null } })).toBeNull();
    expect(bootDisplayName({ user_metadata: { name: "A" } })).toBeNull();
  });

  it("rejects overly long values", () => {
    expect(bootDisplayName({ user_metadata: { name: "A".repeat(41) } })).toBeNull();
  });

  it("rejects control characters and malformed values", () => {
    expect(bootDisplayName({ user_metadata: { name: "Bob\nHacker" } })).toBeNull();
    expect(bootDisplayName({ user_metadata: { name: "123abc" } })).toBeNull();
    expect(bootDisplayName({ user_metadata: { name: "<script>" } })).toBeNull();
  });

  it("handles malformed metadata gracefully", () => {
    expect(bootDisplayName(null)).toBeNull();
    expect(bootDisplayName(undefined)).toBeNull();
    expect(bootDisplayName({})).toBeNull();
    expect(bootDisplayName({ user_metadata: null })).toBeNull();
  });

  it("skips invalid candidates and uses the next valid one", () => {
    expect(
      bootDisplayName({
        user_metadata: { given_name: "x@y.com", full_name: "Valid Name" },
      }),
    ).toBe("Valid");
  });
});
