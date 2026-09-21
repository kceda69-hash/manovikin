import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { assertAdmin } from "@/lib/admin-guard";
import { TIER_MODEL } from "@/lib/model-router";
import {
  scanSupplyChain,
  type ModelUsage,
  type ScanInput,
  type ScanReport,
} from "@/lib/supply-chain/analyzer";

// Manifest + lockfile are inlined at build time — the Worker runtime has no
// project filesystem to read them from.
const manifestFiles = import.meta.glob("/package.json", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;
const lockFiles = import.meta.glob("/bun.lock", {
  query: "?raw",
  import: "default",
  eager: true,
}) as Record<string, string>;

function readManifest(): ScanInput["manifest"] {
  const raw = Object.values(manifestFiles)[0];
  if (!raw) return {};
  try {
    return JSON.parse(raw) as ScanInput["manifest"];
  } catch {
    return {};
  }
}

function readLockfile(): { name: string | null; text: string | null } {
  const entry = Object.entries(lockFiles)[0];
  if (!entry) return { name: null, text: null };
  return { name: entry[0].replace(/^\//, ""), text: entry[1] };
}

/** Models MANOVIK actually calls, with the flags each call site sends. */
function modelSurfaces(): ModelUsage[] {
  const usages: ModelUsage[] = Object.entries(TIER_MODEL).map(([tier, cfg]) => ({
    surface: `chat:${tier}`,
    model: cfg.model,
    priority: cfg.priority,
    reasoningNone: /^openai\/gpt-5\.6-/.test(cfg.model),
  }));
  usages.push({
    surface: "chat:very-hard",
    model: "openai/gpt-5.6-sol",
    priority: true,
    reasoningNone: true,
  });
  usages.push({ surface: "image:generate", model: "google/gemini-3-pro-image" });
  return usages;
}

function aiHosts(): string[] {
  const hosts = ["ai.gateway.lovable.dev"];
  const sovereign = process.env["MANOVIK_AI_BASE_URL"];
  if (sovereign) hosts.push(sovereign);
  return hosts;
}

/** Env var NAMES only — values never leave the server. */
function envNames(): string[] {
  try {
    return Object.keys(process.env).sort();
  } catch {
    return [];
  }
}

export const runSupplyChainScan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ reportJson: string }> => {
    await assertAdmin(context);
    const lock = readLockfile();
    const report = scanSupplyChain({
      manifest: readManifest(),
      lockfileName: lock.name,
      lockfileText: lock.text,
      envNames: envNames(),
      aiHosts: aiHosts(),
      models: modelSurfaces(),
    });
    return { reportJson: JSON.stringify(report) };
  });

export function parseSupplyChainReport(json: string): ScanReport | null {
  try {
    return JSON.parse(json) as ScanReport;
  } catch {
    return null;
  }
}
