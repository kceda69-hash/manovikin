// Pure supply-chain & model-provenance analysis.
//
// Takes a snapshot of the project (manifest, lockfile, env var NAMES, model
// usage) and returns deterministic findings. No I/O, no secrets: the caller
// never passes env VALUES into this module.

import {
  APPROVED_MODEL_IDS,
  DIRECT_AI_PROVIDER_ENV,
  KNOWN_COMPROMISED_PACKAGES,
  PRIORITY_CAPABLE_MODELS,
  REASONING_NONE_REQUIRED,
  TRUSTED_AI_HOSTS,
  TRUSTED_REGISTRY_HOSTS,
  TYPOSQUAT_TARGETS,
  editDistance,
} from "./catalog";

export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Category = "dependency" | "provenance" | "ai-service" | "model-config";

export type Finding = {
  id: string;
  category: Category;
  severity: Severity;
  title: string;
  detail: string;
  remediation: string;
  evidence?: string;
};

export type ModelUsage = {
  /** Where in the app this model is called from, e.g. "chat route". */
  surface: string;
  model: string;
  /** Whether the call sends service_tier: "priority". */
  priority?: boolean;
  /** Whether the call sends reasoning_effort: "none". */
  reasoningNone?: boolean;
};

export type ScanInput = {
  manifest: {
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  };
  /** Raw lockfile text (bun.lock / package-lock.json), or null when absent. */
  lockfileName: string | null;
  lockfileText: string | null;
  /** Env var NAMES only — never values. */
  envNames: string[];
  /** Hosts the app sends inference traffic to. */
  aiHosts: string[];
  models: ModelUsage[];
};

export type ScanReport = {
  generatedAt: string;
  score: number;
  counts: Record<Severity, number>;
  findings: Finding[];
  stats: {
    dependencies: number;
    devDependencies: number;
    lockfile: string | null;
    modelsChecked: number;
    aiHosts: number;
  };
};

const SEVERITY_WEIGHT: Record<Severity, number> = {
  critical: 40,
  high: 20,
  medium: 8,
  low: 3,
  info: 0,
};

const FLOATING_SPECIFIER = /^(\*|x|latest|)$/i;
const REMOTE_PROTOCOL = /^(https?:|git\+|git:|github:|file:|link:)/i;
const PRERELEASE = /-(alpha|beta|rc|canary|next|nightly|preview|dev)[.\d-]*$/i;

// --- dependency & provenance --------------------------------------------

export function analyzeDependencies(input: ScanInput): Finding[] {
  const findings: Finding[] = [];
  const deps = {
    ...(input.manifest.dependencies ?? {}),
    ...(input.manifest.devDependencies ?? {}),
  };

  for (const [name, range] of Object.entries(deps)) {
    const spec = String(range ?? "").trim();

    const compromised = KNOWN_COMPROMISED_PACKAGES[name];
    if (compromised) {
      findings.push({
        id: `dep.compromised.${name}`,
        category: "dependency",
        severity: "critical",
        title: `Dependency with known malicious releases: ${name}`,
        detail: compromised,
        remediation: `Remove ${name} or pin to an audited release, then regenerate the lockfile.`,
        evidence: `${name}@${spec}`,
      });
    }

    if (FLOATING_SPECIFIER.test(spec)) {
      findings.push({
        id: `dep.floating.${name}`,
        category: "provenance",
        severity: "high",
        title: `Unpinned version range for ${name}`,
        detail: `"${spec || "(empty)"}" resolves to whatever the registry serves at install time, so a hijacked release lands in production without a code change.`,
        remediation: `Pin ${name} to a semver range such as ^x.y.z.`,
        evidence: `${name}@${spec}`,
      });
    } else if (REMOTE_PROTOCOL.test(spec)) {
      findings.push({
        id: `dep.remote.${name}`,
        category: "provenance",
        severity: "high",
        title: `${name} installs from outside the npm registry`,
        detail: `The specifier "${spec}" fetches code from a non-registry source, which is not covered by registry integrity checks or advisory scanning.`,
        remediation: `Publish the package to a registry (or your workspace registry) and depend on the published version.`,
        evidence: `${name}@${spec}`,
      });
    } else if (PRERELEASE.test(spec)) {
      findings.push({
        id: `dep.prerelease.${name}`,
        category: "provenance",
        severity: "medium",
        title: `Pre-release dependency in production: ${name}`,
        detail: `"${spec}" is a pre-release build. Pre-release channels get less review and can be unpublished or rewritten.`,
        remediation: `Move ${name} to a stable release before shipping, or document why the pre-release is required.`,
        evidence: `${name}@${spec}`,
      });
    }

    for (const target of TYPOSQUAT_TARGETS) {
      if (name !== target && !name.startsWith("@") && editDistance(name, target) === 1) {
        findings.push({
          id: `dep.typosquat.${name}`,
          category: "dependency",
          severity: "high",
          title: `Possible typosquat: ${name}`,
          detail: `${name} is one character away from the popular package ${target}.`,
          remediation: `Confirm ${name} is intentional; if it was a typo, remove it and install ${target}.`,
          evidence: `${name} ≈ ${target}`,
        });
        break;
      }
    }
  }

  return findings;
}

