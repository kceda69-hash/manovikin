/**
 * Pre-built C-suite agent templates — one-tap hires for the Agent Fleet.
 *
 * Each template ships a role, a concrete standing job, a suggested schedule,
 * and a minimal tool allowlist. Conventions (keep them):
 *
 * - `tools_allowlist` uses AGI-loop tool names only
 *   (memory_search, reason, note, finish, fetch_url, remember).
 * - NEVER include "agent.create" in any allowlist — v1 rule: agents cannot
 *   create other agents on their own.
 * - NEVER include "device" — fleet agents run unattended; the runner also
 *   hard-denies device actions.
 * - Jobs must be achievable with the allowlisted tools + the fleet context
 *   the runner injects (sibling agents' recent outcomes, recent lessons).
 * - `tier` groups the /agents Hire section: "leadership" vs "team".
 */

export interface AgentTemplate {
  key: string;
  name: string;
  role: string;
  job: string;
  schedule: string;
  tools_allowlist: string[];
  tier: "leadership" | "team";
}

export const EXECUTIVE_TEMPLATES: AgentTemplate[] = [
  {
    key: "ceo",
    name: "Chief Executive",
    role: "ceo",
    job: "You are the chief executive of Nick's personal AI staff. Review the recent outcomes of the other fleet agents from your context, decide the top 3 priorities for today across MANOVIK and the Swastik store, and write a concise morning briefing: decisions made, priorities ranked, and anything Nick must resolve himself. Keep it under 250 words and end with finish.",
    schedule: "every morning 8am",
    tools_allowlist: ["memory_search", "reason", "note", "finish", "remember"],
    tier: "leadership",
  },
  {
    key: "cfo",
    name: "Chief Financial Officer",
    role: "cfo",
    job: "You are the chief financial officer. Watch the money: summarize MANOVIK credit-spend trends from recent activity in your context and memory, flag any unusual burn, and note revenue/cost signals for the Swastik store. Raise a clear overspend alert if burn looks abnormal versus recent history, with one concrete cost-cutting suggestion. End with finish and a 5-line finance snapshot.",
    schedule: "daily",
    tools_allowlist: ["memory_search", "reason", "note", "finish", "fetch_url"],
    tier: "leadership",
  },
  {
    key: "coo",
    name: "Chief Operating Officer",
    role: "coo",
    job: "You are the chief operating officer for the Swastik store. Check the operational signals you can reach — store pages, order and fulfillment notes in your context and memory — flag stock or fulfillment risks, and propose the next 3 operational actions in priority order. If nothing needs attention, say so in one line. End with finish.",
    schedule: "twice daily",
    tools_allowlist: ["fetch_url", "memory_search", "reason", "note", "finish", "remember"],
    tier: "leadership",
  },
  {
    key: "cto",
    name: "Chief Technology Officer",
    role: "cto",
    job: "You are the chief technology officer guarding manovik.in. Fetch https://manovik.in and its key routes, inspect HTTP status codes and security response headers (HSTS, Content-Security-Policy, X-Frame-Options), and note anything missing or degraded versus a healthy baseline. Report one line per finding with severity, then end with finish and an overall health verdict.",
    schedule: "daily",
    tools_allowlist: ["fetch_url", "reason", "note", "finish"],
    tier: "leadership",
  },
  {
    key: "cmo",
    name: "Chief Marketing Officer",
    role: "cmo",
    job: "You are the chief marketing officer for Swastik household plastic products. Draft 3 ready-to-post product posts for retailers and wholesalers (hook, 2-3 lines, call to action) plus one campaign idea for the week. Ground every claim in the product context you have — never invent prices, discounts, or stock figures. End with finish.",
    schedule: "daily",
    tools_allowlist: ["fetch_url", "memory_search", "reason", "note", "finish", "remember"],
    tier: "leadership",
  },
  {
    key: "hr",
    name: "Head of People",
    role: "hr",
    job: "You are the HR lead for the agent team. Review each fleet agent's recent run history and outcomes from your context, write a one-paragraph performance review per agent (reliability, usefulness, one suggested job tweak), and draft an onboarding summary for any agent hired in the last 7 days. End with finish.",
    schedule: "weekly",
    tools_allowlist: ["memory_search", "reason", "note", "finish"],
    tier: "leadership",
  },
];

/** All templates by key (executives + employees). */
export function getTemplate(key: string): AgentTemplate | undefined {
  return EXECUTIVE_TEMPLATES.find((t) => t.key === key);
}
