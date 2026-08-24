import { describe, expect, it } from "vitest";
import {
  MANO_MODEL_ID,
  MANO_SKILLS,
  MANO_STAGE_PROMPT,
  MANO_SUBSTRATE,
  MANO_SUBSTRATE_LITE,
  classifyMano,
  stagesFor,
  substrateFor,
} from "@/lib/mano/mano1";
import { APPROVED_MODEL_IDS } from "@/lib/supply-chain/catalog";

describe("MANO 1.1", () => {
  it("has a MANOVIK-owned model id", () => {
    expect(MANO_MODEL_ID).toBe("manovik/mano-1.1");
  });

  it("only uses approved substrates", () => {
    for (const model of [...Object.values(MANO_SUBSTRATE), ...Object.values(MANO_SUBSTRATE_LITE)]) {
      expect(APPROVED_MODEL_IDS).toContain(model);
    }
  });

  it("classifies depth", () => {
    expect(classifyMano("hi")).toBe("lite");
    expect(classifyMano("write me a haiku about rain")).toBe("standard");
    expect(classifyMano("design a distributed architecture with a postgres schema")).toBe("deep");
    expect(classifyMano("what is this", true)).toBe("standard");
  });

  it("runs the right stages per depth", () => {
    expect(stagesFor("lite")).toEqual(["draft"]);
    expect(stagesFor("standard")).toEqual(["draft", "adversary", "synthesis"]);
    expect(stagesFor("deep")).toEqual(["plan", "draft", "adversary", "synthesis"]);
  });

  it("uses the lite substrate map only for lite runs", () => {
    expect(substrateFor("lite")).toBe(MANO_SUBSTRATE_LITE);
    expect(substrateFor("deep")).toBe(MANO_SUBSTRATE);
  });

  it("never leaks provider identity in stage prompts", () => {
    for (const prompt of Object.values(MANO_STAGE_PROMPT)) {
      expect(prompt).toContain("MANO 1.1");
      expect(prompt.toLowerCase()).not.toMatch(/\b(claude|gpt-5|gemini)\b/);
    }
  });

  it("declares a skill surface", () => {
    expect(MANO_SKILLS.length).toBeGreaterThanOrEqual(8);
  });
});
