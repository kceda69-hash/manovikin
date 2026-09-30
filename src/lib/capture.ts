/**
 * Capture helpers for MANO's "eyes": camera photos and screen captures
 * taken in the browser, downscaled and encoded as JPEG so they can be
 * attached to a chat message and seen by the vision model.
 */

/** Fit (w, h) inside a maxDim x maxDim box, preserving aspect ratio. Never upscales. */
export function fitWithin(w: number, h: number, maxDim: number): { w: number; h: number } {
  if (w <= 0 || h <= 0 || maxDim <= 0) return { w: 0, h: 0 };
  const scale = Math.min(1, maxDim / Math.max(w, h));
  return { w: Math.round(w * scale), h: Math.round(h * scale) };
}

/**
 * Draw the current frame of a playing <video> element to a canvas and
 * return it as a JPEG blob, downscaled so the longest edge is maxDim.
 * Rejects if the video has no usable frame yet.
 */
export function captureVideoFrame(video: HTMLVideoElement, maxDim = 1280): Promise<Blob> {
  return new Promise((resolve, reject) => {
    try {
      const vw = video.videoWidth;
      const vh = video.videoHeight;
      if (!vw || !vh) {
        reject(new Error("Video has no frames yet — wait for the preview to appear."));
        return;
      }
      const { w, h } = fitWithin(vw, vh, maxDim);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas 2D is not available in this browser."));
        return;
      }
      ctx.drawImage(video, 0, 0, w, h);
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error("Could not encode the captured frame."));
        },
        "image/jpeg",
        0.85,
      );
    } catch (e) {
      reject(e instanceof Error ? e : new Error(String(e)));
    }
  });
}

/** Wrap a blob as a File with a timestamped name. */
export function blobToFile(blob: Blob, prefix: string): File {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  return new File([blob], `${prefix}-${stamp}.jpg`, { type: "image/jpeg" });
}

/** Stop every track of a MediaStream (camera / screen-share cleanup). */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  }
}

/** True when the browser can do camera capture at all. */
export function canUseCamera(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getUserMedia === "function"
  );
}

/** True when the browser can do screen capture at all. */
export function canShareScreen(): boolean {
  return (
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices &&
    typeof navigator.mediaDevices.getDisplayMedia === "function"
  );
}
