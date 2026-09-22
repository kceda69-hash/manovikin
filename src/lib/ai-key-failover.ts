// Shared backup-API-key failover for free-tier Gemini keys. When the key in
// use is rate-limited (429) we mark it throttled and subsequent requests fail
// over to MANOVIK_AI_API_KEY_BACKUP until the throttle expires.
// Best-effort per isolate; safe to lose on cold start.

export const KEY_THROTTLE_MS = 15 * 60 * 1000;

const keyThrottledUntil: number[] = [0, 0];

/** Configured Gemini API keys: primary first, backup second. */
export function aiKeys(): string[] {
  return [process.env.MANOVIK_AI_API_KEY, process.env.MANOVIK_AI_API_KEY_BACKUP].filter(
    (k): k is string => !!k,
  );
}

/** Index into aiKeys(): prefers the primary key unless it is throttled. */
export function pickKeyIndex(): number {
  const now = Date.now();
  const count = aiKeys().length;
  for (let i = 0; i < count; i++) {
    if (now >= (keyThrottledUntil[i] ?? 0)) return i;
  }
  return 0;
}

/** Mark a key throttled after a 429 so the next request fails over. */
export function markKeyThrottled(index: number): void {
  keyThrottledUntil[index] = Date.now() + KEY_THROTTLE_MS;
}

/** Clear a key's throttle after a successful call. */
export function clearKeyThrottled(index: number): void {
  keyThrottledUntil[index] = 0;
}
