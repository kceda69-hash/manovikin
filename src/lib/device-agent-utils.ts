/**
 * Pure helpers for the device agent (Track C): "Hey MANO" hotword detection
 * and Ambient Watch observation analysis. Deliberately DOM/server-free so
 * they are unit-testable and importable from both the client page and the
 * ambient-frame API route.
 */

/** Matches "hey mano" with optional comma/space variants inside a transcript. */
export const HOTWORD_RE = /hey[ ,]*mano/i;

/** True when the transcript contains the "Hey MANO" hotword. */
export function detectHotword(transcript: string): boolean {
  return HOTWORD_RE.test(transcript ?? "");
}

/** Ambient Watch cadence: one camera frame every 5 minutes. */
export const AMBIENT_WATCH_INTERVAL_MS = 300_000;

/** Ambient-frame upload cap: ~2MB JPEGs; larger frames are rejected. */
export const MAX_AMBIENT_FRAME_BYTES = 2 * 1024 * 1024;

/** Longest edge for an ambient-watch frame sent to the vision model. */
export const MAX_AMBIENT_FRAME_DIM = 1280;

/** Vision prompt for ambient frames. Privacy: scene description only —
 *  never names, never facial recognition. */
export const AMBIENT_OBSERVATION_PROMPT =
  "Describe in ONE sentence what is happening in this room/scene. " +
  "Do NOT identify any person (no names, no facial recognition). " +
  "Note anything unusual, e.g. an unfamiliar person at the door, smoke, a spill.";

/**
 * Lowercase phrases that make an ambient-watch observation worth pushing
 * as a `notify` command to the user's devices.
 */
export const NOTABLE_OBSERVATION_KEYWORDS = [
  "unfamiliar person",
  "stranger",
  "intruder",
  "smoke",
  "fire",
  "flame",
  "broken",
  "fallen",
  "spill",
  "leak",
  "flooding",
  "door open",
  "window open",
] as const;

/** True when the observation describes something worth alerting the user about. */
export function isNotableObservation(text: string): boolean {
  const t = (text ?? "").toLowerCase();
  if (!t) return false;
  return NOTABLE_OBSERVATION_KEYWORDS.some((k) => t.includes(k));
}
