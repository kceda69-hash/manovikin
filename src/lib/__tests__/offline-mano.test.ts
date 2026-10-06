/**
 * Tests for Offline MANO (src/lib/offline-mano/).
 *
 * The real @mlc-ai/web-llm module is never loaded: the engine manager accepts
 * an injected CreateMLCEngine fake through __setCreateFn, and WebGPU presence
 * is controlled by stubbing the global navigator.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_OFFLINE_MODEL,
  MANO_OFFLINE_SYSTEM_PROMPT,
  OFFLINE_MODELS,
  OfflineEngineManager,
  getOfflineEngineManager,
  getOfflineModelDef,
  isWebGpuAvailable,
  type OfflineChatMessage,
  type WebLLMEngineLike,
} from "@/lib/offline-mano/engine";
import { decideChatRoute } from "@/lib/offline-mano/routing";

vi.mock("@mlc-ai/web-llm", () => ({
  CreateMLCEngine: vi.fn(),
}));

function withGpu(gpu: unknown) {
  vi.stubGlobal("navigator", gpu === undefined ? {} : { gpu });
}
function withoutNavigator() {
  // Remove the stub entirely so `typeof navigator === "undefined"`.
  vi.unstubAllGlobals();
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** Fake engine streaming the given text chunks as OpenAI-style deltas. */
function fakeEngine(chunks: string[]): WebLLMEngineLike {
  return {
    chat: {
      completions: {
        create: async () => {
          async function* gen() {
            for (const c of chunks) yield { choices: [{ delta: { content: c } }] };
          }
          return gen();
        },
      },
    },
  };
}

/** Fake CreateMLCEngine that reports two progress callbacks, then resolves. */
function fakeCreate(seen: { calls: number; lastModelId?: string }, chunks: string[] = ["hi"]) {
  return async (
    modelId: string,
    config?: { initProgressCallback?: (r: { progress: number; text: string }) => void },
  ): Promise<WebLLMEngineLike> => {
    seen.calls += 1;
    seen.lastModelId = modelId;
    config?.initProgressCallback?.({ progress: 0.25, text: "Fetching model…" });
    config?.initProgressCallback?.({ progress: 0.75, text: "Loading weights…" });
    return fakeEngine(chunks);
  };
}

describe("model registry", () => {
  it("has three models with unique MLC ids", () => {
    expect(OFFLINE_MODELS).toHaveLength(3);
    const ids = OFFLINE_MODELS.map((m) => m.mlcModelId);
    expect(new Set(ids).size).toBe(3);
    for (const m of OFFLINE_MODELS) {
      expect(m.mlcModelId).toMatch(/-MLC$/);
      expect(m.sizeNote.length).toBeGreaterThan(0);
    }
  });

  it("defaults to Qwen 2.5 1.5B", () => {
    expect(DEFAULT_OFFLINE_MODEL).toBe("qwen2.5-1.5b");
    expect(getOfflineModelDef(DEFAULT_OFFLINE_MODEL).mlcModelId).toContain("Qwen2.5-1.5B-Instruct");
  });

  it("maps each logical id to a plausible MLC model id", () => {
    expect(getOfflineModelDef("smollm2-360m").mlcModelId).toContain("SmolLM2-360M-Instruct");
    expect(getOfflineModelDef("llama3.2-3b").mlcModelId).toContain("Llama-3.2-3B-Instruct");
  });

  it("throws on unknown model id", () => {
    expect(() => getOfflineModelDef("gpt-99" as never)).toThrow(/Unknown offline model/);
  });

  it("system prompt is honest about offline limits", () => {
    expect(MANO_OFFLINE_SYSTEM_PROMPT).toMatch(/no internet/i);
    expect(MANO_OFFLINE_SYSTEM_PROMPT).toMatch(/Gmail/i);
  });
});

describe("isWebGpuAvailable", () => {
  it("is false when navigator is undefined", () => {
    withoutNavigator();
    expect(isWebGpuAvailable()).toBe(false);
  });

  it("is false when navigator.gpu is missing", () => {
    withGpu(undefined);
    expect(isWebGpuAvailable()).toBe(false);
  });

  it("is true when navigator.gpu exists", () => {
    withGpu({});
    expect(isWebGpuAvailable()).toBe(true);
  });
});

