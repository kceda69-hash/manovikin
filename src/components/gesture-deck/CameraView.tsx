// Camera permission UX for the Gesture Deck.
// The video element is rendered here; the HandTracker drives it. All hand
// tracking runs on-device — video never leaves the browser.
import { useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Loader2, ShieldCheck } from "lucide-react";
import { HandTracker, cameraRequiresHttps, type CameraState } from "./HandTracker";
import type { Vec2 } from "@/lib/gesture/hand-gestures";

interface CameraViewProps {
  /** Called with mirrored normalized landmarks (or null when no hand). */
  onLandmarks: (landmarks: Vec2[] | null) => void;
  onStateChange?: (state: CameraState) => void;
  /** When false the camera is stopped and the view collapses to a chip. */
  enabled: boolean;
}

export function CameraView({ onLandmarks, onStateChange, enabled }: CameraViewProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const trackerRef = useRef<HandTracker | null>(null);
  const landmarksRef = useRef(onLandmarks);
  landmarksRef.current = onLandmarks;
  const [state, setState] = useState<CameraState>("idle");
  const [detail, setDetail] = useState<string>("");

  const setCameraState = (s: CameraState, d?: string) => {
    setState(s);
    setDetail(d ?? "");
    onStateChange?.(s);
  };

  useEffect(() => {
    if (!enabled) {
      trackerRef.current?.stop();
      trackerRef.current = null;
      setCameraState("idle");
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    const tracker = new HandTracker(video, {
      onLandmarks: (lm) => landmarksRef.current(lm),
      onStateChange: (s, d) => setCameraState(s, d),
    });
    trackerRef.current = tracker;
    // Auto-start when the view mounts with enabled=true. Browsers allow
    // getUserMedia without a user gesture; if one is ever required the
    // "error" state surfaces a retry button.
    void tracker.start();
    return () => {
      tracker.stop();
      trackerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  const retry = () => {
    trackerRef.current?.stop();
    const video = videoRef.current;
    if (!video) return;
    const tracker = new HandTracker(video, {
      onLandmarks: (lm) => landmarksRef.current(lm),
      onStateChange: (s, d) => setCameraState(s, d),
    });
    trackerRef.current = tracker;
    void tracker.start();
  };

  if (!enabled) return null;

  return (
    <div className="gd-camera" data-state={state}>
      <video ref={videoRef} className="gd-camera-video" muted playsInline aria-label="Camera preview for hand tracking" />
      {state === "idle" || state === "requesting" ? (
        <div className="gd-camera-overlay">
          <Loader2 className="gd-spin" size={28} />
          <p>Starting camera…</p>
          <p className="gd-camera-note">
            <ShieldCheck size={14} /> On-device hand tracking — video never leaves this browser.
          </p>
        </div>
      ) : null}
      {state === "denied" || state === "unavailable" || state === "error" ? (
        <div className="gd-camera-overlay gd-camera-blocked">
          {state === "denied" ? <CameraOff size={28} /> : <Camera size={28} />}
          <p className="gd-camera-title">
            {state === "denied" ? "Camera access denied" : state === "unavailable" ? "No camera available" : "Camera error"}
          </p>
          <p className="gd-camera-note">{detail || "Switch to pointer mode to use the deck without a camera."}</p>
          {cameraRequiresHttps() ? null : (
            <button type="button" className="gd-btn" onClick={retry}>
              Try again
            </button>
          )}
        </div>
      ) : null}
      {state === "active" ? <div className="gd-camera-live" title="Hand tracking active" /> : null}
    </div>
  );
}
