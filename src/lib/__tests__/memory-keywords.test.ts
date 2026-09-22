import { describe, expect, it } from "vitest";
import { extractKeywords } from "@/lib/memory/retrieve.server";

describe("extractKeywords (memory keyword fallback)", () => {
  it("pulls significant lowercase alphanumeric terms", () => {
    expect(extractKeywords("What is my project deadline for the Apollo launch?")).toEqual(
      expect.arrayContaining(["project", "deadline", "apollo", "launch"]),
    );
  });

  it("drops short tokens and punctuation", () => {
    const kw = extractKeywords("Hi! Do I owe $5?");
    expect(kw).toEqual([]);
  });

  it("caps the number of keywords", () => {
    const kw = extractKeywords(
      "alpha beta gamma delta epsilon zeta eta theta iota kappa lambda",
      5,
    );
    expect(kw).toHaveLength(5);
  });

  it("dedupes repeated terms", () => {
    const kw = extractKeywords("project project project deadline deadline");
    expect(kw).toEqual(["project", "deadline"]);
  });

  it("never emits ILIKE-unsafe characters", () => {
    const kw = extractKeywords("100% legit (test), a_b-c; DROP TABLE");
    for (const k of kw) {
      expect(k).toMatch(/^[a-z0-9]+$/);
    }
  });

  it("handles empty input", () => {
    expect(extractKeywords("")).toEqual([]);
    expect(extractKeywords("   ")).toEqual([]);
  });
});
