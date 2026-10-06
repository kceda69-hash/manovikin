// Gesture Deck — Tony Stark-style hand-gesture task interface.
//
// Full-screen holographic deck: task cards float in 3D, a glowing cursor
// tracks the index fingertip, and hand gestures drive selection, approval,
// dismissal, and reordering.
//
// Input pipeline (shared by hands + pointer):
//   raw input -> GestureEvent[] -> handleGesture -> deck actions
// Hand events come from GestureTracker fed by MediaPipe landmarks;
// pointer events are translated by the PointerSource below into the same
// event shapes, so both modes exercise identical interaction logic.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleHelp,
  Hand,
  MousePointer2,
  RotateCcw,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { GestureTracker, type GestureEvent, type Vec2 } from "@/lib/gesture/hand-gestures";
import { sendDeviceCommand } from "@/lib/devices.functions";
import { useDeckData } from "./useDeckData";
import { BackdropCanvas } from "./BackdropCanvas";
import { CameraView } from "./CameraView";
import type { CameraState } from "./HandTracker";
import { HandCursor } from "./HandCursor";
import { DeckCard } from "./DeckCard";
import { CardDetails } from "./CardDetails";
import {
  DECK_DISMISSED_KEY,
  DECK_ORDER_KEY,
  applyDeckOrder,
  loadDeckState,
  saveDeckState,
  type DeckCardData,
  type DeckCardKind,
} from "./deck-types";
import "./gesture-deck.css";

type InputMode = "hands" | "pointer";
type Filter = "all" | DeckCardKind;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "approval", label: "Approvals" },
  { id: "mission", label: "Missions" },
  { id: "routine", label: "Routines" },
  { id: "device", label: "Device" },
];

/** Hit-test a viewport point against cards and the approve zone. */
function hitTest(clientX: number, clientY: number): { cardId: string | null; approveZone: string | null } {
  const el = document.elementFromPoint(clientX, clientY);
  if (!el) return { cardId: null, approveZone: null };
  const approveEl = el.closest("[data-approve-zone]");
  const cardEl = el.closest("[data-card-id]");
  return {
    cardId: cardEl?.getAttribute("data-card-id") ?? null,
    approveZone: approveEl?.getAttribute("data-approve-zone") ?? null,
  };
}

/**
 * Translates pointer (mouse/touch) input into the same GestureEvent stream
 * the hand tracker produces, so pointer mode exercises identical logic.
 */
class PointerSource {
  private down: { x: number; y: number; t: number } | null = null;
  private grabbing = false;
  private lastGrab: { x: number; y: number } = { x: 0, y: 0 };
  private lastTap: { t: number; x: number; y: number } | null = null;

  constructor(private emit: (e: GestureEvent) => void) {}

  downAt(x: number, y: number, now: number): void {
    this.down = { x, y, t: now };
    this.grabbing = false;
  }

  moveTo(x: number, y: number, now: number, isDown: boolean): void {
    if (!isDown || !this.down) return;
    const dx = x - this.down.x;
    const dy = y - this.down.y;
    if (!this.grabbing && (Math.hypot(dx, dy) > 0.018 || now - this.down.t > 280)) {
      this.grabbing = true;
      this.lastGrab = { x, y };
      this.emit({ type: "grabStart", at: { x, y } });
    } else if (this.grabbing) {
      this.emit({ type: "grabMove", at: { x, y }, dx: x - this.lastGrab.x, dy: y - this.lastGrab.y });
      this.lastGrab = { x, y };
    }
  }

  upAt(x: number, y: number, now: number): void {
    const d = this.down;
    this.down = null;
    if (!d) return;
    if (this.grabbing) {
      this.grabbing = false;
      this.emit({ type: "grabEnd", at: { x, y } });
      // Fast horizontal flick converts the drag into a dismiss swipe.
      const dt = now - d.t;
      const dx = x - d.x;
      const dy = y - d.y;
      if (dt < 350 && dx < -0.055 && Math.abs(dy) < 0.045) {
        this.emit({ type: "swipeLeft", at: { x, y } });
      }
      return;
    }
    const dt = now - d.t;
    const moved = Math.hypot(x - d.x, y - d.y);
    if (dt < 350 && moved < 0.018) {
      if (
        this.lastTap &&
        now - this.lastTap.t <= 450 &&
        Math.hypot(x - this.lastTap.x, y - this.lastTap.y) <= 0.06
      ) {
        this.emit({ type: "doubleTap", at: { x, y } });
        this.lastTap = null;
      } else {
        this.emit({ type: "tap", at: { x, y } });
        this.lastTap = { t: now, x, y };
      }
    }
  }

