/**
 * Offline MANO — on-device AI brain powered by WebLLM (@mlc-ai/web-llm).
 *
 * The web-llm package is ONLY ever loaded through a dynamic `import()` below,
 * so it lands in its own lazy chunk and never in the main bundle. Everything
 * here is client-side; offline sessions never touch the server.
 */

export type OfflineModelId = "smollm2-360m" | "qwen2.5-1.5b" | "llama3.2-3b";

export interface OfflineModelDef {
  id: OfflineModelId;
  /** MLC model id used with CreateMLCEngine. */
  mlcModelId: string;
  label: string;
  /** Plain-English download size note shown before first download. */
  sizeNote: string;
  blurb: string;
}

export const OFFLINE_MODELS: OfflineModelDef[] = [
  {
    id: "smollm2-360m",
    mlcModelId: "SmolLM2-360M-Instruct-q4f16_1-MLC",
    label: "SmolLM2 360M",
    sizeNote: "≈ 250 MB download",
    blurb: "Tiny and fast — best for phones and older laptops.",
  },
  {
    id: "qwen2.5-1.5b",
    mlcModelId: "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
    label: "Qwen 2.5 1.5B",
    sizeNote: "≈ 1 GB download",
    blurb: "Balanced — smarter answers and better multilingual chat.",
  },
  {
    id: "llama3.2-3b",
    mlcModelId: "Llama-3.2-3B-Instruct-q4f16_1-MLC",
    label: "Llama 3.2 3B",
    sizeNote: "≈ 2 GB download",
    blurb: "Best quality — needs a decent GPU to feel snappy.",
  },
];

export const DEFAULT_OFFLINE_MODEL: OfflineModelId = "qwen2.5-1.5b";

export function getOfflineModelDef(id: OfflineModelId): OfflineModelDef {
  const def = OFFLINE_MODELS.find((m) => m.id === id);
  if (!def) throw new Error(`Unknown offline model: ${id}`);
  return def;
}

/**
 * MANO's on-device persona. Short and honest: this is the small brain that
 * lives in the browser, not the full cloud MANOVIK.
 */
export const MANO_OFFLINE_SYSTEM_PROMPT = `You are MANO, the on-device brain of MANOVIK AI — think Jarvis running on a pocket arc reactor.

Personality: sharp, warm, a little witty, unfailingly loyal to your user. Address them as "boss" or "sir" now and then, but don't overdo it.

Honest limits (state these plainly if asked, never pretend otherwise):
- You are a small model running entirely in this browser with no internet.
- You can chat, reason, write, explain, plan, and brainstorm.
- You CANNOT reach the cloud: no Gmail, no calendar, no web search, no missions, no device commands, no smart home. If asked for those, say they're unavailable offline and offer to help when the connection is back.
- Keep answers tight and useful. You are small — prefer short, correct answers over long, rambling ones.`;

/** Feature-detect WebGPU. Offline MANO needs it to run the model. */
export function isWebGpuAvailable(): boolean {
  if (typeof navigator === "undefined") return false;
  return !!(navigator as Navigator & { gpu?: unknown }).gpu;
}

export type OfflineEngineState = "idle" | "loading" | "ready" | "error";

export interface OfflineProgress {
  /** 0..1 */
  progress: number;
  text: string;
}

export interface OfflineChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

/** Minimal structural type for the real MLCEngine — tests inject a fake. */
export interface WebLLMEngineLike {
  chat: {
    completions: {
      create: (req: {
        messages: OfflineChatMessage[];
        stream: boolean;
        temperature?: number;
      }) => Promise<AsyncIterable<{ choices?: Array<{ delta?: { content?: string } }> }>>;
    };
  };
}

type CreateMLCEngineFn = (
  modelId: string,
  config?: { initProgressCallback?: (r: { progress: number; text: string }) => void },
) => Promise<WebLLMEngineLike>;

