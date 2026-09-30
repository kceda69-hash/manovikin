/**
 * Voice utilities for MANO's barge-in and echo suppression.
 *
 * The Web Speech API can't tell MANO's speaker output apart from the user's
 * voice — both arrive as transcripts. These pure helpers let the chat route
 * decide: is this transcript MANO's own voice echoing back (ignore it), or
 * the user interrupting (barge in: stop talking, listen)?
 */

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "of", "to", "in", "on", "is", "it",
  "i", "you", "we", "for", "with", "as", "at", "by", "be", "are", "was",
]);

/** Normalize text into significant words (lowercased, no punctuation, no filler). */
export function normalizeWords(s: string): string[] {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/^'+|'+$/g, ""))
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

/**
 * Decide whether a mic transcript is MANO's own voice echoing back through
 * the mic. Recognition of speaker audio is inaccurate, so this is fuzzy:
 * the transcript counts as echo when at least half its significant words
 * appear in the text being spoken, or when the compacted transcript is
 * contained in the compacted spoken text.
 */
export function isEchoOfSpeech(transcript: string, spokenText: string): boolean {
  const tWords = normalizeWords(transcript);
  const sWords = normalizeWords(spokenText);
  if (tWords.length === 0 || sWords.length === 0) return false;
  const spoken = new Set(sWords);
  const hits = tWords.filter((w) => spoken.has(w)).length;
  if (hits / tWords.length >= 0.5) return true;
  // Recognition sometimes merges spoken words ("warmtoday" for "warm today").
  // A multi-word transcript — or one long word — contained in the spoken
  // text is a strong echo signal.
  if (tWords.length >= 2 || (tWords.length === 1 && tWords[0].length >= 6)) {
    const compact = (ws: string[]) => ws.join("");
    if (compact(sWords).includes(compact(tWords))) return true;
  }
  return false;
}

const MIC_COMMAND_RE = /\b(stop listening|mic off|microphone off|stop mic)\b/;

/**
 * Standalone interrupt commands: "stop", "shut up", "quiet".
 * While MANO is speaking these interrupt the current utterance only — they
 * do NOT turn the speaker off. Mic commands ("stop listening", "mic off")
 * are excluded; they are handled separately.
 */
export function isInterruptCommand(transcript: string): boolean {
  const t = transcript.toLowerCase().trim();
  if (MIC_COMMAND_RE.test(t)) return false;
  return /\b(shut up|quiet|stop)\b/.test(t);
}