  reset(): void {
    this.down = null;
    this.grabbing = false;
  }
}

export function GestureDeckPage() {
  const { cards, isLoading, error, refetch, pairedDeviceId } = useDeckData();
  const sendCmd = useServerFn(sendDeviceCommand);

  const [inputMode, setInputMode] = useState<InputMode>("hands");
  const [cameraOn, setCameraOn] = useState(true);
  const [cameraState, setCameraState] = useState<CameraState>("idle");
  const [order, setOrder] = useState<string[]>(() => loadDeckState<string[]>(DECK_ORDER_KEY, []));
  const [dismissed, setDismissed] = useState<string[]>(() => loadDeckState<string[]>(DECK_DISMISSED_KEY, []));
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drag, setDrag] = useState<{ cardId: string; dx: number; dy: number } | null>(null);
  const [approving, setApproving] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const trackerRef = useRef<GestureTracker | null>(null);
  if (!trackerRef.current) trackerRef.current = new GestureTracker();
  const cursorElRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef<PointerSource | null>(null);
  const dragRef = useRef<{ cardId: string; dx: number; dy: number } | null>(null);
  dragRef.current = drag;

  const visibleCards = useMemo(() => {
    const filtered = filter === "all" ? cards : cards.filter((c) => c.kind === filter);
    return applyDeckOrder(filtered, order, dismissed);
  }, [cards, order, dismissed, filter]);
  const visibleRef = useRef(visibleCards);
  visibleRef.current = visibleCards;

  const selectedCard = useMemo(
    () => visibleCards.find((c) => c.id === selectedId) ?? null,
    [visibleCards, selectedId],
  );

  // --- deck mutations -------------------------------------------------------

  const persistOrder = useCallback((next: string[]) => {
    setOrder(next);
    saveDeckState(DECK_ORDER_KEY, next);
  }, []);

  const dismissCard = useCallback(
    (id: string) => {
      setDismissed((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveDeckState(DECK_DISMISSED_KEY, next);
        return next;
      });
      setSelectedId((sel) => (sel === id ? null : sel));
    },
    [],
  );

  const resetDeck = useCallback(() => {
    setOrder([]);
    setDismissed([]);
    saveDeckState(DECK_ORDER_KEY, []);
    saveDeckState(DECK_DISMISSED_KEY, []);
    toast.success("Deck reset — all cards restored.");
  }, []);

  const approveCard = useCallback(
    async (card: DeckCardData) => {
      if (!card.approve || approving) return;
      if (!pairedDeviceId) {
        toast.error("No paired device — pair one at /devices first.");
        return;
      }
      setApproving(true);
      try {
        await sendCmd({
          data: { deviceId: pairedDeviceId, kind: card.approve.kind, command: card.approve.command },
        });
        toast.success(`Approved: ${card.title}`);
        dismissCard(card.id);
        refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Approve failed");
      } finally {
        setApproving(false);
      }
    },
    [approving, pairedDeviceId, sendCmd, dismissCard, refetch],
  );
  const approveRef = useRef(approveCard);
  approveRef.current = approveCard;

  const reorderTo = useCallback(
    (draggedId: string, targetId: string) => {
      if (draggedId === targetId) return;
      const visible = visibleRef.current;
      const ids = visible.map((c) => c.id);
      const from = ids.indexOf(draggedId);
      const to = ids.indexOf(targetId);
      if (from === -1 || to === -1) return;
      const next = [...ids];
      next.splice(from, 1);
      next.splice(to, 0, draggedId);
      // Preserve ids that are currently filtered out, in their old order.
      setOrder((prev) => {
        const rest = prev.filter((id) => !ids.includes(id));
        const merged = [...next, ...rest];
        saveDeckState(DECK_ORDER_KEY, merged);
        return merged;
      });
    },
    [],
  );

  // --- gesture -> action mapping (shared by hands + pointer) -----------------

  const handleGesture = useCallback(
    (e: GestureEvent) => {
      const px = e.at.x * window.innerWidth;
      const py = e.at.y * window.innerHeight;
      switch (e.type) {
        case "tap": {
          const hit = hitTest(px, py);
          if (hit.approveZone) {
            const card = visibleRef.current.find((c) => c.id === hit.approveZone);
            if (card?.approve) void approveRef.current(card);
          } else if (hit.cardId) {
            setSelectedId(hit.cardId);
          } else {
            setSelectedId(null);
          }
          break;
        }
        case "doubleTap": {
          const hit = hitTest(px, py);
          if (hit.cardId) {
            const card = visibleRef.current.find((c) => c.id === hit.cardId);
            if (card?.approve) void approveRef.current(card);
          }
          break;
        }
        case "grabStart": {
          const hit = hitTest(px, py);
          if (hit.cardId) setDrag({ cardId: hit.cardId, dx: 0, dy: 0 });
          break;
        }
        case "grabMove": {
          setDrag((d) =>
            d
              ? { ...d, dx: d.dx + e.dx * window.innerWidth, dy: d.dy + window.innerHeight * e.dy }
              : d,
          );
          break;
        }
        case "grabEnd": {
          const d = dragRef.current;
          setDrag(null);
          if (d) {
            const hit = hitTest(px, py);
            if (hit.cardId) reorderTo(d.cardId, hit.cardId);
          }
          break;
        }
        case "swipeLeft": {
          const hit = hitTest(px, py);
          if (hit.cardId) {
            dismissCard(hit.cardId);
            toast("Card dismissed", { description: "Use Reset deck to bring it back." });
          }
          break;
        }
        case "swipeRight":
          break;
        case "palmHold": {
          setSelectedId((sel) => {
            if (sel) return null;
            setShowHelp((h) => !h);
            return sel;
          });
          break;
        }
      }
    },
    [dismissCard, reorderTo],
  );
  const handleGestureRef = useRef(handleGesture);
  handleGestureRef.current = handleGesture;

  // --- hand input ------------------------------------------------------------

  const handleLandmarks = useCallback((lm: Vec2[] | null) => {
    const tracker = trackerRef.current;
    if (!tracker) return;
    const events = tracker.update(lm, performance.now());
    const el = cursorElRef.current;
    if (el) {
      const c = tracker.cursorPos;
      if (c) {
        el.style.opacity = "1";
        el.style.transform = `translate3d(${c.x * window.innerWidth}px, ${c.y * window.innerHeight}px, 0)`;
        el.dataset.mode = tracker.isGrabbing ? "grab" : tracker.isPinched ? "pinch" : "default";
      } else {
        el.style.opacity = "0";
      }
    }
    for (const e of events) handleGestureRef.current(e);
  }, []);

  // --- pointer input ----------------------------------------------------------

  const pointer = useMemo(() => new PointerSource((e) => handleGestureRef.current(e)), []);
  useEffect(() => {
    pointerRef.current = pointer;
    return () => {
      pointerRef.current = null;
    };
  }, [pointer]);

  const onPointerDown = useCallback(
    (ev: React.PointerEvent) => {
      if (inputMode !== "pointer") return;
      pointer.downAt(ev.clientX / window.innerWidth, ev.clientY / window.innerHeight, performance.now());
    },
    [inputMode, pointer],
  );
  const onPointerMove = useCallback(
    (ev: React.PointerEvent) => {
      if (inputMode !== "pointer") return;
      pointer.moveTo(
        ev.clientX / window.innerWidth,
        ev.clientY / window.innerHeight,
        performance.now(),
        (ev.buttons & 1) === 1,
      );
    },
    [inputMode, pointer],
  );
  const onPointerUp = useCallback(
    (ev: React.PointerEvent) => {
      if (inputMode !== "pointer") return;
      pointer.upAt(ev.clientX / window.innerWidth, ev.clientY / window.innerHeight, performance.now());
    },
    [inputMode, pointer],
  );

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        handleGestureRef.current({
          type: "palmHold",
          at: { x: 0.5, y: 0.5 },
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (inputMode === "pointer") {
      const el = cursorElRef.current;
      if (el) el.style.opacity = "0";
    }
  }, [inputMode ]);

  // --- render ------------------------------------------------------------------

  const cameraBlocked = cameraState === "denied" || cameraState === "unavailable";

  return (
    <div
      className="gd-root"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onDoubleClick={(ev) => {
        if (inputMode !== "pointer") return;
        const hit = hitTest(ev.clientX, ev.clientY);
        if (hit.cardId) {
          const card = visibleRef.current.find((c) => c.id === hit.cardId);
          if (card?.approve) void approveRef.current(card);
        }
      }}
    >
      <BackdropCanvas />

      <header className="gd-header">
        <Link to="/" className="gd-back" aria-label="Back to MANOVIK">
          <ArrowLeft size={16} />
        </Link>
        <div className="gd-title">
          <h1>Gesture Deck</h1>
          <p>Holographic task control — hands or pointer</p>
        </div>
        <div className="gd-header-actions">
          <div className="gd-mode-toggle" role="group" aria-label="Input mode">
            <button
              type="button"
              className={inputMode === "hands" ? "active" : ""}
              onClick={() => setInputMode("hands")}
            >
              <Hand size={14} /> Hands
            </button>
            <button
              type="button"
              className={inputMode === "pointer" ? "active" : ""}
              onClick={() => setInputMode("pointer")}
            >
              <MousePointer2 size={14} /> Pointer
            </button>
          </div>
          {inputMode === "hands" ? (
            <button
              type="button"
              className="gd-icon-btn"
              onClick={() => setCameraOn((v) => !v)}
              aria-label={cameraOn ? "Turn camera off" : "Turn camera on"}
              title={cameraOn ? "Turn camera off" : "Turn camera on"}
            >
              {cameraOn ? <Video size={16} /> : <VideoOff size={16} />}
            </button>
          ) : null}
          <button type="button" className="gd-icon-btn" onClick={() => setShowHelp((v) => !v)} aria-label="Gesture help">
            <CircleHelp size={16} />
          </button>
          <button type="button" className="gd-icon-btn" onClick={resetDeck} aria-label="Reset deck">
            <RotateCcw size={16} />
          </button>
        </div>
      </header>

      {inputMode === "hands" && cameraBlocked ? (
        <div className="gd-banner" role="alert">
          <X size={14} />
          <span>Camera unavailable — hand tracking is off.</span>
          <button type="button" className="gd-btn gd-btn-small" onClick={() => setInputMode("pointer")}>
            Switch to pointer mode
          </button>
        </div>
      ) : null}

      {showHelp ? (
        <div className="gd-help" role="dialog" aria-label="Gesture guide">
          <h2>Gesture map</h2>
          <ul>
            <li><b>Pinch</b> thumb + index — tap / select a card</li>
            <li><b>Double-pinch</b> — approve a pending action</li>
            <li><b>Pinch, hold, move</b> — grab and reorder cards</li>
            <li><b>Pinch the glowing ring</b> — approve in the details panel</li>
            <li><b>Swipe left</b> (open hand flick) — dismiss a card</li>
            <li><b>Open palm, hold</b> — close panel / toggle this guide</li>
          </ul>
          <p className="gd-help-note">Pointer mode: click = tap, double-click = approve, drag = reorder, quick flick left = dismiss, Esc = back.</p>
          <button type="button" className="gd-btn" onClick={() => setShowHelp(false)}>Got it</button>
        </div>
      ) : null}

      <div className="gd-filters" role="group" aria-label="Card filter">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            className={filter === f.id ? "active" : ""}
            onClick={() => setFilter(f.id)}
          >
            {f.label}
          </button>
        ))}
        <button type="button" className="gd-refresh" onClick={() => refetch()} aria-label="Refresh deck data">
          <RotateCcw size={13} />
        </button>
      </div>

      <main className="gd-deck" aria-label="Task cards">
        {isLoading ? (
          <div className="gd-empty">
            <div className="gd-scan" />
            <p>Materializing deck…</p>
          </div>
        ) : error ? (
          <div className="gd-empty">
            <p>{error}</p>
            <button type="button" className="gd-btn" onClick={() => refetch()}>Retry</button>
          </div>
        ) : visibleCards.length === 0 ? (
          <div className="gd-empty">
            <p>All clear — no cards on the deck.</p>
            <div className="gd-empty-actions">
              <button type="button" className="gd-btn" onClick={() => refetch()}>Refresh</button>
              {dismissed.length > 0 ? (
                <button type="button" className="gd-btn gd-btn-ghost" onClick={resetDeck}>
                  Restore dismissed
                </button>
              ) : null}
            </div>
          </div>
        ) : (
          visibleCards.map((card) => (
            <DeckCard
              key={card.id}
              card={card}
              selected={card.id === selectedId}
              dragOffset={drag?.cardId === card.id ? { x: drag.dx, y: drag.dy } : null}
            />
          ))
        )}
      </main>

      {selectedCard ? (
        <CardDetails
          card={selectedCard}
          approving={approving}
          onApprove={() => void approveRef.current(selectedCard)}
          onDismiss={() => dismissCard(selectedCard.id)}
          onClose={() => setSelectedId(null)}
        />
      ) : null}

      {inputMode === "hands" ? (
        <>
          <CameraView enabled={cameraOn} onLandmarks={handleLandmarks} onStateChange={setCameraState} />
          <HandCursor ref={cursorElRef} />
        </>
      ) : null}

      <footer className="gd-footer">
        <span>
          {inputMode === "hands"
            ? cameraState === "active"
              ? "Hand tracking live — pinch to select"
              : "Enable the camera to drive the deck with your hands"
            : "Pointer mode — click, drag, double-click"}
        </span>
      </footer>
    </div>
  );
}
