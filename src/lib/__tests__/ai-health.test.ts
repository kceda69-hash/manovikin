import { describe, expect, it } from "vitest";
import { AI_HEALTH_BUDGET_MS } from "@/lib/ai-health.server";

/**
 * Regression tests for the AI health monitoring Nick approved.
 * Locks in the permanent fix for "why not solving the problem permanently":
 * end-to-end monitoring of the real AI path, not just page-load checks.
 */
describe("ai-health probe budget", () => {
  it("stays under the client watchdog so a real chat would still work", () => {
    // The probe must complete (success or failure) well before the 60s
    // client watchdog, otherwise the monitoring itself would time out.
    expect(AI_HEALTH_BUDGET_MS).toBeLessThan(60_000);
  });

  it("allows enough time for model fallbacks", () => {
    // 4 models x 10s probe = 40s worst case; budget gives headroom.
    expect(AI_HEALTH_BUDGET_MS).toBeGreaterThanOrEqual(40_000);
  });
});

describe("ai-health migration", () => {
  it("uses the vault-backed token pattern (not a hardcoded secret)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const sql = readFileSync(
      resolve(__dirname, "../../../supabase/migrations/20261014090000_ai_health_cron.sql"),
      "utf-8",
    );
    // Vault-backed token, same as fleet-tick.
    expect(sql).toContain("vault.create_secret");
    expect(sql).toContain("ai_health_token");
    expect(sql).toContain("get_ai_health_token");
    // Service-role only, like the fleet tick token.
    expect(sql).toContain("GRANT EXECUTE ON FUNCTION public.get_ai_health_token() TO service_role");
    // 15-minute schedule.
    expect(sql).toContain("*/15 * * * *");
    expect(sql).toContain("manovik-ai-health");
  });
});

describe("ai-health hook auth", () => {
  it("fails closed without a token (mirrors fleet-tick dual-auth)", async () => {
    const { readFileSync } = await import("node:fs");
    const { resolve } = await import("node:path");
    const src = readFileSync(
      resolve(__dirname, "../../../src/routes/api/public/hooks/ai-health.ts"),
      "utf-8",
    );
    expect(src).toContain("isAuthorizedHookOrCronToken");
    expect(src).toContain("get_ai_health_token");
    expect(src).toContain("403");
  });
});
