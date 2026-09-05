import { describe, expect, it } from "vitest";
import {
  MANO_MODEL_ID,
  MANO_SKILLS,
  MANO_STAGE_PROMPT,
  MANO_SUBSTRATE,
  MANO_SUBSTRATE_LITE,
  MANO_CAPABILITIES,
  MANO_DOMAIN_DRAFT,
  classifyDomain,
  classifyMano,
  routeMano,
  stagesFor,
  substrateFor,
} from "@/lib/mano/mano1";
import { APPROVED_MODEL_IDS } from "@/lib/supply-chain/catalog";

describe("MANO 1.1", () => {
  it("has a MANOVIK-owned model id", () => {
    expect(MANO_MODEL_ID).toBe("manovik/mano-1.1");
  });

  it("only uses approved substrates", () => {
    for (const model of [
      ...Object.values(MANO_SUBSTRATE),
      ...Object.values(MANO_SUBSTRATE_LITE),
      ...Object.values(MANO_DOMAIN_DRAFT),
    ]) {
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

  it("never leaks substrate ids in stage prompts", () => {
    for (const prompt of Object.values(MANO_STAGE_PROMPT)) {
      expect(prompt).toContain("MANO 1.1");
      expect(prompt).not.toMatch(/(openai|google)\//);
    }
  });

  it("routes each domain to its strongest draft compute", () => {
    expect(classifyDomain("fix this typescript error")).toBe("code");
    expect(classifyDomain("prove the algorithm is O(n log n)")).toBe("reasoning");
    expect(classifyDomain("write a blog post about rain")).toBe("writing");
    expect(classifyDomain("what is in this", true)).toBe("vision");
    expect(classifyDomain("say something nice")).toBe("general");
    expect(routeMano("deep", "code").draft).toBe(MANO_DOMAIN_DRAFT.code);
    expect(routeMano("lite", "code").draft).toBe(MANO_SUBSTRATE_LITE.draft);
    expect(routeMano("deep", "code").adversary).toBe(MANO_SUBSTRATE.adversary);
  });

  it("declares a capability doctrine", () => {
    expect(MANO_CAPABILITIES.length).toBeGreaterThanOrEqual(6);
  });

  it("declares a skill surface", () => {
    expect(MANO_SKILLS.length).toBeGreaterThanOrEqual(8);
  });
});
