// Unit tests for the pure gesture-recognition module.
// Synthetic 21-landmark hands are fed to GestureTracker with explicit
// timestamps, so every state transition is deterministic.
import { describe, expect, it } from "vitest";
import {
  DOUBLE_TAP_MAX_DIST,
  DOUBLE_TAP_WINDOW_MS,
  GestureTracker,
  HAND_LANDMARK_COUNT,
  INDEX_PIP,
  INDEX_TIP,
  MIDDLE_PIP,
  MIDDLE_TIP,
  PALM_HOLD_MS,
  PINKY_PIP,
  PINKY_TIP,
  PINCH_ENTER,
  RING_PIP,
  RING_TIP,
  TAP_MAX_MS,
  THUMB_TIP,
  dist,
  extendedFingerCount,
  indexTip,
  isFingerExtended,
  isOpenPalm,
  isPinching,
  mirrorX,
  pinchDistance,
  smoothPoint,
  type GestureEvent,
  type Vec2,
} from "../hand-gestures";

function blankHand(): Vec2[] {
  return Array.from({ length: HAND_LANDMARK_COUNT }, () => ({ x: 0.5, y: 0.5 }));
}

/** Relaxed open hand, palm facing camera, fingers up. */
function openHand(): Vec2[] {
  const lm = blankHand();
  lm[THUMB_TIP] = { x: 0.35, y: 0.5 };
  lm[INDEX_TIP] = { x: 0.45, y: 0.2 };
  lm[INDEX_PIP] = { x: 0.45, y: 0.4 };
  lm[MIDDLE_TIP] = { x: 0.5, y: 0.18 };
  lm[MIDDLE_PIP] = { x: 0.5, y: 0.4 };
  lm[RING_TIP] = { x: 0.55, y: 0.2 };
  lm[RING_PIP] = { x: 0.55, y: 0.4 };
  lm[PINKY_TIP] = { x: 0.6, y: 0.25 };
  lm[PINKY_PIP] = { x: 0.6, y: 0.42 };
  return lm;
}

/** Pinch: thumb tip moved onto the index tip. */
function pinchHand(): Vec2[] {
  const lm = openHand();
  lm[THUMB_TIP] = { x: lm[INDEX_TIP].x + 0.01, y: lm[INDEX_TIP].y + 0.01 };
  return lm;
}

/** Fist: all fingertips curled below their PIP joints. */
function fistHand(): Vec2[] {
  const lm = openHand();
  for (const [tip, pip] of [
    [INDEX_TIP, INDEX_PIP],
    [MIDDLE_TIP, MIDDLE_PIP],
    [RING_TIP, RING_PIP],
    [PINKY_TIP, PINKY_PIP],
  ] as const) {
    lm[tip] = { x: lm[pip].x, y: lm[pip].y + 0.1 };
  }
  return lm;
}

function moveIndexTip(lm: Vec2[], x: number, y: number): Vec2[] {
  const next = lm.map((p) => ({ ...p }));
  next[INDEX_TIP] = { x, y };
  return next;
}

/** Move the whole pinch (thumb tip follows the index tip) to a new spot. */
function movePinch(lm: Vec2[], x: number, y: number): Vec2[] {
  const next = lm.map((p) => ({ ...p }));
  next[INDEX_TIP] = { x, y };
  next[THUMB_TIP] = { x: x + 0.01, y: y + 0.01 };
  return next;
}

function eventTypes(events: GestureEvent[]): string[] {
  return events.map((e) => e.type);
}

