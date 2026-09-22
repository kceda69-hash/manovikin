/**
 * Multilingual voice support for MANO (Web Speech API).
 *
 * The server already auto-detects the user's language and replies in it —
 * this module covers the voice path only: picking the speech-recognition
 * language and the speech-synthesis voice per utterance.
 *
 * Detection is script-based (no dependencies, no extra model call), mirroring
 * the server's detectLanguage in src/routes/api/chat.ts but returning BCP47
 * tags the Web Speech API expects (e.g. "hi-IN" instead of "hi").
 */

export interface VoiceLangOption {
  /** BCP47 tag for the Web Speech API, or "auto" for auto-detect. */
  code: string;
  label: string;
}

export const VOICE_LANGS: VoiceLangOption[] = [
  { code: "auto", label: "Auto-detect" },
  { code: "en-US", label: "English" },
  { code: "hi-IN", label: "हिन्दी · Hindi" },
  { code: "ko-KR", label: "한국어 · Korean" },
  { code: "es-ES", label: "Español · Spanish" },
  { code: "fr-FR", label: "Français · French" },
  { code: "de-DE", label: "Deutsch · German" },
  { code: "pt-BR", label: "Português · Portuguese" },
  { code: "ar-SA", label: "العربية · Arabic" },
  { code: "ja-JP", label: "日本語 · Japanese" },
  { code: "zh-CN", label: "中文 · Chinese" },
  { code: "ta-IN", label: "தமிழ் · Tamil" },
  { code: "te-IN", label: "తెలుగు · Telugu" },
  { code: "bn-IN", label: "বাংলা · Bengali" },
];

export const VOICE_LANG_STORAGE_KEY = "manovik:voice-lang";

/**
 * Ordered script → BCP47 pairs. Order matters where scripts mix: Japanese
 * kana is checked before CJK ideographs so mixed kanji+kana text detects as
 * Japanese rather than Chinese.
 */
const SCRIPT_LANGS: Array<[RegExp, string]> = [
  [/[\u0900-\u097f]/, "hi-IN"], // Devanagari → Hindi
  [/[\u0980-\u09ff]/, "bn-IN"], // Bengali
  [/[\u0a00-\u0a7f]/, "pa-IN"], // Gurmukhi → Punjabi
  [/[\u0a80-\u0aff]/, "gu-IN"], // Gujarati
  [/[\u0b80-\u0bff]/, "ta-IN"], // Tamil
  [/[\u0c00-\u0c7f]/, "te-IN"], // Telugu
  [/[\u0c80-\u0cff]/, "kn-IN"], // Kannada
  [/[\u0d00-\u0d7f]/, "ml-IN"], // Malayalam
  [/[\u0e00-\u0e7f]/, "th-TH"], // Thai
  [/[\uac00-\ud7af]/, "ko-KR"], // Hangul → Korean
  [/[\u3040-\u309f\u30a0-\u30ff]/, "ja-JP"], // Hiragana/Katakana → Japanese
  [/[\u4e00-\u9fff]/, "zh-CN"], // CJK ideographs → Chinese
  [/[\u0600-\u06ff]/, "ar-SA"], // Arabic
  [/[\u0590-\u05ff]/, "he-IL"], // Hebrew
  [/[\u0400-\u04ff]/, "ru-RU"], // Cyrillic → Russian
];

/**
 * Detect the language of a transcript/reply from its script.
 * Returns a BCP47 tag (e.g. "hi-IN") or null when the text is Latin-script
 * (or empty), meaning "keep the current language".
 */
export function detectVoiceLang(text: string): string | null {
  if (!text) return null;
  for (const [re, lang] of SCRIPT_LANGS) {
    if (re.test(text)) return lang;
  }
  return null;
}

/** Human-readable label for a BCP47 voice code (falls back to the code). */
export function voiceLangLabel(code: string): string {
  return VOICE_LANGS.find((l) => l.code === code)?.label ?? code;
}

/**
 * Pick the best installed speech-synthesis voice for a BCP47 language:
 * exact tag match first, then any voice sharing the language subtag
 * (e.g. "hi" matches "hi-IN"). Returns null when nothing matches — callers
 * should still set utterance.lang so the default voice pronounces correctly.
 */
export function pickVoice<V extends Pick<SpeechSynthesisVoice, "lang">>(
  voices: ReadonlyArray<V>,
  lang: string,
): V | null {
  const target = lang.toLowerCase();
  const base = target.split("-")[0]!;
  return (
    voices.find((v) => v.lang.toLowerCase() === target) ??
    voices.find((v) => {
      const vl = v.lang.toLowerCase();
      return vl === base || vl.startsWith(`${base}-`) || vl.startsWith(`${base}_`);
    }) ??
    null
  );
}
