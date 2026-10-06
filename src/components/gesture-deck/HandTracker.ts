// On-device hand tracking for the Gesture Deck via MediaPipe Tasks Vision.
// Everything runs locally in the browser: the camera feed is analyzed
// on-device and no video ever leaves the machine.
//
// This module is intentionally UI-free: it drives a <video> element you pass
// in and reports normalized landmarks (mirrored for selfie view) through a
// callback. Camera permission UX lives in CameraView.tsx.
import { mirrorX, type Vec2 } from "@/lib/gesture/hand-gestures";

type VisionModule = typeof import("@mediapipe/tasks-vision");
type HandLandmarkerInstance = Awaited<
  ReturnType<VisionModule["HandLandmarker"]["createFromOptions"]>
>;

export type CameraState =
  | "idle"
  | "requesting"
  | "active"
  | "denied"
  | "unavailable"
  | "error";

export interface HandTrackerCallbacks {
  onLandmarks: (landmarks: Vec2[] | null) => void;
  onStateChange: (state: CameraState, detail?: string) => void;
}

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.0.1/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

/** Camera requires a secure context: HTTPS or localhost. */
export function cameraRequiresHttps(): boolean {
  if (typeof window === "undefined") return false;
  const { protocol, hostname } = window.location;
  return protocol !== "https:" && hostname !== "localhost" && hostname !== "127.0.0.1";
}

export class HandTracker {
  private video: HTMLVideoElement;
  private cb: HandTrackerCallbacks;
  private landmarker: HandLandmarkerInstance | null = null;
  private stream: MediaStream | null = null;
  private rafId = 0;
  private lastVideoTime = -1;
  private running = false;

  constructor(video: HTMLVideoElement, cb: HandTrackerCallbacks) {
    this.video = video;
    this.cb = cb;
  }

  /** Request the camera, load the model, and start the detection loop. */
  async start(): Promise<void> {
    if (this.running) return;
    this.cb.onStateChange("requesting");

    if (cameraRequiresHttps()) {
      this.cb.onStateChange(
        "unavailable",
        "Camera needs HTTPS (or localhost). Open this page over HTTPS to use hand tracking.",
      );
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      this.cb.onStateChange("unavailable", "This browser does not expose a camera API.");
      return;
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" },
        audio: false,
      });
    } catch (e) {
      const name = e instanceof Error ? e.name : "";
      if (name === "NotAllowedError" || name === "SecurityError") {
        this.cb.onStateChange(
          "denied",
          "Camera access was denied. Re-enable it in the browser site settings, or use pointer mode.",
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        this.cb.onStateChange("unavailable", "No camera was found on this device.");
      } else {
        this.cb.onStateChange("error", e instanceof Error ? e.message : "Could not start the camera.");
      }
      return;
    }

    try {
      const vision: VisionModule = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);
      this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 1,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5,
      });
    } catch (e) {
      this.stopStream();
      this.cb.onStateChange(
        "error",
        `Could not load the hand-tracking model: ${e instanceof Error ? e.message : "network error"}`,
      );
      return;
    }

    this.video.srcObject = this.stream;
    this.video.muted = true;
    this.video.playsInline = true;
    try {
      await this.video.play();
    } catch {
      // play() can reject if the element is not visible yet; the loop still works
    }

    this.running = true;
    this.cb.onStateChange("active");
    this.loop();
  }

  private loop = (): void => {
    if (!this.running) return;
    this.rafId = requestAnimationFrame(this.loop);
    const lm = this.landmarker;
    const video = this.video;
    if (!lm || video.readyState < 2 || video.videoWidth === 0) return;
    // detectForVideo needs a new frame each call.
    if (video.currentTime === this.lastVideoTime) return;
    this.lastVideoTime = video.currentTime;
    try {
      const result = lm.detectForVideo(video, performance.now());
      const hand = result.landmarks?.[0] ?? null;
      if (!hand) {
        this.cb.onLandmarks(null);
        return;
      }
      // Mirror horizontally so the cursor follows the hand like a mirror.
      this.cb.onLandmarks(hand.map((p) => mirrorX({ x: p.x, y: p.y })));
    } catch {
      // A single failed frame must not kill the loop.
    }
  };

  private stopStream(): void {
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    if (this.video.srcObject) this.video.srcObject = null;
  }

  stop(): void {
    this.running = false;
    cancelAnimationFrame(this.rafId);
    try {
      this.landmarker?.close();
    } catch {
      // ignore
    }
    this.landmarker = null;
    this.stopStream();
    this.lastVideoTime = -1;
  }
}