export function analyzeLockfile(input: ScanInput): Finding[] {
  const findings: Finding[] = [];

  if (!input.lockfileText) {
    findings.push({
      id: "lock.missing",
      category: "provenance",
      severity: "high",
      title: "No lockfile found",
      detail: "Without a lockfile, every build resolves transitive dependencies afresh, so builds are not reproducible and a compromised transitive release can enter silently.",
      remediation: "Commit bun.lock (or package-lock.json) and install with a frozen lockfile in CI.",
    });
    return findings;
  }

  if (input.lockfileName?.endsWith(".lockb")) {
    findings.push({
      id: "lock.binary",
      category: "provenance",
      severity: "medium",
      title: "Binary lockfile cannot be audited",
      detail: "bun.lockb is binary, so dependency scanners and code review cannot read resolved versions or registry hosts.",
      remediation: "Run `bun install --save-text-lockfile` to convert it to a reviewable bun.lock.",
    });
  }

  const hosts = new Set<string>();
  for (const match of input.lockfileText.matchAll(/https?:\/\/([a-z0-9.-]+)/gi)) {
    const host = match[1];
    if (host) hosts.add(host.toLowerCase());
  }
  const untrusted = [...hosts].filter((h) => !TRUSTED_REGISTRY_HOSTS.includes(h));
  if (untrusted.length > 0) {
    findings.push({
      id: "lock.untrusted-registry",
      category: "provenance",
      severity: "medium",
      title: "Packages resolved from non-default registries",
      detail: `The lockfile resolves tarballs from hosts outside the public npm registry: ${untrusted.slice(0, 8).join(", ")}.`,
      remediation: "Confirm each host is an intentional private/workspace registry and that its credentials are workspace build secrets.",
      evidence: untrusted.slice(0, 8).join(", "),
    });
  }

  return findings;
}

// --- third-party AI services --------------------------------------------

