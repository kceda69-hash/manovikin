import { describe, expect, it } from "vitest";
import { VOICE_LANGS, detectVoiceLang, pickVoice, voiceLangLabel } from "../voice-langs";

describe("detectVoiceLang", () => {
  it("detects Hindi (Devanagari)", () => {
    expect(detectVoiceLang("नमस्ते, आप कैसे हैं?")).toBe("hi-IN");
  });
  it("detects Korean (Hangul)", () => {
    expect(detectVoiceLang("안녕하세요")).toBe("ko-KR");
  });
  it("detects Japanese kana before CJK (mixed kanji+kana)", () => {
    expect(detectVoiceLang("日本語を話します")).toBe("ja-JP");
    expect(detectVoiceLang("こんにちは")).toBe("ja-JP");
  });
  it("detects Chinese (pure CJK)", () => {
    expect(detectVoiceLang("你好世界")).toBe("zh-CN");
  });
  it("detects Arabic", () => {
    expect(detectVoiceLang("مرحبا بك")).toBe("ar-SA");
  });
  it("detects Tamil", () => {
    expect(detectVoiceLang("வணக்கம்")).toBe("ta-IN");
  });
  it("detects Telugu", () => {
    expect(detectVoiceLang("నమస్కారం")).toBe("te-IN");
  });
  it("detects Bengali", () => {
    expect(detectVoiceLang("হ্যালো")).toBe("bn-IN");
  });
  it("returns null for Latin-script text (keep current language)", () => {
    expect(detectVoiceLang("hello, how are you?")).toBeNull();
  });
  it("returns null for empty text", () => {
    expect(detectVoiceLang("")).toBeNull();
  });
});

describe("pickVoice", () => {
  const voices = [
    { lang: "en-US", name: "Google US English" },
    { lang: "hi-IN", name: "Google हिन्दी" },
    { lang: "ko-KR", name: "Google 한국어" },
  ];
  it("prefers an exact BCP47 match", () => {
    expect(pickVoice(voices, "hi-IN")?.name).toBe("Google हिन्दी");
  });
  it("falls back to the language subtag", () => {
    expect(pickVoice(voices, "ko")?.name).toBe("Google 한국어");
    expect(pickVoice([{ lang: "hi", name: "Hindi" }], "hi-IN")?.name).toBe("Hindi");
  });
  it("returns null when nothing matches or the list is empty", () => {
    expect(pickVoice(voices, "fr-FR")).toBeNull();
    expect(pickVoice([], "en-US")).toBeNull();
  });
});

describe("VOICE_LANGS", () => {
  it("offers auto-detect plus the required languages", () => {
    const codes = VOICE_LANGS.map((l) => l.code);
    for (const required of [
      "auto",
      "en-US",
      "hi-IN",
      "ko-KR",
      "es-ES",
      "fr-FR",
      "de-DE",
      "pt-BR",
      "ar-SA",
      "ja-JP",
      "zh-CN",
      "ta-IN",
      "te-IN",
      "bn-IN",
    ]) {
      expect(codes).toContain(required);
    }
  });
  it("labels fall back to the code for unknown entries", () => {
    expect(voiceLangLabel("hi-IN")).toContain("Hindi");
    expect(voiceLangLabel("xx-YY")).toBe("xx-YY");
  });
});