describe("geometry helpers", () => {
  it("computes euclidean distance", () => {
    expect(dist({ x: 0, y: 0 }, { x: 3, y: 4 })).toBe(5);
  });

  it("measures pinch distance between thumb and index tips", () => {
    const lm = pinchHand();
    expect(pinchDistance(lm)).toBeLessThan(PINCH_ENTER);
    expect(pinchDistance(openHand())).toBeGreaterThan(PINCH_ENTER);
  });

  it("applies hysteresis at the pinch boundary", () => {
    const lm = openHand();
    // Just inside the enter threshold, not previously pinched -> pinching
    lm[THUMB_TIP] = { x: lm[INDEX_TIP].x + PINCH_ENTER - 0.005, y: lm[INDEX_TIP].y };
    expect(isPinching(lm, false)).toBe(true);
    // Same distance but previously pinched and below exit -> stays pinched
    lm[THUMB_TIP] = { x: lm[INDEX_TIP].x + PINCH_ENTER + 0.005, y: lm[INDEX_TIP].y };
    expect(isPinching(lm, true)).toBe(true);
    expect(isPinching(lm, false)).toBe(false);
  });

  it("detects extended vs curled fingers", () => {
    const open = openHand();
    expect(isFingerExtended(open, INDEX_TIP, INDEX_PIP)).toBe(true);
    const fist = fistHand();
    expect(isFingerExtended(fist, INDEX_TIP, INDEX_PIP)).toBe(false);
  });

  it("counts extended fingers", () => {
    expect(extendedFingerCount(openHand())).toBe(4);
    expect(extendedFingerCount(fistHand())).toBe(0);
  });

  it("recognizes an open palm only when not pinching", () => {
    expect(isOpenPalm(openHand())).toBe(true);
    expect(isOpenPalm(fistHand())).toBe(false);
    expect(isOpenPalm(pinchHand())).toBe(false);
  });

  it("reads the index fingertip", () => {
    expect(indexTip(openHand())).toEqual({ x: 0.45, y: 0.2 });
  });

  it("smooths points with exponential averaging", () => {
    expect(smoothPoint({ x: 0, y: 0 }, { x: 1, y: 1 }, 0.5)).toEqual({ x: 0.5, y: 0.5 });
    expect(smoothPoint({ x: 0, y: 0 }, { x: 1, y: 1 }, 1)).toEqual({ x: 1, y: 1 });
  });

  it("mirrors x for selfie view", () => {
    expect(mirrorX({ x: 0.2, y: 0.7 })).toEqual({ x: 0.8, y: 0.7 });
  });
});

describe("GestureTracker tap", () => {
  it("emits tap on a quick pinch and release", () => {
    const t = new GestureTracker();
    expect(t.update(pinchHand(), 1000)).toEqual([]);
    const events = t.update(openHand(), 1100);
    expect(eventTypes(events)).toEqual(["tap"]);
    expect(events[0].at.x).toBeGreaterThan(0);
  });

  it("emits doubleTap on two quick pinches", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    expect(eventTypes(t.update(openHand(), 1100))).toEqual(["tap"]);
    t.update(pinchHand(), 1000 + DOUBLE_TAP_WINDOW_MS - 100);
    const events = t.update(openHand(), 1000 + DOUBLE_TAP_WINDOW_MS);
    expect(eventTypes(events)).toEqual(["doubleTap"]);
  });

  it("does not double-tap when the second tap is too far away in space", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    t.update(openHand(), 1100);
    const farX = 0.45 + DOUBLE_TAP_MAX_DIST + 0.05;
    t.update(movePinch(openHand(), farX, 0.2), 1200);
    const events = t.update(moveIndexTip(openHand(), farX, 0.2), 1300);
    expect(eventTypes(events)).toEqual(["tap"]);
  });

  it("ignores a slow pinch release (neither tap nor grab)", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    // hold 400ms: longer than a tap, shorter than a grab
    t.update(pinchHand(), 1400);
    expect(eventTypes(t.update(openHand(), 1450))).toEqual([]);
  });
});

describe("GestureTracker grab", () => {
  it("emits grabStart after holding a pinch, then grabMove and grabEnd", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    expect(eventTypes(t.update(pinchHand(), 1600))).toEqual(["grabStart"]);
    const moved = movePinch(pinchHand(), 0.55, 0.25);
    const moveEvents = t.update(moved, 1700);
    expect(eventTypes(moveEvents)).toEqual(["grabMove"]);
    const grabMove = moveEvents[0];
    expect(grabMove.type).toBe("grabMove");
    if (grabMove.type === "grabMove") {
      expect(grabMove.dx).toBeCloseTo(0.1, 5);
      expect(grabMove.dy).toBeCloseTo(0.05, 5);
    }
    expect(eventTypes(t.update(openHand(), 1800))).toEqual(["grabEnd"]);
    expect(t.isGrabbing).toBe(false);
  });

  it("emits grabEnd when the hand is lost mid-grab", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    t.update(pinchHand(), 1600);
    expect(eventTypes(t.update(null, 1700))).toEqual(["grabEnd"]);
  });

  it("does not emit tap after a grab ends", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    t.update(pinchHand(), 1600);
    expect(eventTypes(t.update(openHand(), 2000))).toEqual(["grabEnd"]);
  });
});

