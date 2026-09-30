import { describe, expect, it } from "vitest";
import {
  clampPanelPos,
  parseLayout,
  serializeLayout,
  tiltAngles,
  MAX_TILT_DEG,
  type HoloLayout,
} from "../../routes/holo";

const DEFAULTS: HoloLayout = {
  briefing: { x: 16, y: 76 },
  devices: { x: 16, y: 420 },
};

describe("clampPanelPos", () => {
  const PW = 304;
  const PH = 240;
  const VW = 800;
  const VH = 600;

  it("leaves an in-bounds position untouched", () => {
    expect(clampPanelPos(100, 100, PW, PH, VW, VH)).toEqual({ x: 100, y: 100 });
  });

  it("clamps negative coordinates to 0", () => {
    expect(clampPanelPos(-50, -80, PW, PH, VW, VH)).toEqual({ x: 0, y: 0 });
  });

  it("clamps coordinates so the panel never leaves the viewport", () => {
    expect(clampPanelPos(700, 500, PW, PH, VW, VH)).toEqual({
      x: VW - PW,
      y: VH - PH,
    });
  });

  it("keeps a panel partially visible when the viewport is smaller than the panel", () => {
    expect(clampPanelPos(50, 50, PW, PH, 200, 200)).toEqual({ x: 0, y: 0 });
  });
});

describe("serializeLayout / parseLayout", () => {
  it("round-trips a layout through JSON", () => {
    const layout: HoloLayout = {
      briefing: { x: 10, y: 20 },
      devices: { x: 340, y: 500 },
    };
    expect(parseLayout(serializeLayout(layout), {})).toEqual(layout);
  });

  it("falls back to defaults on corrupt JSON", () => {
    expect(parseLayout("not-json{{{", DEFAULTS)).toEqual(DEFAULTS);
    expect(parseLayout("{{broken", DEFAULTS)).toEqual(DEFAULTS);
  });

  it("falls back to defaults on null / undefined / empty input", () => {
    expect(parseLayout(null, DEFAULTS)).toEqual(DEFAULTS);
    expect(parseLayout(undefined, DEFAULTS)).toEqual(DEFAULTS);
    expect(parseLayout("", DEFAULTS)).toEqual(DEFAULTS);
  });

  it("falls back to defaults for non-object payloads", () => {
    expect(parseLayout("[1,2,3]", DEFAULTS)).toEqual(DEFAULTS);
    expect(parseLayout('"just a string"', DEFAULTS)).toEqual(DEFAULTS);
    expect(parseLayout("42", DEFAULTS)).toEqual(DEFAULTS);
  });

  it("ignores malformed entries but keeps the valid ones", () => {
    const raw = JSON.stringify({
      briefing: { x: 10, y: 20 },
      devices: { x: "nope", y: 5 },
      camera: null,
      voice: { x: 1 },
    });
    expect(parseLayout(raw, DEFAULTS)).toEqual({
      briefing: { x: 10, y: 20 },
      devices: { x: 16, y: 420 },
    });
  });

  it("rejects non-finite coordinates", () => {
    const raw = JSON.stringify({ briefing: { x: Infinity, y: 20 } });
    expect(parseLayout(raw, DEFAULTS)).toEqual(DEFAULTS);
  });
});

describe("tiltAngles", () => {
  const rect = { left: 100, top: 100, width: 300, height: 200 };

  it("returns zero tilt at the exact center", () => {
    expect(tiltAngles(250, 200, rect)).toEqual({ rotateX: -0, rotateY: 0 });
  });

  it("caps at ±8deg in the corners", () => {
    const topLeft = tiltAngles(100, 100, rect);
    expect(topLeft.rotateX).toBeCloseTo(MAX_TILT_DEG, 10);
    expect(topLeft.rotateY).toBeCloseTo(-MAX_TILT_DEG, 10);

    const bottomRight = tiltAngles(400, 300, rect);
    expect(bottomRight.rotateX).toBeCloseTo(-MAX_TILT_DEG, 10);
    expect(bottomRight.rotateY).toBeCloseTo(MAX_TILT_DEG, 10);
  });

  it("never exceeds the cap even when the pointer is outside the rect", () => {
    const t = tiltAngles(-1000, 5000, rect);
    expect(Math.abs(t.rotateX)).toBeLessThanOrEqual(MAX_TILT_DEG);
    expect(Math.abs(t.rotateY)).toBeLessThanOrEqual(MAX_TILT_DEG);
  });

  it("respects a custom max tilt", () => {
    const t = tiltAngles(400, 300, rect, 4);
    expect(Math.abs(t.rotateX)).toBeLessThanOrEqual(4);
    expect(Math.abs(t.rotateY)).toBeLessThanOrEqual(4);
  });

  it("returns zero tilt for a degenerate rect", () => {
    expect(tiltAngles(250, 200, { left: 0, top: 0, width: 0, height: 0 })).toEqual({
      rotateX: 0,
      rotateY: 0,
    });
  });

  it("tilts the top edge backward and the left edge left", () => {
    const top = tiltAngles(250, 100, rect);
    expect(top.rotateX).toBeGreaterThan(0); // top of panel tips away
    expect(top.rotateY).toBe(0);

    const left = tiltAngles(100, 200, rect);
    expect(left.rotateY).toBeLessThan(0); // left edge tips away
    expect(left.rotateX).toBe(-0);
  });
});
