import { describe, expect, it } from "vitest";
import { scanSupplyChain, type ScanInput } from "@/lib/supply-chain/analyzer";

const base: ScanInput = {
  manifest: { dependencies: { react: "^19.2.0" }, devDependencies: { vitest: "^4.1.7" } },
  lockfileName: "bun.lock",
  lockfileText: 'https://registry.npmjs.org/react/-/react-19.2.0.tgz',
  envNames: ["LOVABLE_API_KEY", "VITE_SUPABASE_PUBLISHABLE_KEY"],
  aiHosts: ["ai.gateway.lovable.dev"],
  models: [{ surface: "chat:standard", model: "google/gemini-3.6-flash" }],
};

const ids = (i: ScanInput) => scanSupplyChain(i).findings.map((f) => f.id);

describe("supply-chain scanner", () => {
  it("reports a clean baseline with a perfect score", () => {
    const report = scanSupplyChain(base);
    expect(report.findings).toEqual([]);
    expect(report.score).toBe(100);
    expect(report.stats.dependencies).toBe(1);
  });

  it("flags floating, remote, and pre-release specifiers", () => {
    const found = ids({
      ...base,
      manifest: { dependencies: { a: "*", b: "github:evil/b", nitro: "3.0.1-beta" } },
    });
    expect(found).toContain("dep.floating.a");
    expect(found).toContain("dep.remote.b");
    expect(found).toContain("dep.prerelease.nitro");
  });

  it("flags known-compromised packages as critical", () => {
    const report = scanSupplyChain({ ...base, manifest: { dependencies: { "event-stream": "^3.3.6" } } });
    expect(report.findings[0]?.id).toBe("dep.compromised.event-stream");
    expect(report.findings[0]?.severity).toBe("critical");
  });

  it("detects typosquats one edit away from popular packages", () => {
    expect(ids({ ...base, manifest: { dependencies: { raect: "^1.0.0" } } })).toContain("dep.typosquat.raect");
    expect(ids({ ...base, manifest: { dependencies: { react: "^19.2.0" } } })).not.toContain("dep.typosquat.react");
  });

  it("flags a missing lockfile and untrusted registries", () => {
    expect(ids({ ...base, lockfileName: null, lockfileText: null })).toContain("lock.missing");
    expect(ids({ ...base, lockfileText: "https://npm.shady.example/x.tgz" })).toContain("lock.untrusted-registry");
  });

  it("flags unreviewed inference hosts but allows local sovereign endpoints", () => {
    expect(ids({ ...base, aiHosts: ["https://api.unknown-ai.example/v1"] })).toContain(
      "ai.untrusted-host.api.unknown-ai.example",
    );
    expect(ids({ ...base, aiHosts: ["http://localhost:11434/v1"] })).toEqual([]);
  });

  it("flags direct provider keys and browser-exposed secrets", () => {
    const found = ids({ ...base, envNames: [...base.envNames, "OPENAI_API_KEY", "VITE_RAZORPAY_SECRET"] });
    expect(found).toContain("ai.direct-provider-keys");
    expect(found).toContain("ai.client-exposed.VITE_RAZORPAY_SECRET");
  });

  it("flags unapproved model ids and bad model flags", () => {
    const found = ids({
      ...base,
      models: [
        { surface: "chat", model: "openai/gpt-4o" },
        { surface: "chat", model: "google/gemini-3.6-flash", priority: true },
        { surface: "chat", model: "openai/gpt-5.6-sol" },
      ],
    });
    expect(found).toContain("model.unapproved.chat.openai/gpt-4o");
    expect(found).toContain("model.priority.chat.google/gemini-3.6-flash");
    expect(found).toContain("model.reasoning.chat.openai/gpt-5.6-sol");
  });

  it("lowers the score as severity accumulates", () => {
    const report = scanSupplyChain({ ...base, manifest: { dependencies: { "event-stream": "*" } } });
    expect(report.score).toBeLessThan(60);
    expect(report.counts.critical).toBe(1);
  });
});