describe("GestureTracker palm", () => {
  it("emits palmHold after holding an open palm", () => {
    const t = new GestureTracker();
    t.update(openHand(), 1000);
    expect(eventTypes(t.update(openHand(), 1000 + PALM_HOLD_MS - 100))).toEqual([]);
    expect(eventTypes(t.update(openHand(), 1000 + PALM_HOLD_MS + 50))).toEqual(["palmHold"]);
  });

  it("fires palmHold only once per hold", () => {
    const t = new GestureTracker();
    t.update(openHand(), 1000);
    t.update(openHand(), 1000 + PALM_HOLD_MS + 50);
    expect(eventTypes(t.update(openHand(), 1000 + PALM_HOLD_MS + 200))).toEqual([]);
  });

  it("resets the palm timer when the hand closes", () => {
    const t = new GestureTracker();
    t.update(openHand(), 1000);
    t.update(fistHand(), 1500);
    t.update(openHand(), 1600);
    expect(eventTypes(t.update(openHand(), 1600 + PALM_HOLD_MS + 50))).toEqual(["palmHold"]);
  });

  it("does not treat a pinched hand as a palm", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    expect(eventTypes(t.update(pinchHand(), 1000 + PALM_HOLD_MS + 500))).toEqual(["grabStart"]);
  });
});

describe("GestureTracker swipe", () => {
  function flick(t: GestureTracker, fromX: number, toX: number, startT: number): GestureEvent[] {
    const all: GestureEvent[] = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const x = fromX + ((toX - fromX) * i) / steps;
      all.push(...t.update(moveIndexTip(openHand(), x, 0.4), startT + i * 50));
    }
    return all;
  }

  it("detects a fast leftward flick as swipeLeft", () => {
    const t = new GestureTracker();
    const events = flick(t, 0.7, 0.3, 1000);
    expect(eventTypes(events)).toContain("swipeLeft");
  });

  it("detects a fast rightward flick as swipeRight", () => {
    const t = new GestureTracker();
    const events = flick(t, 0.3, 0.7, 1000);
    expect(eventTypes(events)).toContain("swipeRight");
  });

  it("ignores a slow drift (no swipe)", () => {
    const t = new GestureTracker();
    const all: GestureEvent[] = [];
    for (let i = 0; i <= 12; i++) {
      all.push(...t.update(moveIndexTip(openHand(), 0.7 - i * 0.02, 0.4), 1000 + i * 200));
    }
    expect(eventTypes(all)).not.toContain("swipeLeft");
  });

  it("ignores mostly-vertical movement", () => {
    const t = new GestureTracker();
    const all: GestureEvent[] = [];
    for (let i = 0; i <= 6; i++) {
      all.push(...t.update(moveIndexTip(openHand(), 0.5 - i * 0.04, 0.4 - i * 0.05), 1000 + i * 50));
    }
    expect(eventTypes(all)).not.toContain("swipeLeft");
  });

  it("does not swipe while pinching (drags are not swipes)", () => {
    const t = new GestureTracker();
    t.update(pinchHand(), 1000);
    t.update(pinchHand(), 1600); // grabStart
    const all: GestureEvent[] = [];
    for (let i = 0; i <= 6; i++) {
      all.push(...t.update(moveIndexTip(pinchHand(), 0.7 - i * 0.06, 0.2), 1700 + i * 50));
    }
    expect(eventTypes(all)).not.toContain("swipeLeft");
  });
});

describe("GestureTracker cursor", () => {
  it("tracks the smoothed index fingertip", () => {
    const t = new GestureTracker();
    t.update(openHand(), 1000);
    const c = t.cursorPos;
    expect(c).not.toBeNull();
    expect(c!.x).toBeCloseTo(0.45, 5);
  });

  it("clears the cursor when the hand is lost", () => {
    const t = new GestureTracker();
    t.update(openHand(), 1000);
    t.update(null, 1100);
    expect(t.cursorPos).toBeNull();
  });

  it("ignores malformed landmark arrays", () => {
    const t = new GestureTracker();
    expect(t.update([{ x: 0, y: 0 }], 1000)).toEqual([]);
    expect(t.cursorPos).toBeNull();
  });
});
