import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { isSovereignEndpoint, resolveEndpointModel } from "@/lib/ai-model";

const OLD_ENV = { ...process.env };

beforeEach(() => {
  vi.resetModules();
  process.env = { ...OLD_ENV };
  delete process.env.MANOVIK_AI_BASE_URL;
  delete process.env.MANOVIK_AI_MODEL;
  delete process.env.MANOVIK_AI_MODEL_ID;
});

afterEach(() => {
  process.env = { ...OLD_ENV };
});

describe("resolveEndpointModel", () => {
  it("gateway mode: catalog id passes through unchanged", () => {
    expect(isSovereignEndpoint()).toBe(false);
    expect(resolveEndpointModel("google/gemini-3.7-flash")).toBe("google/gemini-3.7-flash");
    expect(resolveEndpointModel("openai/gpt-5.6-terra")).toBe("openai/gpt-5.6-terra");
  });

  it("sovereign mode: pins to MANOVIK_AI_MODEL", () => {
    process.env.MANOVIK_AI_BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai";
    process.env.MANOVIK_AI_MODEL = "gemini-3.8-flash";
    expect(isSovereignEndpoint()).toBe(true);
    // The 2026-10-06 production 404: "models/google/gemini-3.7-flash is not found".
    expect(resolveEndpointModel("google/gemini-3.7-flash")).toBe("gemini-3.8-flash");
    expect(resolveEndpointModel("openai/gpt-5.6-terra")).toBe("gemini-3.8-flash");
    expect(resolveEndpointModel("gemini-3.8-flash")).toBe("gemini-3.8-flash");
  });

  it("sovereign mode: MANOVIK_AI_MODEL_ID (trained weights) wins", () => {
    process.env.MANOVIK_AI_BASE_URL = "https://example.com/v1";
    process.env.MANOVIK_AI_MODEL = "gemini-3.8-flash";
    process.env.MANOVIK_AI_MODEL_ID = "manovik/mano-1.1";
    expect(resolveEndpointModel("google/gemini-3.7-flash")).toBe("manovik/mano-1.1");
  });

  it("sovereign mode without configured model: strips the provider prefix", () => {
    process.env.MANOVIK_AI_BASE_URL = "https://example.com/v1";
    expect(resolveEndpointModel("google/gemini-3.7-flash")).toBe("gemini-3.7-flash");
    expect(resolveEndpointModel("gemini-3.8-flash")).toBe("gemini-3.8-flash");
  });

  it("sovereign mode with pinToConfigured=false: strips prefix, never pins", () => {
    // Fallback chains use this: retrying the same pinned (possibly
    // overloaded) model would be pointless — fallbacks must differ.
    process.env.MANOVIK_AI_BASE_URL = "https://example.com/v1";
    process.env.MANOVIK_AI_MODEL = "gemini-3.8-flash";
    expect(resolveEndpointModel("google/gemini-3.7-flash", { pinToConfigured: false })).toBe(
      "gemini-3.7-flash",
    );
    expect(resolveEndpointModel("google/gemini-2.5-flash", { pinToConfigured: false })).toBe(
      "gemini-2.5-flash",
    );
  });
});
