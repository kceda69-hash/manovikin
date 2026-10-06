// seclab.webscan tool — defensive web security scanner for MANO.
//
// Exported in registry shape (name, description, schema, timeoutMs,
// maxOutputBytes, rateLimitPerMin, execute) so the coordinator can register it
// in src/lib/agent-tools.ts. NOT registered here on purpose.
//
// Strictly defensive: read-only header/status inspection of websites the user
// owns or is authorized to test. No exploits, no payloads, no brute-forcing,
// no downloading of sensitive file bodies. Private/internal hosts are refused.
import { z } from "zod";
import type { ToolDef } from "./sandbox";
import { webscanUrl } from "./seclab/webscan.server";

export const seclabWebscanTool: ToolDef<{ url: string }> = {
  name: "seclab.webscan",
  description:
    "Run a defensive, read-only security scan on a website the user owns or is authorized to test. Checks TLS, security headers (CSP/HSTS/X-Frame-Options/…), exposed sensitive paths (.git, .env, server-status), cookie flags, server version disclosure, and CORS. Returns a 0-100 score plus findings with remediations. Private/internal hosts are refused. NEVER scan a target the user doesn't own or isn't authorized to test — ask if unsure.",
  schema: z.object({
    url: z
      .string()
      .trim()
      .min(1)
      .max(500)
      .describe("The website URL to scan (e.g. https://example.com). Must be a site the user owns or is authorized to test."),
  }),
  timeoutMs: 30_000,
  maxOutputBytes: 12_000,
  rateLimitPerMin: 5,
  execute: async ({ url }, { userId }) => {
    try {
      const report = await webscanUrl(url);
      const { logAgentAction } = await import("./agent-audit.server");
      await logAgentAction({
        userId,
        action: "seclab.webscan",
        summary: `Security scan of ${report.finalUrl}: score ${report.score}/100 (${report.findings.length} findings)`,
        metadata: {
          url: report.url,
          finalUrl: report.finalUrl,
          score: report.score,
          highs: report.findings.filter((f) => f.severity === "high").length,
          source: "chat-tool",
        },
      });
      return { ok: true, report };
    } catch (e) {
      const msg = e instanceof Error ? e.message : "scan failed";
      if (msg.includes("Blocked URL")) {
        return {
          ok: false,
          error: "blocked",
          message: "That host can't be scanned (private/internal). Only public websites you own or are authorized to test.",
        };
      }
      return { ok: false, error: "scan_failed", message: msg.slice(0, 300) };
    }
  },
};