describe("OfflineEngineManager state machine", () => {
  it("starts idle", () => {
    const m = new OfflineEngineManager();
    expect(m.state).toBe("idle");
    expect(m.error).toBeNull();
  });

  it("goes idle -> loading -> ready on success", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    const seen: { calls: number; lastModelId?: string } = { calls: 0 };
    m.__setCreateFn(fakeCreate(seen));
    const p = m.load("qwen2.5-1.5b");
    expect(m.state).toBe("loading");
    await p;
    expect(m.state).toBe("ready");
    expect(m.error).toBeNull();
    expect(m.modelId).toBe("qwen2.5-1.5b");
    expect(seen.calls).toBe(1);
    expect(seen.lastModelId).toBe("Qwen2.5-1.5B-Instruct-q4f16_1-MLC");
  });

  it("wires initProgressCallback through to load()'s onProgress", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    const seen: { calls: number; lastModelId?: string } = { calls: 0 };
    m.__setCreateFn(fakeCreate(seen));
    const reports: number[] = [];
    await m.load("smollm2-360m", (p) => reports.push(p.progress));
    expect(reports).toContain(0.25);
    expect(reports).toContain(0.75);
    expect(m.progress.progress).toBe(1);
  });

  it("load() is idempotent for the same model", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    const seen: { calls: number; lastModelId?: string } = { calls: 0 };
    m.__setCreateFn(fakeCreate(seen));
    await m.load("qwen2.5-1.5b");
    await m.load("qwen2.5-1.5b");
    expect(seen.calls).toBe(1);
  });

  it("goes to error with a plain-English message when WebGPU is missing", async () => {
    withGpu(undefined);
    const m = new OfflineEngineManager();
    const seen: { calls: number; lastModelId?: string } = { calls: 0 };
    m.__setCreateFn(fakeCreate(seen));
    await expect(m.load("qwen2.5-1.5b")).rejects.toThrow();
    expect(m.state).toBe("error");
    expect(m.error).toMatch(/WebGPU/i);
    expect(seen.calls).toBe(0);
  });

  it("goes to error with a helpful message when the download fails", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    m.__setCreateFn(async () => {
      throw new Error("failed to fetch model weights");
    });
    await expect(m.load("qwen2.5-1.5b")).rejects.toThrow();
    expect(m.state).toBe("error");
    expect(m.error).toMatch(/internet/i);
  });

  it("reset() returns to idle", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    const seen: { calls: number; lastModelId?: string } = { calls: 0 };
    m.__setCreateFn(fakeCreate(seen));
    await m.load("qwen2.5-1.5b");
    m.reset();
    expect(m.state).toBe("idle");
    expect(m.modelId).toBeNull();
    expect(m.error).toBeNull();
  });

  it("chat() throws before ready", async () => {
    const m = new OfflineEngineManager();
    await expect(m.chat([{ role: "user", content: "hi" }]).next()).rejects.toThrow(/not ready/);
  });

  it("chat() streams token deltas when ready", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    const seen: { calls: number; lastModelId?: string } = { calls: 0 };
    m.__setCreateFn(fakeCreate(seen, ["Hello", " ", "boss"]));
    await m.load("smollm2-360m");
    let out = "";
    for await (const delta of m.chat([{ role: "user", content: "hi" }])) out += delta;
    expect(out).toBe("Hello boss");
  });

  it("chat() sends the provided history through", async () => {
    withGpu({});
    const m = new OfflineEngineManager();
    let captured: OfflineChatMessage[] | null = null;
    m.__setCreateFn(async () => ({
      chat: {
        completions: {
          create: async (req: { messages: OfflineChatMessage[] }) => {
            captured = req.messages;
            async function* gen() {
              yield { choices: [{ delta: { content: "ok" } }] };
            }
            return gen();
          },
        },
      },
    }));
    await m.load("qwen2.5-1.5b");
    const history: OfflineChatMessage[] = [
      { role: "system", content: "sys" },
      { role: "user", content: "2+2?" },
    ];
    for await (const _ of m.chat(history)) {
      /* drain */
    }
    expect(captured).toEqual(history);
  });
});

describe("singleton", () => {
  it("returns the same manager", () => {
    expect(getOfflineEngineManager()).toBe(getOfflineEngineManager());
  });
});

describe("decideChatRoute", () => {
  it("routes to cloud when offline mode is off", () => {
    expect(decideChatRoute({ offlineEnabled: false, engineState: "ready" })).toBe("cloud");
    expect(decideChatRoute({ offlineEnabled: false, engineState: "idle" })).toBe("cloud");
  });

  it("routes to offline when enabled and engine is ready", () => {
    expect(decideChatRoute({ offlineEnabled: true, engineState: "ready" })).toBe("offline");
  });

  it("reports offline-not-ready when enabled but engine is not ready", () => {
    for (const s of ["idle", "loading", "error"] as const) {
      expect(decideChatRoute({ offlineEnabled: true, engineState: s })).toBe("offline-not-ready");
    }
  });
});
