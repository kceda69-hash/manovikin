// Shared per-isolate rate limiter for public AI entry points (MCP tools, MANO).
// Keeps anonymous callers from draining paid AI-gateway credits.

const calls: number[] = [];
const MAX_UNITS_PER_MIN = 20;

/**
 * Consume `units` from the per-isolate minute budget.
 * Throws when the budget is exhausted.
 * @param units cost weight of the call (a multi-stage run costs more than one)
 */
export function throttle(units = 1, label = "MANOVIK MCP") {
  const now = Date.now();
  while (calls.length && calls[0]! < now - 60_000) calls.shift();
  if (calls.length + units > MAX_UNITS_PER_MIN) {
    throw new Error(`${label} is busy (rate limit reached). Retry in a minute.`);
  }
  for (let i = 0; i < units; i += 1) calls.push(now);
}
