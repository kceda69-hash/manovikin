// Pure hand-gesture recognition for the Gesture Deck.
//
// No DOM, no MediaPipe imports: every function operates on plain landmark
// arrays, so the whole module is unit-testable. MediaPipe's HandLandmarker
// yields 21 landmarks per hand in normalized image coordinates
// (x, y in [0,1], origin top-left, y growing downward); z is depth.
//
// Gesture map (Tony Stark deck):
//   pinch (thumb + index)            -> tap / select
//   pinch, release quickly twice     -> double-tap (approve)
//   pinch held, then move            -> grab / drag (reorder)
//   fast open-hand flick left        -> swipe left (dismiss)
//   open palm held                   -> back / close
//   index fingertip                  -> glowing cursor

export interface Vec2 {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------
// MediaPipe hand landmark indices
// ---------------------------------------------------------------------------

export const WRIST = 0;
export const THUMB_TIP = 4;
export const INDEX_TIP = 8;
export const INDEX_PIP = 6;
export const MIDDLE_TIP = 12;
export const MIDDLE_PIP = 10;
export const RING_TIP = 16;
export const RING_PIP = 14;
export const PINKY_TIP = 20;
export const PINKY_PIP = 18;

export const HAND_LANDMARK_COUNT = 21;

// ---------------------------------------------------------------------------
// Tunables (exported so tests and the UI share the same thresholds)
// ---------------------------------------------------------------------------

/** Pinch engages below this thumb-index distance (normalized units). */
export const PINCH_ENTER = 0.045;
/** Pinch releases above this distance — hysteresis band avoids flicker. */
export const PINCH_EXIT = 0.065;
/** A pinch shorter than this is a tap. */
export const TAP_MAX_MS = 300;
/** Holding a pinch this long starts a grab. */
export const GRAB_HOLD_MS = 500;
/** Two taps inside this window (and near each other) form a double-tap. */
export const DOUBLE_TAP_WINDOW_MS = 450;
export const DOUBLE_TAP_MAX_DIST = 0.08;
/** Swipe: horizontal travel inside this time window, with limited vertical drift. */
export const SWIPE_MIN_DX = 0.22;
export const SWIPE_MAX_DY = 0.18;
export const SWIPE_MIN_MS = 80;
export const SWIPE_WINDOW_MS = 450;
/** Open palm must be held this long to count as back/close. */
export const PALM_HOLD_MS = 800;
/** Exponential smoothing factor for the cursor. */
export const CURSOR_SMOOTHING = 0.35;

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function dist(a: Vec2, b: Vec2): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/** Distance between thumb tip (4) and index tip (8). */
export function pinchDistance(lm: Vec2[]): number {
  return dist(lm[THUMB_TIP], lm[INDEX_TIP]);
}

/**
 * Pinch state with hysteresis: engages below PINCH_ENTER, releases above
 * PINCH_EXIT. Pass the previous pinched state to avoid flicker at the boundary.
 */
export function isPinching(lm: Vec2[], wasPinched: boolean): boolean {
  const d = pinchDistance(lm);
  if (wasPinched) return d < PINCH_EXIT;
  return d < PINCH_ENTER;
}

/**
 * A finger counts as extended when its tip sits above (smaller y than) its
 * PIP joint — image coordinates grow downward.
 */
export function isFingerExtended(lm: Vec2[], tipIdx: number, pipIdx: number): boolean {
  return lm[tipIdx].y < lm[pipIdx].y;
}

/** Number of extended fingers among index/middle/ring/pinky (0-4). */
export function extendedFingerCount(lm: Vec2[]): number {
  const pairs: Array<[number, number]> = [
    [INDEX_TIP, INDEX_PIP],
    [MIDDLE_TIP, MIDDLE_PIP],
    [RING_TIP, RING_PIP],
    [PINKY_TIP, PINKY_PIP],
  ];
  return pairs.filter(([tip, pip]) => isFingerExtended(lm, tip, pip)).length;
}

/** Open palm: all four fingers extended and not pinching. */
export function isOpenPalm(lm: Vec2[]): boolean {
  return extendedFingerCount(lm) === 4 && !isPinching(lm, false);
}

export function indexTip(lm: Vec2[]): Vec2 {
  return { x: lm[INDEX_TIP].x, y: lm[INDEX_TIP].y };
}

/** Exponential moving average toward the new sample. */
export function smoothPoint(prev: Vec2, next: Vec2, alpha: number = CURSOR_SMOOTHING): Vec2 {
  return {
    x: prev.x + (next.x - prev.x) * alpha,
    y: prev.y + (next.y - prev.y) * alpha,
  };
}

/** Mirror horizontally for selfie-view cameras. */
export function mirrorX(p: Vec2): Vec2 {
  return { x: 1 - p.x, y: p.y };
}

// ---------------------------------------------------------------------------
// Gesture events + tracker
// ---------------------------------------------------------------------------

export type GestureEvent =
  | { type: "tap"; at: Vec2 }
  | { type: "doubleTap"; at: Vec2 }
  | { type: "grabStart"; at: Vec2 }
  | { type: "grabMove"; at: Vec2; dx: number; dy: number }
  | { type: "grabEnd"; at: Vec2 }
  | { type: "swipeLeft"; at: Vec2 }
  | { type: "swipeRight"; at: Vec2 }
  | { type: "palmHold"; at: Vec2 };

interface TrailPoint {
  t: number;
  pos: Vec2;
}

/**
 * Stateful tracker: feed it one hand's landmarks (or null when the hand is
 * lost) plus a millisecond timestamp, and it emits discrete gesture events.
 * All time comes from the caller, so the tracker is fully deterministic and
 * unit-testable.
 */
export class GestureTracker {
  private pinched = false;
  private pinchStartT = 0;
  private grabbing = false;
  private lastMovePos: Vec2 = { x: 0, y: 0 };
  private lastTap: { t: number; pos: Vec2 } | null = null;
  private palmStartT: number | null = null;
  private palmFired = false;
  private trail: TrailPoint[] = [];
  private cursor: Vec2 | null = null;

