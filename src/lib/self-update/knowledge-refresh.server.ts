// Server-only knowledge refresh for the MANOVIK self-update engine.
//
// Takes tech-radar items and:
//   1. Dedupes them against recently recorded brain updates.
//   2. Writes the genuinely new ones into manovik_brain_updates
//      (global brain table: version, notes, metadata).
//   3. Distills durable, rule-based learnings from the items.
//   4. Exposes appendLearningsToUserLessons() so the same learnings can be
//      folded into the user-scoped AGI lessons system (manovik_agi_lessons,
//      see src/lib/mano/training.server.ts) with dedupe — the global hook
//      has no user context, so it stores learnings in the brain row and
//      leaves per-user folding to a future user-scoped caller.

import { dedupeRadarItems, radarItemKey, type RadarItem } from "./tech-radar.server";
import { sanitizeFetchedText } from "@/lib/dossier/dossier.server";

/** Minimal DB surface so tests can inject a fake. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RefreshDb = { from(table: string): any };

export interface Learning {
  topic: string;
  lesson: string;
}

// ---------------------------------------------------------------------------
// Distillation — pure, rule-based, deterministic (no model call, no cost).
// ---------------------------------------------------------------------------

/**
 * Turn radar items into durable lesson candidates. Rule-based on purpose:
 * the self-update hook must be cheap and predictable; the lessons are
 * short, actionable, and phrased as guidance, never as instructions.
 */
export function distillLearnings(items: RadarItem[]): Learning[] {
  const learnings: Learning[] = [];
  const seen = new Set<string>();
  const push = (topic: string, lesson: string) => {
    const clean = sanitizeFetchedText(lesson, 300).trim();
    if (!clean) return;
    const key = `${topic}|${clean.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    learnings.push({ topic, lesson: clean });
  };

  for (const item of items) {
    if (item.category === "security") {
      push(
        "security",
        `New advisory ${item.title}: review whether the stack is exposed and patch promptly. ${item.detail.slice(0, 160)}`,
      );
    } else if (item.category === "model") {
      push(
        "models",
        `${item.title} — new model on the radar. Evaluate it against the current model roster for quality/cost before adopting.`,
      );
    } else {
      push("tech", `Tech signal: ${item.title}. Watch for product or ecosystem implications.`);
    }
  }
  return learnings;
}

// ---------------------------------------------------------------------------
// Brain updates — global, matches the existing table shape.
// ---------------------------------------------------------------------------

export interface RefreshSummary {
  version: string;
  newItems: number;
  totalItems: number;
  learnings: Learning[];
  inserted: boolean;
}

interface BrainRow {
  metadata?: unknown;
}

/** Collect radar-item keys already recorded in recent brain_updates rows. */
async function loadSeenKeys(db: RefreshDb, limit = 10): Promise<Set<string>> {
  const seen = new Set<string>();
  try {
    const { data, error } = await db
      .from("manovik_brain_updates")
      .select("metadata")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return seen;
    for (const row of data as BrainRow[]) {
      const meta = row.metadata as { items?: Array<{ key?: unknown }> } | null;
      for (const it of meta?.items ?? []) {
        if (typeof it?.key === "string") seen.add(it.key);
      }
    }
  } catch {
    // Fail open on the read: worst case we record a duplicate row.
  }
  return seen;
}

/**
 * Dedupe radar items against recent brain updates and persist the new ones.
 * Never throws — callers decide how to surface failures.
 */
export async function refreshKnowledge(db: RefreshDb, items: RadarItem[]): Promise<RefreshSummary> {
  const version = `brain-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
  const seenKeys = await loadSeenKeys(db);
  const fresh = dedupeRadarItems(items, seenKeys);
  const learnings = distillLearnings(fresh);

  const summary: RefreshSummary = {
    version,
    newItems: fresh.length,
    totalItems: items.length,
    learnings,
    inserted: false,
  };
  if (fresh.length === 0) return summary;

  const byCategory = (c: RadarItem["category"]) => fresh.filter((i) => i.category === c).length;
  const notesLines = [
    `MANOVIK Brain self-update — ${fresh.length} new signal${fresh.length === 1 ? "" : "s"}.`,
    `- ${byCategory("model")} new model release${byCategory("model") === 1 ? "" : "s"}`,
    `- ${byCategory("security")} security advisor${byCategory("security") === 1 ? "y" : "ies"}`,
    `- ${byCategory("tech")} tech headline${byCategory("tech") === 1 ? "" : "s"}`,
    ...learnings.slice(0, 12).map((l) => `• [${l.topic}] ${l.lesson}`),
  ];

  const { error } = await db.from("manovik_brain_updates").insert({
    version,
    notes: notesLines.join("\n"),
    metadata: {
      source: "self-update",
      runtime: "edge",
      itemCount: fresh.length,
      items: fresh.map((i) => ({ ...i, key: radarItemKey(i) })),
      learnings,
    },
  });
  if (error) throw new Error(error.message ?? "brain_updates insert failed");
  summary.inserted = true;
  return summary;
}

// ---------------------------------------------------------------------------
// User-scoped lessons — appends to manovik_agi_lessons with dedupe.
// ---------------------------------------------------------------------------

/**
 * Fold learnings into a user's AGI lessons (the system in
 * src/lib/mano/training.server.ts). Skips anything whose normalized
 * topic+lesson already appears in the user's recent lessons. Exported for
 * future user-scoped callers; the global hook has no user to attach to.
 */
export async function appendLearningsToUserLessons(
  db: RefreshDb,
  userId: string,
  learnings: Learning[],
): Promise<{ appended: number; skipped: number }> {
  let appended = 0;
  let skipped = 0;
  let existing = new Set<string>();
  try {
    const { data, error } = await db
      .from("manovik_agi_lessons")
      .select("topic, lesson")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (!error && data) {
      existing = new Set(
        (data as Array<{ topic?: unknown; lesson?: unknown }>).map(
          (r) =>
            `${String(r.topic ?? "").toLowerCase().trim()}|${String(r.lesson ?? "").toLowerCase().trim()}`,
        ),
      );
    }
  } catch {
    // Fail open on the read; inserts below still dedupe in-memory.
  }

  const seenBatch = new Set<string>();
  for (const l of learnings) {
    const key = `${l.topic.toLowerCase().trim()}|${l.lesson.toLowerCase().trim()}`;
    if (existing.has(key) || seenBatch.has(key)) {
      skipped += 1;
      continue;
    }
    seenBatch.add(key);
    const { error } = await db
      .from("manovik_agi_lessons")
      .insert({ user_id: userId, topic: l.topic, lesson: l.lesson });
    if (error) throw new Error(error.message ?? "agi_lessons insert failed");
    appended += 1;
  }
  return { appended, skipped };
}
