import { createParser } from "eventsource-parser";
import { flushSync } from "react-dom";

type ImageEventPayload =
  | { type: "image_generation.partial_image"; b64_json: string; partial_image_index: number }
  | { type: "image_generation.completed"; b64_json: string }
  | { type: "error"; error: { message: string } };

/**
 * Stream an image from the MANOVIK image route, rendering progressive frames.
 * `onFrame(dataUrl, isFinal)` is called for each frame; partials should be blurred.
 */
export async function streamImage(
  endpoint: string,
  body: Record<string, unknown>,
  onFrame: (dataUrl: string, isFinal: boolean) => void,
  init?: { headers?: Record<string, string>; signal?: AbortSignal },
): Promise<void> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    body: JSON.stringify(body),
    signal: init?.signal,
  });
  if (!res.ok || !res.body) {
    throw new Error(`Image generation failed: ${res.status} ${await res.text().catch(() => "")}`);
  }

  let sawCompleted = false;
  let streamError: string | undefined;
  const parser = createParser({
    onEvent(event) {
      let payload: ImageEventPayload | undefined;
      try {
        payload = JSON.parse(event.data) as ImageEventPayload;
      } catch {
        /* ignore malformed frame */
      }
      if (event.event === "error" || payload?.type === "error") {
        streamError =
          (payload as { error?: { message?: string } } | undefined)?.error?.message ??
          "Image generation failed";
        return;
      }
      if (
        event.event !== "image_generation.partial_image" &&
        event.event !== "image_generation.completed"
      )
        return;
      if (!payload || !("b64_json" in payload) || !payload.b64_json) return;
      const isFinal = event.event === "image_generation.completed";
      flushSync(() => {
        onFrame(`data:image/png;base64,${payload.b64_json}`, isFinal);
      });
      if (isFinal) sawCompleted = true;
    },
  });

  const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      parser.feed(value);
    }
  } finally {
    reader.cancel().catch(() => {});
  }
  if (streamError) throw new Error(streamError);
  if (!sawCompleted) throw new Error("Image stream ended before completion");
}
