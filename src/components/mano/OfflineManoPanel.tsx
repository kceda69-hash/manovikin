/**
 * OfflineManoPanel — model picker + download progress + honest limits for
 * Offline MANO. Rendered inside the chat UI when offline mode is on and the
 * engine isn't ready yet.
 */
import { Download, RotateCcw, WifiOff, X } from "lucide-react";
import { OFFLINE_MODELS, type OfflineModelId } from "@/lib/offline-mano/engine";
import type { UseOfflineMano } from "@/lib/offline-mano/useOfflineMano";
import { Progress } from "@/components/ui/progress";

export function OfflineManoPanel({ mano }: { mano: UseOfflineMano }) {
  if (!mano.enabled || mano.engineState === "ready") return null;
  const pct = Math.round(mano.progress.progress * 100);

  return (
    <div
      className="mx-auto mb-3 max-w-3xl rounded-2xl border border-primary/25 bg-card/80 p-4 backdrop-blur"
      role="status"
      aria-live="polite"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <WifiOff className="h-4 w-4 text-primary" aria-hidden="true" />
          Offline MANO
        </div>
        <button
          type="button"
          onClick={() => mano.setEnabled(false)}
          className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          aria-label="Turn off Offline MANO"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {!mano.webGpu ? (
        <p className="text-sm text-muted-foreground">
          This browser doesn&apos;t support WebGPU, which Offline MANO needs to run the AI on
          your device. Try the latest Chrome or Edge on desktop, or Chrome on Android — or keep
          using cloud MANO.
        </p>
      ) : mano.engineState === "error" ? (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">{mano.error}</p>
          <button
            type="button"
            onClick={mano.retry}
            className="mano-glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:scale-105"
          >
            <RotateCcw className="h-4 w-4" /> Try again
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block text-muted-foreground">On-device model</span>
            <select
              value={mano.modelId}
              disabled={mano.engineState === "loading"}
              onChange={(e) => mano.setModelId(e.target.value as OfflineModelId)}
              className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none"
            >
              {OFFLINE_MODELS.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label} — {m.sizeNote}
                </option>
              ))}
            </select>
          </label>
          {mano.engineState === "loading" ? (
            <div className="space-y-1.5">
              <Progress value={pct} className="h-2" />
              <p className="text-xs text-muted-foreground">
                {mano.progress.text || "Downloading…"} {pct}%
              </p>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => void mano.ensureReady()}
              className="mano-glass inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-medium transition hover:scale-105"
            >
              <Download className="h-4 w-4" /> Download &amp; start
            </button>
          )}
          <p className="text-xs leading-relaxed text-muted-foreground">
            First download needs internet — after that the model is cached and works fully
            offline. Offline MANO is conversation + reasoning only: Gmail, calendar, web search,
            missions, device commands and smart home need the cloud.
          </p>
        </div>
      )}
    </div>
  );
}
