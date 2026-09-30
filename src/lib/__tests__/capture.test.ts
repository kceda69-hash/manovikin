import { describe, expect, it } from "vitest";
import { blobToFile, fitWithin } from "@/lib/capture";

describe("fitWithin", () => {
  it("leaves small frames untouched (never upscales)", () => {
    expect(fitWithin(640, 480, 1280)).toEqual({ w: 640, h: 480 });
  });

  it("downscales a landscape frame so the longest edge equals maxDim", () => {
    expect(fitWithin(3840, 2160, 1280)).toEqual({ w: 1280, h: 720 });
  });

  it("downscales a portrait frame so the longest edge equals maxDim", () => {
    expect(fitWithin(1080, 1920, 1280)).toEqual({ w: 720, h: 1280 });
  });

  it("handles square frames", () => {
    expect(fitWithin(2000, 2000, 1000)).toEqual({ w: 1000, h: 1000 });
  });

  it("returns zeros for invalid input instead of NaN", () => {
    expect(fitWithin(0, 480, 1280)).toEqual({ w: 0, h: 0 });
    expect(fitWithin(640, -5, 1280)).toEqual({ w: 0, h: 0 });
    expect(fitWithin(640, 480, 0)).toEqual({ w: 0, h: 0 });
  });
});

describe("blobToFile", () => {
  it("wraps a blob as a timestamped JPEG file", () => {
    const blob = new Blob(["x"], { type: "image/jpeg" });
    const file = blobToFile(blob, "manovik-camera");
    expect(file).toBeInstanceOf(File);
    expect(file.type).toBe("image/jpeg");
    expect(file.name.startsWith("manovik-camera-")).toBe(true);
    expect(file.name.endsWith(".jpg")).toBe(true);
  });
});
