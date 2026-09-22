/**
 * Jarvis-style boot greeting name resolution.
 *
 * Uses only credible auth metadata (given_name, full_name, name) after
 * validation. Never derives a displayed name from the email address, so a
 * user like "kceda69@gmail.com" never gets greeted as "kceda69".
 */

export interface BootUser {
  user_metadata?: Record<string, unknown> | null;
}

const FIRST_NAME_RE = /^[\p{L}][\p{L}'-]*$/u;
const CONTROL_CHARS_RE = /[\p{Cc}\p{Cf}]/u;
const MAX_NAME_LENGTH = 40;

export function bootDisplayName(user: BootUser | null | undefined): string | null {
  const meta = user?.user_metadata ?? {};
  const candidates = [meta.given_name, meta.full_name, meta.name];
  for (const raw of candidates) {
    if (typeof raw !== "string") continue;
    const trimmed = raw.trim();
    if (!trimmed || trimmed.includes("@") || trimmed.length > MAX_NAME_LENGTH) continue;
    if (CONTROL_CHARS_RE.test(trimmed)) continue;
    const first = trimmed.split(/\s+/)[0];
    if (first.length >= 2 && FIRST_NAME_RE.test(first)) return first;
  }
  return null;
}