export function analyzeAiServices(input: ScanInput): Finding[] {
  const findings: Finding[] = [];

  for (const host of input.aiHosts) {
    const clean = host.replace(/^https?:\/\//, "").split("/")[0]?.toLowerCase() ?? "";
    if (!clean) continue;
    const isLocal = /^(localhost|127\.0\.0\.1|\[::1\]|[a-z0-9-]+:\d+)$/i.test(clean);
    if (TRUSTED_AI_HOSTS.includes(clean) || isLocal) continue;
    findings.push({
      id: `ai.untrusted-host.${clean}`,
      category: "ai-service",
      severity: "high",
      title: `Inference traffic to unreviewed host: ${clean}`,
      detail: "Prompts, user content, and generated code are sent to a third-party AI endpoint that is not on the approved list.",
      remediation: "Route the call through the Lovable AI Gateway, or add the host to the approved list after a data-processing review.",
      evidence: clean,
    });
  }

  const names = new Set(input.envNames);
  const direct = DIRECT_AI_PROVIDER_ENV.filter((n) => names.has(n));
  if (direct.length > 0) {
    findings.push({
      id: "ai.direct-provider-keys",
      category: "ai-service",
      severity: "medium",
      title: "Direct AI provider credentials configured",
      detail: `${direct.join(", ")} are set, so some code path can reach a provider directly, outside gateway logging, quotas, and model allowlisting.`,
      remediation: "Remove the keys if unused, or document the sovereign/self-hosted path that requires them.",
      evidence: direct.join(", "),
    });
  }

  const leaked = [...names].filter(
    (n) => n.startsWith("VITE_") && /(SECRET|SERVICE_ROLE|PRIVATE|_TOKEN|API_KEY)$/i.test(n) && !/PUBLISHABLE/i.test(n),
  );
  for (const n of leaked) {
    findings.push({
      id: `ai.client-exposed.${n}`,
      category: "ai-service",
      severity: "critical",
      title: `Secret-shaped variable exposed to the browser: ${n}`,
      detail: "Any VITE_-prefixed variable is inlined into the client bundle and is readable by every visitor.",
      remediation: `Rename ${n} without the VITE_ prefix and read it only inside server functions.`,
      evidence: n,
    });
  }

  if (!names.has("LOVABLE_API_KEY") && !names.has("MANOVIK_AI_BASE_URL")) {
    findings.push({
      id: "ai.no-gateway-key",
      category: "ai-service",
      severity: "medium",
      title: "No AI gateway credential configured",
      detail: "Neither LOVABLE_API_KEY nor a sovereign MANOVIK_AI_BASE_URL is present, so model calls will fail at runtime.",
      remediation: "Provision LOVABLE_API_KEY, or configure the self-hosted endpoint.",
    });
  }

  return findings;
}

// --- model / API configuration ------------------------------------------

export function analyzeModelConfig(input: ScanInput): Finding[] {
  const findings: Finding[] = [];

  for (const usage of input.models) {
    if (!APPROVED_MODEL_IDS.includes(usage.model)) {
      findings.push({
        id: `model.unapproved.${usage.surface}.${usage.model}`,
        category: "model-config",
        severity: "high",
        title: `Unverified model id: ${usage.model}`,
        detail: `${usage.surface} calls a model id that is not in the approved catalog. The gateway rejects unknown ids with a 400, so this path fails in production.`,
        remediation: "Replace it with a catalog id, or add the model to the approved list once its provenance is reviewed.",
        evidence: `${usage.surface} → ${usage.model}`,
      });
      continue;
    }

    if (usage.priority && !PRIORITY_CAPABLE_MODELS.includes(usage.model)) {
      findings.push({
        id: `model.priority.${usage.surface}.${usage.model}`,
        category: "model-config",
        severity: "low",
        title: `Priority tier requested on a non-priority model: ${usage.model}`,
        detail: `${usage.surface} sends service_tier: "priority" to a model that does not support it. The flag is ignored and the call bills at the standard rate.`,
        remediation: "Drop the priority flag, or switch to a priority-capable model.",
        evidence: `${usage.surface} → ${usage.model}`,
      });
    }

    if (REASONING_NONE_REQUIRED.test(usage.model) && usage.reasoningNone !== true) {
      findings.push({
        id: `model.reasoning.${usage.surface}.${usage.model}`,
        category: "model-config",
        severity: "high",
        title: `Missing reasoning_effort: "none" on ${usage.model}`,
        detail: `${usage.surface} calls a GPT-5.6 model without reasoning_effort: "none". Requests carrying tools are rejected with a 400.`,
        remediation: 'Set reasoning_effort (or providerOptions.lovable.reasoningEffort) to "none" for this call.',
        evidence: `${usage.surface} → ${usage.model}`,
      });
    }
  }

  return findings;
}

// --- entry point ---------------------------------------------------------

export function scanSupplyChain(input: ScanInput): ScanReport {
  const findings = [
    ...analyzeDependencies(input),
    ...analyzeLockfile(input),
    ...analyzeAiServices(input),
    ...analyzeModelConfig(input),
  ];

  const counts: Record<Severity, number> = { critical: 0, high: 0, medium: 0, low: 0, info: 0 };
  let penalty = 0;
  for (const f of findings) {
    counts[f.severity] += 1;
    penalty += SEVERITY_WEIGHT[f.severity];
  }

  const order: Severity[] = ["critical", "high", "medium", "low", "info"];
  findings.sort((a, b) => order.indexOf(a.severity) - order.indexOf(b.severity) || a.id.localeCompare(b.id));

  return {
    generatedAt: new Date().toISOString(),
    score: Math.max(0, 100 - penalty),
    counts,
    findings,
    stats: {
      dependencies: Object.keys(input.manifest.dependencies ?? {}).length,
      devDependencies: Object.keys(input.manifest.devDependencies ?? {}).length,
      lockfile: input.lockfileName,
      modelsChecked: input.models.length,
      aiHosts: input.aiHosts.length,
    },
  };
}
