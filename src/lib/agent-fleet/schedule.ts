/**
 * Agent Fleet schedule parsing + next-run computation.
 *
 * Supported schedule formats (case-insensitive, documented here as the
 * contract — keep this comment in sync with the parser):
 *
 *   "hourly"            → every 60 minutes
 *   "twice daily"       → every 12 hours ("twice-daily", "every 12 hours")
 *   "daily"             → every 24 hours ("every day")
 *   "weekly"            → every 7 days ("every week")
 *   "every morning 8am" → every day at 08:00
 *   "daily 8am" / "8am" / "08:00" / "8:30pm" / "20:00"
 *                       → every day at that wall-clock time
 *
 * Daily-at-time schedules use Asia/Calcutta wall-clock time (Nick's
 * timezone; India has no DST so UTC+5:30 is stable year-round).
 *
 * Normalized storage forms: "hourly" | "12h" | "daily" | "weekly" |
 * "daily@HH:MM" (24-hour).
 */

export type ParsedSchedule =
  | { kind: "interval"; normalized: string; ms: number }
  | { kind: "dailyAt"; normalized: string; hour: number; minute: number };

/** Minutes offset of Asia/Calcutta from UTC (no DST, stable). */
const IST_OFFSET_MIN = 330;

const INTERVALS: Record<string, { normalized: string; ms: number }> = {
  hourly: { normalized: "hourly", ms: 3_600_000 },
  "every hour": { normalized: "hourly", ms: 3_600_000 },
  "twice daily": { normalized: "12h", ms: 43_200_000 },
  "twice-daily": { normalized: "12h", ms: 43_200_000 },
  "every 12 hours": { normalized: "12h", ms: 43_200_000 },
  daily: { normalized: "daily", ms: 86_400_000 },
  "every day": { normalized: "daily", ms: 86_400_000 },
  everyday: { normalized: "daily", ms: 86_400_000 },
  weekly: { normalized: "weekly", ms: 604_800_000 },
  "every week": { normalized: "weekly", ms: 604_800_000 },
};

const TIME_RE =
  /^(?:every morning|each morning|daily|every day|mornings?)?\s*(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;

/**
 * Parse a human schedule string into a normalized form.
 * Throws an Error with a helpful message when the format is unsupported.
 */
export function parseSchedule(input: string): ParsedSchedule {
  const clean = input.trim().toLowerCase().replace(/\s+/g, " ");
  if (!clean) throw new Error("Schedule is empty.");

  const interval = INTERVALS[clean];
  if (interval) {
    return { kind: "interval", normalized: interval.normalized, ms: interval.ms };
  }

  const m = TIME_RE.exec(clean);
  if (m) {
    let hour = parseInt(m[1]!, 10);
    const minute = m[2] ? parseInt(m[2], 10) : 0;
    const meridiem = m[3]?.toLowerCase();
    if (Number.isNaN(hour) || Number.isNaN(minute)) throw new Error(`Bad time in schedule "${input}".`);
    if (minute > 59) throw new Error(`Bad minutes in schedule "${input}".`);
    if (meridiem) {
      if (hour < 1 || hour > 12) throw new Error(`Bad hour in schedule "${input}".`);
      if (meridiem === "pm" && hour !== 12) hour += 12;
      if (meridiem === "am" && hour === 12) hour = 0;
    } else if (hour > 23) {
      throw new Error(`Bad hour in schedule "${input}" — use 0-23 or add am/pm.`);
    }
    const hh = String(hour).padStart(2, "0");
    const mm = String(minute).padStart(2, "0");
    return { kind: "dailyAt", normalized: `daily@${hh}:${mm}`, hour, minute };
  }

  throw new Error(
    `Unsupported schedule "${input}". Try "hourly", "twice daily", "daily", "weekly", or a time like "8am" / "08:00" / "every morning 8am".`,
  );
}

/** True when parseSchedule() accepts the string. */
export function isValidSchedule(input: string): boolean {
  try {
    parseSchedule(input);
    return true;
  } catch {
    return false;
  }
}

/**
 * Compute the next run instant (ISO string) for a parsed schedule,
 * measured from `fromMs` (default: now).
 */
export function computeNextRunAt(parsed: ParsedSchedule, fromMs: number = Date.now()): string {
  if (parsed.kind === "interval") {
    return new Date(fromMs + parsed.ms).toISOString();
  }
  // dailyAt: next occurrence of HH:MM in Asia/Calcutta wall-clock time.
  const istNow = fromMs + IST_OFFSET_MIN * 60_000;
  const dayStart = Math.floor(istNow / 86_400_000) * 86_400_000;
  let target = dayStart + (parsed.hour * 60 + parsed.minute) * 60_000;
  if (target <= istNow) target += 86_400_000; // already passed today → tomorrow
  return new Date(target - IST_OFFSET_MIN * 60_000).toISOString();
}

/** Parse + compute in one step. Throws on invalid input. */
export function nextRunForSchedule(input: string, fromMs: number = Date.now()): string {
  return computeNextRunAt(parseSchedule(input), fromMs);
}

/** Human label for a normalized schedule, e.g. "daily@08:00" → "Daily at 8:00 AM IST". */
export function describeSchedule(normalized: string): string {
  if (normalized === "hourly") return "Every hour";
  if (normalized === "12h") return "Twice daily";
  if (normalized === "daily") return "Daily";
  if (normalized === "weekly") return "Weekly";
  const m = /^daily@(\d{2}):(\d{2})$/.exec(normalized);
  if (m) {
    let h = parseInt(m[1]!, 10);
    const mm = m[2]!;
    const ap = h >= 12 ? "PM" : "AM";
    h = h % 12 === 0 ? 12 : h % 12;
    return `Daily at ${h}:${mm} ${ap} IST`;
  }
  return normalized;
}
