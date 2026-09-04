// MANO 1.1 inference engine — server only.
// Runs MANOVIK's own multi-stage inference cycle on top of interchangeable
// compute substrates. Never reads env at module scope (Worker cold start).

import {
  MANO_MODEL_ID,
  MANO_VERSION,
  MANO_STAGE_PROMPT,
  classifyMano,
  stagesFor,
  substrateFor,
  type ManoComplexity,
  type ManoStage,
} from "./mano1";
import { throttle } from "@/lib/mcp/throttle";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

/** Ordered substitutes if a substrate call fails transiently. */
const SUBSTRATE_FALLBACKS = ["google/gemini-3.7-flash", "google/gemini-3.5-flash"];

export type ManoRunInput = {
  prompt: string;
  system?: string;
  hasAttachments?: boolean;
  maxTokens?: number;
  /** Force a depth instead of the classifier. */
  depth?: ManoComplexity;
};

export type ManoRunResult = {
  model: string;
  version: string;
  depth: ManoComplexity;
  stages: Array<{ stage: ManoStage; substrate: string; ms: number }>;
  text: string;
};

function authHeaders(): { url: string; headers: Record<string, string> } {
  const sovereignBaseUrl = process.env.MANOVIK_AI_BASE_URL;
  const sovereignKey = process.env.MANOVIK_AI_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;

  if (!sovereignBaseUrl && !lovableKey) {
    throw new Error("MANO 1.1 is not configured on this deployment.");
  }

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (sovereignBaseUrl) {
    headers.Authorization = `Bearer ${sovereignKey ?? "manovik"}`;
    return { url: `${sovereignBaseUrl.replace(/\/$/, "")}/chat/completions`, headers };
  }
  headers["Lovable-API-Key"] = lovableKey!;
  return { url: GATEWAY_URL, headers };
}

function isRetryable(status: number) {
  return status === 429 || status >= 500;
}

async function callSubstrate(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<string> {
  const { url, headers } = authHeaders();

  const body: Record<string, unknown> = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  };
  if (model.startsWith("openai/")) body.max_completion_tokens = maxTokens;
  else body.max_tokens = maxTokens;
  if (model.startsWith("openai/gpt-5.6")) body.reasoning_effort = "none";

  const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });

  if (!res.ok) {
    const detail = (await res.text()).slice(0, 400);
    if (res.status === 402) throw new Error("MANO 1.1 credits exhausted for this workspace.");
    const err = new Error(`MANO 1.1 substrate failed [${res.status}]: ${detail}`);
    (err as Error & { retryable?: boolean }).retryable = isRetryable(res.status);
    throw err;
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = json.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error("MANO 1.1 returned an empty response.");
  return text;
}

async function callWithFallback(
  model: string,
  system: string,
  user: string,
  maxTokens: number,
): Promise<{ text: string; substrate: string }> {
  const chain = [model, ...SUBSTRATE_FALLBACKS.filter((m) => m !== model)];
  let last: unknown;
  for (const candidate of chain) {
    try {
      return { text: await callSubstrate(candidate, system, user, maxTokens), substrate: candidate };
    } catch (err) {
      last = err;
      if (!(err as { retryable?: boolean })?.retryable) throw err;
    }
  }
  throw last instanceof Error ? last : new Error("MANO 1.1 request failed.");
}

/**
 * Run MANO 1.1 end to end.
 * lite     → draft only
 * standard → draft → adversary → synthesis
 * deep     → plan → draft → adversary → synthesis
 */
export async function runMano(input: ManoRunInput): Promise<ManoRunResult> {
  const prompt = (input.prompt ?? "").trim();
  if (!prompt) throw new Error("MANO 1.1 requires a prompt.");

  const depth = input.depth ?? classifyMano(prompt, input.hasAttachments);
  const substrates = substrateFor(depth);
  const stages = stagesFor(depth);
  // Each stage is a separate paid model call, so charge the shared per-isolate
  // budget once per stage before any substrate is touched.
  throttle(stages.length, "MANO 1.1");

  const maxTokens = input.maxTokens ?? 6000;
  const extra = input.system ? `\n\nADDITIONAL OPERATOR INSTRUCTION:\n${input.system}` : "";

  const trace: ManoRunResult["stages"] = [];
  let plan = "";
  let draft = "";
  let critique = "";
  let final = "";

  for (const stage of stages) {
    const started = Date.now();
    const system = MANO_STAGE_PROMPT[stage] + extra;

    let user: string;
    if (stage === "plan") user = `TASK:\n${prompt}`;
    else if (stage === "draft") user = plan ? `TASK:\n${prompt}\n\nEXECUTION PLAN:\n${plan}` : `TASK:\n${prompt}`;
    else if (stage === "adversary") user = `TASK:\n${prompt}\n\nDRAFT UNDER REVIEW:\n${draft}`;
    else user = `TASK:\n${prompt}\n\nDRAFT:\n${draft}\n\nREVIEW FINDINGS:\n${critique}`;

    const tokens = stage === "plan" || stage === "adversary" ? Math.min(maxTokens, 1500) : maxTokens;
    // When MANOVIK's own trained weights are deployed, MANOVIK_AI_MODEL_ID
    // pins every stage to them behind the same mano-1.1 id; otherwise the
    // stage runs on its assigned interchangeable substrate.
    const target = process.env.MANOVIK_AI_MODEL_ID?.trim() || substrates[stage];
    const { text, substrate } = await callWithFallback(target, system, user, tokens);

    if (stage === "plan") plan = text;
    else if (stage === "draft") {
      draft = text;
      final = text;
    } else if (stage === "adversary") {
      critique = text;
      // Nothing to fix — skip the synthesis pass and keep the draft.
      if (/^\s*NO DEFECTS\s*$/i.test(text)) {
        trace.push({ stage, substrate, ms: Date.now() - started });
        break;
      }
    } else {
      final = text;
    }

    trace.push({ stage, substrate, ms: Date.now() - started });
  }

  return { model: MANO_MODEL_ID, version: MANO_VERSION, depth, stages: trace, text: final };
}
