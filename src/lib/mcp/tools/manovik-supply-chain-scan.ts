import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { scanSupplyChain, type ScanInput } from "@/lib/supply-chain/analyzer";
import { toolError } from "../ai-call";

export default defineTool({
  name: "manovik_supply_chain_scan",
  title: "Supply-chain & model provenance scan",
  description:
    "Audit a project's dependencies and AI configuration offline: paste a package.json (and optionally a lockfile, env var NAMES, AI hosts and model ids). Detects unpinned/floating versions, remote git/file deps, pre-release builds in production, known-compromised packages, typosquats, unapproved AI endpoints, leaked-key patterns and bad model config. Returns a 0-100 score with prioritised findings. Never send secret values — names only.",
  inputSchema: {
    package_json: z
      .string()
      .trim()
      .min(2)
      .max(200000)
      .describe("Raw package.json contents to analyse."),
    lockfile_name: z
      .string()
      .trim()
      .max(60)
      .optional()
      .describe("Lockfile filename, e.g. 'bun.lock' or 'package-lock.json'."),
    lockfile_text: z
      .string()
      .max(400000)
      .optional()
      .describe("Raw lockfile contents (optional, improves provenance checks)."),
    env_names: z
      .array(z.string().max(120))
      .optional()
      .describe("Environment variable NAMES only (never values), e.g. ['VITE_API_URL']."),
    ai_hosts: z
      .array(z.string().max(200))
      .optional()
      .describe("Hosts the app sends inference traffic to, e.g. ['api.openai.com']."),
    models: z
      .array(z.string().max(120))
      .optional()
      .describe("Model ids the app calls, e.g. ['google/gemini-3.6-flash']."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: ({ package_json, lockfile_name, lockfile_text, env_names, ai_hosts, models }) => {
    try {
      let manifest: ScanInput["manifest"];
      try {
        manifest = JSON.parse(package_json) as ScanInput["manifest"];
      } catch {
        throw new Error("package_json is not valid JSON.");
      }

      const report = scanSupplyChain({
        manifest,
        lockfileName: lockfile_name ?? null,
        lockfileText: lockfile_text ?? null,
        envNames: env_names ?? [],
        aiHosts: ai_hosts ?? [],
        models: (models ?? []).map((id) => ({ id, where: "mcp-input" })),
      });

      return {
        content: [{ type: "text", text: JSON.stringify(report, null, 2) }],
        structuredContent: report as unknown as Record<string, unknown>,
      };
    } catch (err) {
      return toolError(err);
    }
  },
});
