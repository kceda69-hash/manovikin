import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import { webscanUrl, type WebScanReport } from "./webscan.server";

type Ctx = { userId: string };

const scanInput = z.object({
  url: z.string().trim().min(1).max(500),
});

/**
 * Run a defensive web security scan from the /security page.
 * Auth required. The scan itself is read-only (headers + status codes).
 * Audit-logged like every other agent action.
 */
export const runWebScan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => scanInput.parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; report: WebScanReport } | { ok: false; error: string }> => {
    const { userId } = context as unknown as Ctx;
    try {
      const report = await webscanUrl(data.url);
      const { logAgentAction } = await import("@/lib/agent-audit.server");
      await logAgentAction({
        userId,
        action: "seclab.webscan",
        summary: `Security scan of ${report.finalUrl}: score ${report.score}/100 (${report.findings.length} findings)`,
        metadata: {
          url: report.url,
          finalUrl: report.finalUrl,
          score: report.score,
          highs: report.findings.filter((f) => f.severity === "high").length,
          source: "security-page",
        },
      });
      return { ok: true, report };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "scan failed";
      if (msg.includes("Blocked URL")) {
        return {
          ok: false,
          error: "That host can't be scanned (private/internal). Only public websites you own or are authorized to test.",
        };
      }
      return { ok: false, error: msg.slice(0, 300) };
    }
  });
