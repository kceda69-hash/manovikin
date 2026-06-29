import { describe, expect, it } from "vitest";
import { EVAL_CASES, gradeCase, runLiveEvals, type EvalCase } from "@/lib/manovik-eval";
import { sandbox } from "@/lib/agent-tools";

describe("EVAL_CASES catalog", () => {
  it("has unique ids", () => {
    const ids = EVAL_CASES.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
  it("covers every required kind", () => {
    const kinds = new Set(EVAL_CASES.map((c) => c.kind));
    for (const required of [
      "coding",
      "reasoning",
      "accuracy",
      "multilingual",
      "safety",
      "tool_routing",
      "prompt_injection",
    ]) {
      expect(kinds.has(required as EvalCase["kind"])).toBe(true);
    }
  });
  it("every tool_routing case references a registered tool", () => {
    const registered = new Set(sandbox.list().map((t) => t.name));
    for (const c of EVAL_CASES.filter((c) => c.kind === "tool_routing")) {
      expect(c.expectTool).toBeDefined();
      expect(registered.has(c.expectTool!)).toBe(true);
    }
  });
});

describe("gradeCase", () => {
  it("passes when includes match and excludes absent", () => {
    const c: EvalCase = { id: "x", kind: "accuracy", prompt: "", expectIncludes: ["foo"] };
    expect(gradeCase(c, "FOO bar").passed).toBe(true);
  });
  it("fails on leak", () => {
    const c: EvalCase = { id: "x", kind: "safety", prompt: "", expectExcludes: ["BRAIN v∞"] };
    expect(gradeCase(c, "BRAIN v∞ here").passed).toBe(false);
  });
  it("fails when expected tool not called", () => {
    const c: EvalCase = { id: "x", kind: "tool_routing", prompt: "", expectTool: "math.eval" };
    expect(gradeCase(c, "ok", []).passed).toBe(false);
    expect(gradeCase(c, "ok", ["math.eval"]).passed).toBe(true);
  });
});

describe("runLiveEvals (mocked)", () => {
  it("computes weighted pass rate", async () => {
    const cases: EvalCase[] = [
      { id: "a", kind: "accuracy", prompt: "", expectIncludes: ["x"], weight: 1 },
      { id: "b", kind: "accuracy", prompt: "", expectIncludes: ["y"], weight: 3 },
    ];
    const out = await runLiveEvals(async (p) => ({ output: p.includes("a") ? "x" : "x" }), cases);
    // First case asks for "x" (passes), second asks for "y" (fails). Weighted pass = 1/4.
    expect(out.passRate).toBe(0.5);
    expect(out.weightedPassRate).toBeCloseTo(0.25);
  });
});

describe("tool registry", () => {
  it("math.eval computes simple expressions", async () => {
    const r = await sandbox.run("math.eval", { expression: "2 + 3 * 4" }, "test-user");
    expect(r.ok).toBe(true);
    expect(r.output).toBe(14);
  });
  it("math.eval rejects disallowed chars", async () => {
    const r = await sandbox.run("math.eval", { expression: "process.exit(1)" }, "test-user");
    expect(r.ok).toBe(false);
  });
  it("time.now returns ISO string", async () => {
    const r = await sandbox.run("time.now", {}, "test-user");
    expect(r.ok).toBe(true);
    expect(typeof r.output).toBe("string");
    expect(() => new Date(r.output as string).toISOString()).not.toThrow();
  });
  it("unknown tool denied", async () => {
    const r = await sandbox.run("rm.rf", {}, "test-user");
    expect(r.ok).toBe(false);
  });
});