function toPlainError(e: unknown): string {
  if (e instanceof Error && (e as Error & { code?: string }).code === "no-webgpu") {
    return "This browser doesn't support WebGPU, which Offline MANO needs to run the AI on your device. Try the latest Chrome or Edge on desktop, or Chrome on Android.";
  }
  if (e instanceof Error) {
    const msg = e.message || "";
    if (/failed to fetch|network|load/i.test(msg)) {
      return "Couldn't download the model — check your internet connection and try again. (The first download needs internet; after that it works offline.)";
    }
    if (/webgpu|gpu/i.test(msg)) {
      return "Your device's GPU couldn't start the model. Try the smaller SmolLM2 360M model, or use cloud chat instead.";
    }
    return msg;
  }
  return "Something went wrong loading the on-device model. Please try again.";
}

/**
 * State machine around a lazily-created WebLLM engine.
 * idle -> loading -> ready | error. `load()` is idempotent per model.
 */
export class OfflineEngineManager {
  state: OfflineEngineState = "idle";
  progress: OfflineProgress = { progress: 0, text: "" };
  error: string | null = null;
  modelId: OfflineModelId | null = null;

  private engine: WebLLMEngineLike | null = null;
  private loadPromise: Promise<void> | null = null;
  private createFn: CreateMLCEngineFn | null = null;

  /** Test seam: inject a fake CreateMLCEngine instead of dynamic-importing web-llm. */
  __setCreateFn(fn: CreateMLCEngineFn) {
    this.createFn = fn;
  }

  async load(modelId: OfflineModelId, onProgress?: (p: OfflineProgress) => void): Promise<void> {
    if (this.state === "ready" && this.modelId === modelId) return;
    if (this.loadPromise && this.modelId === modelId) return this.loadPromise;
    this.reset();
    this.modelId = modelId;
    this.loadPromise = this.doLoad(modelId, onProgress);
    try {
      await this.loadPromise;
    } finally {
      this.loadPromise = null;
    }
  }

  private async doLoad(
    modelId: OfflineModelId,
    onProgress?: (p: OfflineProgress) => void,
  ): Promise<void> {
    this.state = "loading";
    this.error = null;
    this.progress = { progress: 0, text: "Starting…" };
    onProgress?.(this.progress);
    try {
      if (!isWebGpuAvailable()) {
        const err = new Error("WebGPU unavailable");
        (err as Error & { code?: string }).code = "no-webgpu";
        throw err;
      }
      const create: CreateMLCEngineFn =
        this.createFn ??
        (async (id, config) => {
          // Lazy chunk: web-llm never enters the main bundle.
          const mod = await import("@mlc-ai/web-llm");
          return (await mod.CreateMLCEngine(id, config)) as unknown as WebLLMEngineLike;
        });
      const def = getOfflineModelDef(modelId);
      this.engine = await create(def.mlcModelId, {
        initProgressCallback: (r) => {
          this.progress = { progress: r.progress, text: r.text };
          onProgress?.(this.progress);
        },
      });
      this.state = "ready";
      this.progress = { progress: 1, text: "Ready" };
      onProgress?.(this.progress);
    } catch (e) {
      this.engine = null;
      this.error = toPlainError(e);
      this.state = "error";
      throw e;
    }
  }

  /** Stream assistant tokens for a chat history (system prompt included by caller). */
  async *chat(messages: OfflineChatMessage[]): AsyncGenerator<string, void, void> {
    if (this.state !== "ready" || !this.engine) {
      throw new Error("Offline engine is not ready");
    }
    const chunks = await this.engine.chat.completions.create({
      messages,
      stream: true,
      temperature: 0.7,
    });
    for await (const chunk of chunks) {
      const delta = chunk?.choices?.[0]?.delta?.content;
      if (delta) yield delta;
    }
  }

  reset(): void {
    this.engine = null;
    this.state = "idle";
    this.error = null;
    this.modelId = null;
    this.progress = { progress: 0, text: "" };
    this.loadPromise = null;
  }
}

/** Module-level lazy singleton used by the chat UI. */
let singleton: OfflineEngineManager | null = null;
export function getOfflineEngineManager(): OfflineEngineManager {
  if (!singleton) singleton = new OfflineEngineManager();
  return singleton;
}
