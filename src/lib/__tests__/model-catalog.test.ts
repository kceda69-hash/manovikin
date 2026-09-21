import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { APPROVED_MODEL_IDS } from "@/lib/supply-chain/catalog";

// Guard: the gateway rejects unknown model ids with a hard 400, so every model
// string shipped in src/ must exist in the approved catalog.
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(p) && !p.includes("__tests__") && !p.endsWith("routeTree.gen.ts"))
      out.push(p);
  }
  return out;
}

const MODEL_RE = /"(google|openai|anthropic)\/[a-z0-9.-]+"/g;

describe("model catalog", () => {
  it("only references approved model ids", () => {
    const approved = new Set(APPROVED_MODEL_IDS);
    const offenders: string[] = [];

    for (const file of walk("src")) {
      const src = readFileSync(file, "utf8");
      for (const match of src.match(MODEL_RE) ?? []) {
        const id = match.slice(1, -1);
        // Prefix guards like "openai/gpt-5.6" are used with startsWith, not sent.
        if (approved.has(id) || APPROVED_MODEL_IDS.some((m) => m.startsWith(`${id}-`))) continue;
        offenders.push(`${file}: ${id}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it("keeps the default chat model on the latest flash tier", async () => {
    const { TIER_MODEL } = await import("@/lib/model-router");
    expect(TIER_MODEL.standard.model).toBe("google/gemini-3.7-flash");
    expect(approvedHas(TIER_MODEL.standard.model)).toBe(true);
  });
});

function approvedHas(id: string) {
  return APPROVED_MODEL_IDS.includes(id);
}
