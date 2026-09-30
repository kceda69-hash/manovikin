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
import type { ToolDef } from "./sandbox";
import { compileDossier, DOSSIER_FOOTER } from "./dossier/dossier.server";

export const DOSSIER_REFUSAL =
  "I can't collect private data on anyone — but I can put together a public professional brief instead. Want that?";

const PRIVATE_DATA_REQUEST_RE =
  /\b(phone|mobile|cell|telephone|email|address|home address|street address|track|tracking|locate|location|whereabouts|follow|surveil|family|wife|husband|spouse|partner|kids|children|daughter|son|dob|date of birth|birthday|aadhaar|pan card|ssn|social security|passport|private|personal data)\b/i;

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
  execute: async ({ name, context }, { signal }) => {
    if (isPrivateDataRequest(name, context)) {
      return { refused: true, message: DOSSIER_REFUSAL };
    }
    const { summary, facts, sources } = await compileDossier(name, context, { signal });
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
