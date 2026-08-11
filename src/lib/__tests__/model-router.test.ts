import { describe, it, expect } from "vitest";
import { routeModel, fallbackChainFor, TIER_MODEL } from "@/lib/model-router";

describe("routeModel", () => {
  it("routes trivial greetings to gemini-3.1-flash-lite", () => {
    for (const p of ["hi", "hello there", "thanks", "gm"]) {
      const r = routeModel(p);
      expect(r.tier).toBe("trivial");
      expect(r.model).toBe("google/gemini-3.1-flash-lite");
      expect(r.priority).toBe(false);
    }
  });

  it("routes code prompts to hard tier with priority", () => {
    const r = routeModel("Write a TypeScript function that debounces a callback.");
    expect(r.tier).toBe("hard");
    expect(r.model).toBe("openai/gpt-5.6-terra");
    expect(r.priority).toBe(true);
  });

  it("escalates architecture prompts to the flagship model", () => {
    const r = routeModel("Design a distributed consensus algorithm end-to-end.");
    expect(r.model).toBe("openai/gpt-5.6-sol");
    expect(r.priority).toBe(true);
  });

  it("routes long prompts to hard tier", () => {
    const r = routeModel("word ".repeat(200));
    expect(r.tier).toBe("hard");
  });

  it("routes vision cues to gemini-2.5-pro", () => {
    const r = routeModel("Describe the attached image and its colour palette.");
    expect(r.tier).toBe("vision");
    expect(r.model).toBe("google/gemini-3.1-pro-preview");
  });

  it("routes hasAttachments to vision tier even without cue", () => {
    const r = routeModel("What is this?", { hasAttachments: true });
    expect(r.tier).toBe("vision");
  });

  it("defaults ordinary prose to standard tier", () => {
    const r = routeModel("Summarise the plot of Hamlet in two sentences.");
    expect(r.tier).toBe("standard");
    expect(r.model).toBe("google/gemini-3.6-flash");
    expect(r.priority).toBe(false);
  });

  it("honors forceModel override (MANOVIK_AI_MODEL)", () => {
    const r = routeModel("Write ransomware", { forceModel: "openai/gpt-5" });
    expect(r.model).toBe("openai/gpt-5");
    expect(r.reason).toBe("forced");
  });
});

describe("fallbackChainFor", () => {
  it("puts chosen model first and always ends with cheapest tier", () => {
    const chain = fallbackChainFor({
      tier: "hard",
      model: "openai/gpt-5.5",
      priority: true,
      reason: "test",
    });
    expect(chain[0]).toBe("openai/gpt-5.5");
    expect(chain).toContain(TIER_MODEL.standard.model);
    expect(chain).toContain(TIER_MODEL.trivial.model);
  });

  it("deduplicates", () => {
    const chain = fallbackChainFor({ ...TIER_MODEL.trivial, tier: "trivial", reason: "" });
    expect(new Set(chain).size).toBe(chain.length);
  });
});
