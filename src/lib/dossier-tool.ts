// person.brief tool — public professional dossier for MANO.
//
// Exported in registry shape (name, description, schema, timeoutMs,
// maxOutputBytes, rateLimitPerMin, execute) so the coordinator can register it
// in src/lib/agent-tools.ts. NOT registered here on purpose.
//
// Hard refusal: any request for non-public data (phone, address,
// track/locate, family, …) is refused with a one-line refusal plus an offer
// to compile a public brief instead.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ToolDef } from "./sandbox";
import { compileDossier, DOSSIER_FOOTER } from "./dossier/dossier.server";

export const DOSSIER_REFUSAL =
  "I can't collect private data on anyone — but I can put together a public professional brief instead. Want that?";

const PRIVATE_DATA_REQUEST_RE =
  // FIX (agent-safety audit): the old keyword list was paraphrase-trivial.
  // Expanded with contact/family/financial/legal/medical categories and
  // common phrasings ("where does he live", "contact number"). This is the
  // first line of defense; fetched-text redaction (redactPrivateIdentifiers)
  // remains the backstop for anything that slips through.
  /\b(phone|mobile|cell|telephone|contact number|contact details|email|e-mail|mail id|address|home address|street address|residence|where (?:does|do) (?:he|she|they) live|track|tracking|locate|location|whereabouts|follow|surveil|surveillance|stalk|stalking|family|wife|husband|spouse|partner|girlfriend|boyfriend|married|marriage|divorce|divorced|kids|children|daughter|son|dob|date of birth|birth ?day|birthdate|aadhaar|aadhar|pan card|ssn|social security|passport|voter id|driving li[cs]en[cs]e|private|personal data|personal info|personally identifiable|salary|income|net worth|medical|health record|diagnosis|criminal|arrest|fir\b|police case|court case|bank account|account number|credit card|card number)\b/i;

/**
 * True when the request is really asking for non-public data rather than a
 * public professional brief. Checked against both the name and the context.
 */
export function isPrivateDataRequest(name: string, context?: string): boolean {
  return PRIVATE_DATA_REQUEST_RE.test(`${name} ${context ?? ""}`);
}

type DossierInput = { name: string; context?: string };

export const dossierTool: ToolDef<DossierInput> = {
  name: "person.brief",
  description:
    "Compile a person's PUBLIC professional footprint (role, company, career history, public posts, news mentions) from public sources only. Use when Nick asks for background before a meeting. NEVER for private data — phone numbers, addresses, tracking, or anything behind a login are refused.",
  schema: z.object({ name: z.string().min(2), context: z.string().optional() }),
  timeoutMs: 60_000,
  maxOutputBytes: 12_000,
  rateLimitPerMin: 10,
  execute: async ({ name, context }, { signal, userId }) => {
    if (isPrivateDataRequest(name, context)) {
      return { refused: true, message: DOSSIER_REFUSAL };
    }
    // Price what burns: a dossier is web research plus a synthesis call.
    const { CREDIT_PRICES, isBillingExempt, spendCredits } = await import("./credits.server");
    if (!(await isBillingExempt(supabaseAdmin, userId))) {
      const outcome = await spendCredits(
        supabaseAdmin,
        userId,
        CREDIT_PRICES.dossierBrief,
        `dossier.brief:${Date.now()}`,
      );
      if (outcome === "insufficient") {
        return {
          ok: false,
          error: "insufficient_credits",
          message: "Out of credits — top up to compile dossiers.",
        };
      }
      if (outcome === "failed") {
        return {
          ok: false,
          error: "billing_unavailable",
          message: "Credit service unavailable — try again shortly.",
        };
      }
    }
    const { summary, facts, sources } = await compileDossier(name, context, { signal });
    // FIX (agent-safety audit): dossier compiles are audit-logged.
    const { logAgentAction } = await import("./agent-audit.server");
    await logAgentAction({
      userId,
      action: "dossier.compile",
      summary: `Public dossier compiled for "${name}" (${sources.length} sources)`,
      metadata: { name, sources },
    });
    const lines = [`# Public brief: ${name}`, "", summary, ""];
    if (facts.length) {
      lines.push("## Key facts", ...facts.map((f) => `- ${f}`), "");
    }
    if (sources.length) {
      lines.push("## Sources", ...sources.map((s) => `- ${s}`), "");
    }
    lines.push(DOSSIER_FOOTER);
    return { brief: lines.join("\n") };
  },
};
