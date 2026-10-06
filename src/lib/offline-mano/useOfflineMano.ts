/**
 * useOfflineMano — React binding for the on-device engine.
 *
 * Owns: offline toggle state, selected model (persisted), engine state
 * machine sync, download progress, plain-English errors, and the streaming
 * flag. Message list ownership stays with the chat page (it passes its
 * setMessages-style updater in).
 */
import { useCallback, useEffect, useRef, useState } from "react";
import {
  DEFAULT_OFFLINE_MODEL,
  MANO_OFFLINE_SYSTEM_PROMPT,
  getOfflineEngineManager,
  isWebGpuAvailable,
  type OfflineChatMessage,
  type OfflineEngineState,
  type OfflineModelId,
  type OfflineProgress,
} from "./engine";

const MODEL_STORAGE_KEY = "manovik-offline-model";

function loadStoredModel(): OfflineModelId {
  try {
    const v = localStorage.getItem(MODEL_STORAGE_KEY);
    if (v === "smollm2-360m" || v === "qwen2.5-1.5b" || v === "llama3.2-3b") return v;
  } catch {
    /* storage unavailable — fall through */
  }
  return DEFAULT_OFFLINE_MODEL;
}

export function useOfflineMano() {
  const [enabled, setEnabled] = useState(false);
  const [modelId, setModelIdState] = useState<OfflineModelId>(loadStoredModel);
  const [engineState, setEngineState] = useState<OfflineEngineState>("idle");
  const [progress, setProgress] = useState<OfflineProgress>({ progress: 0, text: "" });
  const [error, setError] = useState<string | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [webGpu] = useState(isWebGpuAvailable);
  const managerRef = useRef(getOfflineEngineManager());
  const onlineNudgeShownRef = useRef(false);

  const syncFromManager = useCallback(() => {
    const m = managerRef.current;
    setEngineState(m.state);
    setProgress({ ...m.progress });
    setError(m.error);
  }, []);

  const setModelId = useCallback(
    (id: OfflineModelId) => {
      setModelIdState(id);
      try {
        localStorage.setItem(MODEL_STORAGE_KEY, id);
      } catch {
        /* ignore */
      }
      // Switching models drops the loaded engine; it reloads on next enable/send.
      managerRef.current.reset();
      syncFromManager();
    },
    [syncFromManager],
  );

  /** Ensure the engine is loaded (downloads the model on first use). */
  const ensureReady = useCallback(async (): Promise<boolean> => {
    const m = managerRef.current;
    if (m.state === "ready" && m.modelId === modelId) {
      syncFromManager();
      return true;
    }
    try {
      await m.load(modelId, (p) => setProgress({ ...p }));
      syncFromManager();
      return true;
    } catch {
      syncFromManager();
      return false;
    }
  }, [modelId, syncFromManager]);

  /**
   * Stream an offline reply. `history` is the plain-text conversation so far
   * (user+assistant turns, oldest first). `onToken` receives text deltas;
   * the caller owns message-list updates.
   */
  const chat = useCallback(
    async (history: OfflineChatMessage[], onToken: (delta: string) => void): Promise<void> => {
      const ok = await ensureReady();
      if (!ok) throw new Error(managerRef.current.error ?? "Offline engine failed to load");
      setStreaming(true);
      try {
        const full: OfflineChatMessage[] = [
          { role: "system", content: MANO_OFFLINE_SYSTEM_PROMPT },
          ...history,
        ];
        for await (const delta of managerRef.current.chat(full)) {
          onToken(delta);
        }
      } finally {
        setStreaming(false);
      }
    },
    [ensureReady],
  );

  const retry = useCallback(() => {
    managerRef.current.reset();
    syncFromManager();
    void ensureReady();
  }, [ensureReady, syncFromManager]);

  // Kick off the download as soon as offline mode is switched on.
  useEffect(() => {
    if (enabled) void ensureReady();
  }, [enabled, ensureReady]);

  return {
    enabled,
    setEnabled,
    modelId,
    setModelId,
    engineState,
    progress,
    error,
    streaming,
    webGpu,
    ensureReady,
    chat,
    retry,
    onlineNudgeShownRef,
  };
}

export type UseOfflineMano = ReturnType<typeof useOfflineMano>;
