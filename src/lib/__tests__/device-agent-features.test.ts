import { describe, expect, it } from "vitest";
import {
  detectHotword,
  HOTWORD_RE,
  AMBIENT_WATCH_INTERVAL_MS,
  MAX_AMBIENT_FRAME_BYTES,
  MAX_AMBIENT_FRAME_DIM,
  NOTABLE_OBSERVATION_KEYWORDS,
  isNotableObservation,
  AMBIENT_OBSERVATION_PROMPT,
} from "../device-agent-utils";

describe("detectHotword", () => {
  it("matches plain 'hey mano'", () => {
    expect(detectHotword("hey mano")).toBe(true);
  });
  it("matches 'Hey, MANO' with comma and mixed case", () => {
    expect(detectHotword("Hey, MANO")).toBe(true);
  });
  it("matches 'hey  mano turn on lights' inside a longer sentence", () => {
    expect(detectHotword("hey  mano turn on lights")).toBe(true);
  });
  it("matches with leading filler words", () => {
    expect(detectHotword("ok so hey mano what's the weather")).toBe(true);
  });
  it("rejects 'hey man'", () => {
    expect(detectHotword("hey man")).toBe(false);
  });
  it("rejects 'hey manual'", () => {
    expect(detectHotword("hey manual")).toBe(false);
  });
  it("rejects empty transcript", () => {
    expect(detectHotword("")).toBe(false);
  });
  it("rejects unrelated speech", () => {
    expect(detectHotword("turn on the lights please")).toBe(false);
  });
  it("exposes the underlying regex", () => {
    expect(HOTWORD_RE.source).toContain("hey");
    expect(HOTWORD_RE.source).toContain("mano");
  });
});

describe("ambient watch cadence", () => {
  it("captures every 5 minutes", () => {
    expect(AMBIENT_WATCH_INTERVAL_MS).toBe(300_000);
  });
  it("limits frames to ~2MB", () => {
    expect(MAX_AMBIENT_FRAME_BYTES).toBe(2 * 1024 * 1024);
  });
  it("downscales frames to at most 1280px", () => {
    expect(MAX_AMBIENT_FRAME_DIM).toBe(1280);
  });
  it("uses a privacy-safe observation prompt (no identity requests)", () => {
    expect(AMBIENT_OBSERVATION_PROMPT).toMatch(/ONE sentence/i);
    expect(AMBIENT_OBSERVATION_PROMPT).toMatch(/Do NOT identify/i);
    expect(AMBIENT_OBSERVATION_PROMPT).toMatch(/facial recognition/i);
  });
});

describe("isNotableObservation", () => {
  it.each([
    "There is an unfamiliar person at the door.",
    "Smoke is rising near the kitchen stove.",
    "A fire has started on the balcony.",
    "The window is broken and glass is on the floor.",
    "An elderly person has fallen in the living room.",
    "There is a spill of water on the kitchen floor.",
    "The door open at night with nobody around.",
  ])("flags notable observation: %s", (text) => {
    expect(isNotableObservation(text)).toBe(true);
  });

  it.each([
    "The room is quiet with a sofa and a table lamp on.",
    "A cat is sleeping on the couch in the evening light.",
    "The kitchen counter is clean and the dishes are done.",
    "",
  ])("ignores routine observation: %s", (text) => {
    expect(isNotableObservation(text)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isNotableObservation("SMOKE near the outlet.")).toBe(true);
  });

  it("covers the required keyword list", () => {
    const required = [
      "unfamiliar person",
      "smoke",
      "fire",
      "broken",
      "fallen",
      "spill",
      "door open",
    ];
    for (const kw of required) {
      expect(NOTABLE_OBSERVATION_KEYWORDS).toContain(kw);
    }
  });
});
