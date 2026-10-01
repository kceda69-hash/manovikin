import { describe, expect, it } from "vitest";
import { BOOT_SEQUENCE_DURATION_MS, buildBootSequence } from "@/lib/mano/boot-sequence";

describe("buildBootSequence", () => {
  it("returns steps in chronological order with unique ids", () => {
    const steps = buildBootSequence();
    expect(steps.length).toBeGreaterThan(0);
    const ids = new Set(steps.map((s) => s.id));
    expect(ids.size).toBe(steps.length);
    for (let i = 1; i < steps.length; i++) {
      expect(steps[i].atMs).toBeGreaterThanOrEqual(steps[i - 1].atMs);
    }
  });

  it("every step has a non-empty label and status", () => {
    for (const step of buildBootSequence()) {
      expect(step.label.trim().length).toBeGreaterThan(0);
      expect(step.status.trim().length).toBeGreaterThan(0);
    }
  });

  it("finishes within the declared duration", () => {
    const steps = buildBootSequence();
    const last = steps[steps.length - 1];
    expect(last.atMs).toBeLessThan(BOOT_SEQUENCE_DURATION_MS);
  });

  it("ends on an all-clear step", () => {
    const steps = buildBootSequence();
    const last = steps[steps.length - 1];
    expect(last.label.toLowerCase()).toContain("nominal");
  });
});
