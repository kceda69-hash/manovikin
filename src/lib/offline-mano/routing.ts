/**
 * Pure routing decision: should a chat message go to the on-device engine
 * or to the cloud API? Kept free of React so it's trivially testable.
 */
import type { OfflineEngineState } from "./engine";

export type ChatRoute = "cloud" | "offline" | "offline-not-ready";

export function decideChatRoute(opts: {
  offlineEnabled: boolean;
  engineState: OfflineEngineState;
}): ChatRoute {
  if (!opts.offlineEnabled) return "cloud";
  if (opts.engineState === "ready") return "offline";
  return "offline-not-ready";
}
