/** Server-only aggregation helpers for usage metering. */

export type UsageEvent = {
  kind: string;
  model: string | null;
  credits: number | null;
  input_tokens: number | null;
  output_tokens: number | null;
  created_at: string;
};

export function summarizeUsage(events: UsageEvent[]) {
  const byKind: Record<string, { count: number; credits: number }> = {};
  const byDay: Record<string, number> = {};
  let credits = 0;
  let inputTokens = 0;
  let outputTokens = 0;

  for (const e of events) {
    const c = e.credits ?? 0;
    credits += c;
    inputTokens += e.input_tokens ?? 0;
    outputTokens += e.output_tokens ?? 0;
    const kind = e.kind || "other";
    byKind[kind] ??= { count: 0, credits: 0 };
    byKind[kind].count += 1;
    byKind[kind].credits += c;
    const day = e.created_at.slice(0, 10);
    byDay[day] = (byDay[day] ?? 0) + c;
  }

  return {
    totals: { events: events.length, credits, inputTokens, outputTokens },
    byKind: Object.entries(byKind)
      .map(([kind, v]) => ({ kind, ...v }))
      .sort((a, b) => b.credits - a.credits || b.count - a.count),
    byDay: Object.entries(byDay)
      .map(([day, creditsUsed]) => ({ day, credits: creditsUsed }))
      .sort((a, b) => a.day.localeCompare(b.day)),
    recent: events.slice(0, 25),
  };
}
