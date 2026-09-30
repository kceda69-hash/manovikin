import { describe, expect, it } from "vitest";
import { isEchoOfSpeech, isInterruptCommand, normalizeWords } from "../voice-utils";

describe("normalizeWords", () => {
  it("lowercases, strips punctuation and drops filler words", () => {
    expect(normalizeWords("Hello, MANO! The weather is nice.")).toEqual([
      "hello",
      "mano",
      "weather",
      "nice",
    ]);
  });

  it("returns an empty array for empty input", () => {
    expect(normalizeWords("")).toEqual([]);
  });
});

describe("isEchoOfSpeech", () => {
  const spoken =
    "The weather in Mumbai is sunny and warm today with a high of thirty two degrees";

  it("detects a near-verbatim echo of the spoken text", () => {
    expect(isEchoOfSpeech("weather in Mumbai is sunny and warm today", spoken)).toBe(true);
  });

  it("detects echo even with recognition errors on some words", () => {
    // Speaker audio misrecognizes a few words but most overlap.
    expect(isEchoOfSpeech("weather Mumbai sunny warm today high thirty", spoken)).toBe(true);
  });

  it("does not flag unrelated user speech as echo", () => {
    expect(isEchoOfSpeech("remind me to call Swastik plastics at five", spoken)).toBe(false);
  });

  it("does not flag a barge-in question as echo", () => {
    expect(isEchoOfSpeech("and what about tomorrow", spoken)).toBe(false);
  });

  it("returns false when either side is empty", () => {
    expect(isEchoOfSpeech("", spoken)).toBe(false);
    expect(isEchoOfSpeech("hello there", "")).toBe(false);
  });

  it("detects echo via the compact-substring fallback", () => {
    expect(isEchoOfSpeech("warmtoday", "warm today")).toBe(true);
  });
});

describe("isInterruptCommand", () => {
  it("matches stop, shut up and quiet", () => {
    expect(isInterruptCommand("stop")).toBe(true);
    expect(isInterruptCommand("Shut up")).toBe(true);
    expect(isInterruptCommand("quiet please")).toBe(true);
  });

  it("does not match mic commands", () => {
    expect(isInterruptCommand("stop listening")).toBe(false);
    expect(isInterruptCommand("mic off")).toBe(false);
  });

  it("does not match ordinary speech", () => {
    expect(isInterruptCommand("tell me about Mumbai")).toBe(false);
    expect(isInterruptCommand("don't stop believing")).toBe(true); // contains "stop" — handled as interrupt, harmless
  });
});