  /** Smoothed index-fingertip position in normalized coords, or null. */
  get cursorPos(): Vec2 | null {
    return this.cursor ? { ...this.cursor } : null;
  }

  get isGrabbing(): boolean {
    return this.grabbing;
  }

  get isPinched(): boolean {
    return this.pinched;
  }

  reset(): void {
    this.pinched = false;
    this.grabbing = false;
    this.lastTap = null;
    this.palmStartT = null;
    this.palmFired = false;
    this.trail = [];
    this.cursor = null;
  }

  update(landmarks: Vec2[] | null, nowMs: number): GestureEvent[] {
    const events: GestureEvent[] = [];

    if (!landmarks || landmarks.length < HAND_LANDMARK_COUNT) {
      if (this.grabbing && this.cursor) {
        events.push({ type: "grabEnd", at: { ...this.cursor } });
      }
      this.pinched = false;
      this.grabbing = false;
      this.palmStartT = null;
      this.palmFired = false;
      this.trail = [];
      this.cursor = null;
      return events;
    }

    const tip = indexTip(landmarks);
    this.cursor = this.cursor ? smoothPoint(this.cursor, tip) : { ...tip };
    const at = { ...this.cursor };

    // --- pinch state machine (with hysteresis) ---
    const wasPinched = this.pinched;
    this.pinched = isPinching(landmarks, wasPinched);

    if (this.pinched && !wasPinched) {
      this.pinchStartT = nowMs;
      this.lastMovePos = { ...tip };
      this.palmStartT = null;
      this.palmFired = false;
      this.trail = [];
    } else if (!this.pinched && wasPinched) {
      if (this.grabbing) {
        events.push({ type: "grabEnd", at });
        this.grabbing = false;
      } else if (nowMs - this.pinchStartT <= TAP_MAX_MS) {
        if (
          this.lastTap &&
          nowMs - this.lastTap.t <= DOUBLE_TAP_WINDOW_MS &&
          dist(this.lastTap.pos, tip) <= DOUBLE_TAP_MAX_DIST
        ) {
          events.push({ type: "doubleTap", at });
          this.lastTap = null;
        } else {
          events.push({ type: "tap", at });
          this.lastTap = { t: nowMs, pos: { ...tip } };
        }
      }
      // slow releases (longer than TAP_MAX_MS, shorter than grab) are ignored
    } else if (this.pinched && wasPinched) {
      if (!this.grabbing && nowMs - this.pinchStartT >= GRAB_HOLD_MS) {
        this.grabbing = true;
        this.lastMovePos = { ...tip };
        events.push({ type: "grabStart", at });
      } else if (this.grabbing) {
        const dx = tip.x - this.lastMovePos.x;
        const dy = tip.y - this.lastMovePos.y;
        if (dx !== 0 || dy !== 0) {
          events.push({ type: "grabMove", at, dx, dy });
        }
        this.lastMovePos = { ...tip };
      }
    }

    // --- open-palm hold (only when not pinching) ---
    if (!this.pinched) {
      if (isOpenPalm(landmarks)) {
        if (this.palmStartT === null) {
          this.palmStartT = nowMs;
          this.palmFired = false;
        } else if (!this.palmFired && nowMs - this.palmStartT >= PALM_HOLD_MS) {
          this.palmFired = true;
          events.push({ type: "palmHold", at });
        }
      } else {
        this.palmStartT = null;
        this.palmFired = false;
      }
    }

    // --- swipe detection from the fingertip trail (only when not pinching,
    // so a drag never misfires as a swipe) ---
    if (!this.pinched) {
      this.trail.push({ t: nowMs, pos: { ...tip } });
      while (this.trail.length > 0 && nowMs - this.trail[0].t > SWIPE_WINDOW_MS) {
        this.trail.shift();
      }
      const first = this.trail[0];
      if (first) {
        const dx = tip.x - first.pos.x;
        const dy = tip.y - first.pos.y;
        const dt = nowMs - first.t;
        if (dt >= SWIPE_MIN_MS && dt <= SWIPE_WINDOW_MS) {
          if (dx <= -SWIPE_MIN_DX && Math.abs(dy) <= SWIPE_MAX_DY) {
            events.push({ type: "swipeLeft", at });
            this.trail = [];
          } else if (dx >= SWIPE_MIN_DX && Math.abs(dy) <= SWIPE_MAX_DY) {
            events.push({ type: "swipeRight", at });
            this.trail = [];
          }
        }
      }
    } else {
      this.trail = [];
    }

    return events;
  }
}
