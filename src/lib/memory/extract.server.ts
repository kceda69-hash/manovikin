// Server-only auto-memory extraction for MANOVIK's Jarvis build (Phase 1).
//
// After a chat turn completes, this module asks the chat model to pull durable
// facts about the USER out of the last exchange (name, preferences, projects,
// goals, constraints). Everything here is defensive: the pipeline never throws
// and never blocks the chat response — on any failure it returns [] and the
// turn is simply not memorized.
//
// Zero-budget notes:
// - Extraction reuses the already-configured chat model + key (no new provider).
// - A per-user daily cap + transcript gating keeps free-tier quota safe.

import { generateText } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import { redactString } from "@/lib/redact";

export interface MemoryFact {
  fact: string;
  category: "identity" | "preference" | "project" | "goal" | "constraint" | "other";
}

const VALID_CATEGORIES = new Set([
  "identity",
  "preference",
  "project",
  "goal",
  "constraint",
  "other",
]);

const MAX_FACTS = 5;
const MAX_EXCHANGE_CHARS = 4000;
const MIN_EXCHANGE_CHARS = 120;
const EXTRACT_TIMEOUT_MS = 20_000;

/** Build the transcript slice the extractor sees. Pure and testable. */
export function buildExchangeText(userText: string, assistantText: string): string {
  const u = (userText ?? "").trim().slice(0, 1500);
  const a = (assistantText ?? "").trim().slice(0, 2500);
  const exchange = `User: ${u}\nAssistant: ${a}`.slice(0, MAX_EXCHANGE_CHARS);
  return exchange;
}

/** Cheap gate: skip extraction for tiny/chit-chat exchanges. Pure and testable. */
export function shouldAttemptExtraction(exchangeText: string): boolean {
  return (exchangeText ?? "").trim().length >= MIN_EXCHANGE_CHARS;
}

export function buildExtractionPrompt(exchangeText: string): string {
  return (
    `You are a memory extractor for an AI companion. Read the conversation exchange below and ` +
    `extract durable facts about the USER that are worth remembering long-term ` +
    `(their name, preferences, projects, goals, relationships, constraints, recurring topics).\n` +
    `Rules:\n` +
    `- Return ONLY a JSON array. Each item: {"fact": "<one clear sentence>", "category": "<identity|preference|project|goal|constraint|other>"}.\n` +
    `- Facts must be about the user, never about the assistant and never general world knowledge.\n` +
    `- Skip greetings, chit-chat, and one-off questions with no lasting value.\n` +
    `- NEVER include anything that looks like a password, API key, token, or other secret.\n` +
    `- Write each fact as a standalone sentence starting with "The user ...".\n` +
    `- Maximum ${MAX_FACTS} facts. If nothing is worth remembering, return [].\n\n` +
    `Conversation:\n${exchangeText}`
  );
}

/** Parse and validate the model's JSON response. Pure, never throws, testable. */
export function parseExtractionResponse(text: string): MemoryFact[] {
  try {
    const raw = (text ?? "").trim();
    if (!raw) return [];
    const start = raw.indexOf("[");
    const end = raw.lastIndexOf("]");
    if (start === -1 || end === -1 || end <= start) return [];
    const parsed: unknown = JSON.parse(raw.slice(start, end + 1));
    if (!Array.isArray(parsed)) return [];
    const facts: MemoryFact[] = [];
    for (const item of parsed) {
      if (facts.length >= MAX_FACTS) break;
      if (typeof item !== "object" || item === null) continue;
      const rec = item as Record<string, unknown>;
      if (typeof rec.fact !== "string") continue;
      // Drop anything that smells like a credential before it ever reaches storage.
      const { text: cleanFact, hits } = redactString(rec.fact);
      if (hits.length > 0) continue;
      const fact = cleanFact.trim().slice(0, 500);
      if (fact.length < 10) continue;
      const category =
        typeof rec.category === "string" && VALID_CATEGORIES.has(rec.category)
          ? (rec.category as MemoryFact["category"])
          : "other";
      facts.push({ fact, category });
    }
    return facts;
  } catch {
    return [];
  }
}

export interface ExtractDeps {
  model: string;
  apiKey: string;
  sovereignKey?: string;
}

/**
 * Deterministic fallback: extract obvious facts from explicit "remember" phrases
 * without needing the LLM. Catches patterns like "my favorite X is Y, please remember that".
 * Pure, never throws, testable.
 */
export function extractDeterministicFacts(userText: string): MemoryFact[] {
  const facts: MemoryFact[] = [];
  try {
    const text = (userText ?? "").trim();
    if (!text) return facts;

    // Pattern: "my favorite <thing> is <value>" (with optional "please remember that")
    const favMatch = text.match(
      /my favorite\s+([a-zA-Z\s]{2,30}?)\s+is\s+([a-zA-Z0-9\s\-']{2,50}?)(?:\.|\s+please|\s+remember|$)/i,
    );
    if (favMatch) {
      const thing = favMatch[1].trim();
      const value = favMatch[2].trim();
      if (thing && value) {
        facts.push({
          fact: `The user's favorite ${thing} is ${value}.`,
          category: "preference",
        });
      }
    }

    // Pattern: "remember that my <thing> is <value>" or "remember my <thing> is <value>"
    const remMatch = text.match(
      /remember (?:that )?my\s+([a-zA-Z\s]{2,30}?)\s+is\s+([a-zA-Z0-9\s\-']{2,50}?)(?:\.|$)/i,
    );
    if (remMatch && facts.length === 0) {
      const thing = remMatch[1].trim();
      const value = remMatch[2].trim();
      if (thing && value) {
        facts.push({
          fact: `The user's ${thing} is ${value}.`,
          category: "preference",
        });
      }
    }

    // Pattern: "my name is <value>"
    const nameMatch = text.match(/my name is\s+([a-zA-Z\s\-']{2,50}?)(?:\.|$)/i);
    if (nameMatch) {
      const name = nameMatch[1].trim();
      if (name) {
        facts.push({
          fact: `The user's name is ${name}.`,
          category: "identity",
        });
      }
    }
  } catch {
    // Never throw — return what we have.
  }
  return facts.slice(0, MAX_FACTS);
}

/**
 * Run the extraction LLM call. Never throws — returns [] on any failure
 * (timeout, rate limit, model outage) so chat is never affected.
 * Falls back to deterministic pattern matching for explicit remember phrases.
 */
export async function extractMemoryFacts(
  exchangeText: string,
  deps: ExtractDeps,
): Promise<MemoryFact[]> {
  if (!shouldAttemptExtraction(exchangeText)) return [];
  // Try deterministic patterns first (fast, no LLM needed for obvious cases).
  const userPart = exchangeText.split("\n")[0]?.replace(/^User:\s*/, "") ?? "";
  const deterministic = extractDeterministicFacts(userPart);
  if (deterministic.length > 0) return deterministic;

  try {
    const provider = createLovableAiGatewayProvider(deps.apiKey, deps.sovereignKey);
    const result = await generateText({
      model: provider(deps.model),
      system: "You extract durable user facts as JSON. Output only the JSON array.",
      prompt: buildExtractionPrompt(exchangeText),
      temperature: 0,
      maxOutputTokens: 400,
      maxRetries: 0,
      abortSignal: AbortSignal.timeout(EXTRACT_TIMEOUT_MS),
    });
    return parseExtractionResponse(result.text);
  } catch (e) {
    console.warn("[auto-memory] extraction skipped:", e instanceof Error ? e.message : e);
    return [];
  }
}
