import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Newspaper,
  Cpu,
  Camera,
  House,
  Mic,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Vibrate,
  Volume2,
  Bell,
  ArrowRight,
} from "lucide-react";
import { listDevices, sendDeviceCommand } from "@/lib/devices.functions";
import { listThreads, getThreadMessages, parseMessages } from "@/lib/chat.functions";

export const Route = createFileRoute("/holo")({
  head: () => ({
    meta: [
      { title: "Holo Deck — MANOVIK" },
      {
        name: "description",
        content:
          "A floating command deck for MANOVIK: briefings, devices, camera, smart home and voice — panels you can drag, tilt and feel.",
      },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: HoloDeckPage,
});

// ---------------------------------------------------------------------------
// Pure helpers (exported for tests; no DOM/React dependencies)
// ---------------------------------------------------------------------------

export type PanelPos = { x: number; y: number };
export type HoloLayout = Record<string, PanelPos>;
export type Tilt = { rotateX: number; rotateY: number };
export type TiltRect = { left: number; top: number; width: number; height: number };

export const HOLO_LAYOUT_KEY = "holo-layout-v1";
export const MAX_TILT_DEG = 8;

/** Keep a panel fully inside the viewport. Panels larger than the viewport pin to 0. */
export function clampPanelPos(
  x: number,
  y: number,
  panelW: number,
  panelH: number,
  viewportW: number,
  viewportH: number,
): PanelPos {
  const maxX = Math.max(0, viewportW - panelW);
  const maxY = Math.max(0, viewportH - panelH);
  return {
    x: Math.min(Math.max(0, x), maxX),
    y: Math.min(Math.max(0, y), maxY),
  };
}

/** Serialize a panel layout to a string for storage. */
export function serializeLayout(layout: HoloLayout): string {
  return JSON.stringify(layout);
}

/**
 * Parse a stored layout. Corrupt JSON, non-objects, or malformed entries fall
 * back to the supplied defaults (valid entries are merged over them).
 */
export function parseLayout(
  raw: string | null | undefined,
  fallback: HoloLayout,
): HoloLayout {
  const merged: HoloLayout = { ...fallback };
  if (!raw) return merged;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return merged;
  }
  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return merged;
  }
  for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (typeof value === "object" && value !== null) {
      const { x, y } = value as { x?: unknown; y?: unknown };
      if (typeof x === "number" && typeof y === "number" && Number.isFinite(x) && Number.isFinite(y)) {
        merged[key] = { x, y };
      }
    }
  }
  return merged;
}

/**
 * 3D tilt for a panel: pointer position relative to the panel rect maps to
 * rotateX/rotateY, capped at ±maxDeg (default 8°). Pointer outside the rect
 * clamps to the nearest edge so the tilt never exceeds the cap.
 */
export function tiltAngles(
  pointerX: number,
  pointerY: number,
  rect: TiltRect,
  maxDeg: number = MAX_TILT_DEG,
): Tilt {
  if (rect.width <= 0 || rect.height <= 0) return { rotateX: 0, rotateY: 0 };
  const relX = Math.min(Math.max((pointerX - rect.left) / rect.width, 0), 1) - 0.5;
  const relY = Math.min(Math.max((pointerY - rect.top) / rect.height, 0), 1) - 0.5;
  return {
    rotateX: -relY * 2 * maxDeg,
    rotateY: relX * 2 * maxDeg,
  };
}

/** Short haptic buzz, safe on browsers without the Vibration API. */
export function buzz(ms: number): void {
  try {
    navigator.vibrate?.(ms);
  } catch {
    /* ignore */
  }
}

// ---------------------------------------------------------------------------
// Layout defaults
// ---------------------------------------------------------------------------

const PANEL_IDS = ["briefing", "devices", "camera", "smarthome", "voice"] as const;
type PanelId = (typeof PANEL_IDS)[number];

const DEFAULT_LAYOUT: HoloLayout = {
  briefing: { x: 16, y: 76 },
  devices: { x: 16, y: 420 },
  camera: { x: 340, y: 76 },
  smarthome: { x: 340, y: 330 },
  voice: { x: 340, y: 560 },
};

const PANEL_W = 304; // matches the w-[304px] class below

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function HoloDeckPage() {
  const navigate = useNavigate();
  const [layout, setLayout] = useState<HoloLayout>(DEFAULT_LAYOUT);
  const [collapsed, setCollapsed] = useState<Record<PanelId, boolean>>({
    briefing: false,
    devices: false,
    camera: false,
    smarthome: false,
    voice: false,
  });
  const [tilt, setTilt] = useState<Record<PanelId, Tilt>>({
    briefing: { rotateX: 0, rotateY: 0 },
    devices: { rotateX: 0, rotateY: 0 },
    camera: { rotateX: 0, rotateY: 0 },
    smarthome: { rotateX: 0, rotateY: 0 },
    voice: { rotateX: 0, rotateY: 0 },
  });
  const [frontId, setFrontId] = useState<PanelId | null>(null);

  const panelRefs = useRef<Record<PanelId, HTMLElement | null>>({
    briefing: null,
    devices: null,
    camera: null,
    smarthome: null,
    voice: null,
  });
  const dragRef = useRef<{
    id: PanelId;
    grabDX: number;
    grabDY: number;
    moved: boolean;
  } | null>(null);

  // Restore saved positions once on mount.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(HOLO_LAYOUT_KEY);
      setLayout(parseLayout(raw, DEFAULT_LAYOUT));
    } catch {
      /* storage unavailable — keep defaults */
    }
  }, []);

  function persist(next: HoloLayout) {
    setLayout(next);
    try {
      window.localStorage.setItem(HOLO_LAYOUT_KEY, serializeLayout(next));
    } catch {
      /* storage unavailable */
    }
  }

  function resetLayout() {
    buzz(25);
    persist({ ...DEFAULT_LAYOUT });
  }

  // -- drag ---------------------------------------------------------------

  function onHeaderPointerDown(e: React.PointerEvent, id: PanelId) {
    const el = panelRefs.current[id];
    if (!el) return;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    const rect = el.getBoundingClientRect();
    dragRef.current = {
      id,
      grabDX: e.clientX - rect.left,
      grabDY: e.clientY - rect.top,
      moved: false,
    };
    setFrontId(id);
    buzz(25);
  }

  function onHeaderPointerMove(e: React.PointerEvent, id: PanelId) {
    const drag = dragRef.current;
    if (!drag || drag.id !== id) return;
    const dx = e.clientX - drag.grabDX;
    const dy = e.clientY - drag.grabDY;
    const el = panelRefs.current[id];
    const pw = el?.offsetWidth ?? PANEL_W;
    const ph = el?.offsetHeight ?? 240;
    const pos = clampPanelPos(
      dx + window.scrollX,
      dy + window.scrollY,
      pw,
      ph,
      window.innerWidth,
      window.innerHeight,
    );
    const prev = layout[id];
    if (!prev || Math.abs(pos.x - prev.x) > 2 || Math.abs(pos.y - prev.y) > 2) {
      drag.moved = true;
    }
    setLayout((cur) => ({ ...cur, [id]: pos }));
  }

  function onHeaderPointerUp(id: PanelId) {
    const drag = dragRef.current;
    dragRef.current = null;
    if (!drag || drag.id !== id) return;
    if (!drag.moved) {
      // It was a tap, not a drag — toggle collapse.
      setCollapsed((cur) => ({ ...cur, [id]: !cur[id] }));
    } else {
      try {
        window.localStorage.setItem(HOLO_LAYOUT_KEY, serializeLayout(layout));
      } catch {
        /* ignore */
      }
    }
    buzz(10);
  }

  // -- tilt -----------------------------------------------------------------

  function onPanelPointerMove(e: React.PointerEvent, id: PanelId) {
    if (dragRef.current) return; // no tilt while dragging
    const el = panelRefs.current[id];
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setTilt((cur) => ({
      ...cur,
      [id]: tiltAngles(e.clientX, e.clientY, {
        left: rect.left,
        top: rect.top,
        width: rect.width,
        height: rect.height,
      }),
    }));
  }

  function onPanelPointerLeave(id: PanelId) {
    setTilt((cur) => ({ ...cur, [id]: { rotateX: 0, rotateY: 0 } }));
  }

  function panelStyle(id: PanelId): React.CSSProperties {
    const pos = layout[id] ?? DEFAULT_LAYOUT[id];
    const t = tilt[id] ?? { rotateX: 0, rotateY: 0 };
    return {
      transform: `translate3d(${pos.x}px, ${pos.y}px, 0) perspective(900px) rotateX(${t.rotateX}deg) rotateY(${t.rotateY}deg)`,
      zIndex: frontId === id ? 30 : 10,
    };
  }

  const panelMeta: Record<PanelId, { title: string; icon: React.ReactNode; accent: string }> = {
    briefing: {
      title: "Briefing",
      icon: <Newspaper className="h-4 w-4" />,
      accent: "cyan",
    },
    devices: {
      title: "Devices",
      icon: <Cpu className="h-4 w-4" />,
      accent: "violet",
    },
    camera: {
      title: "Camera",
      icon: <Camera className="h-4 w-4" />,
      accent: "emerald",
    },
    smarthome: {
      title: "Smart Home",
      icon: <House className="h-4 w-4" />,
      accent: "amber",
    },
    voice: {
      title: "Voice",
      icon: <Mic className="h-4 w-4" />,
      accent: "fuchsia",
    },
  };

  return (
    <div className="holo-deck relative min-h-[100dvh] overflow-hidden text-slate-100">
      <style>{HOLO_CSS}</style>
      <div className="holo-bg" aria-hidden="true" />
      <div className="holo-grid" aria-hidden="true" />

      {/* header */}
      <header className="pointer-events-none absolute inset-x-0 top-0 z-40 flex items-center justify-between px-4 py-3">
        <h1 className="holo-title pointer-events-auto select-none text-xl font-black tracking-[0.3em]">
          HOLO DECK
        </h1>
        <button
          type="button"
          onClick={resetLayout}
          className="holo-chip pointer-events-auto flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset layout
        </button>
      </header>

      {/* floating panels */}
      <div className="absolute inset-0">
        {(Object.keys(panelMeta) as PanelId[]).map((id) => {
          const meta = panelMeta[id];
          const isCollapsed = collapsed[id];
          return (
            <section
              key={id}
              ref={(el) => {
                panelRefs.current[id] = el;
              }}
              style={panelStyle(id)}
              onPointerMove={(e) => onPanelPointerMove(e, id)}
              onPointerLeave={() => onPanelPointerLeave(id)}
              className={`holo-panel holo-accent-${meta.accent} absolute left-0 top-0 w-[304px] rounded-2xl will-change-transform`}
              aria-label={meta.title}
            >
              <div
                className="flex cursor-grab touch-none select-none items-center justify-between gap-2 px-4 py-3 active:cursor-grabbing"
                onPointerDown={(e) => onHeaderPointerDown(e, id)}
                onPointerMove={(e) => onHeaderPointerMove(e, id)}
                onPointerUp={() => onHeaderPointerUp(id)}
                onPointerCancel={() => {
                  dragRef.current = null;
                }}
                role="button"
                tabIndex={0}
                aria-label={`${meta.title} — drag to move, tap to ${isCollapsed ? "expand" : "collapse"}`}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setCollapsed((cur) => ({ ...cur, [id]: !cur[id] }));
                  }
                }}
              >
                <span className="flex items-center gap-2 text-sm font-bold tracking-widest uppercase">
                  <span className={`holo-glyph holo-glyph-${meta.accent}`}>{meta.icon}</span>
                  {meta.title}
                </span>
                {isCollapsed ? (
                  <ChevronDown className="h-4 w-4 opacity-60" />
                ) : (
                  <ChevronUp className="h-4 w-4 opacity-60" />
                )}
              </div>
              {!isCollapsed && (
                <div className="px-4 pb-4">
                  {id === "briefing" && <BriefingPanel navigateTo={() => navigate({ to: "/chat" })} />}
                  {id === "devices" && <DevicesPanel />}
                  {id === "camera" && (
                    <button
                      type="button"
                      onClick={() => {
                        buzz(25);
                        navigate({ to: "/chat" });
                      }}
                      className="holo-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
                    >
                      <Camera className="h-4 w-4" /> Open camera in chat
                    </button>
                  )}
                  {id === "smarthome" && (
                    <div className="space-y-3">
                      <p className="text-xs leading-relaxed text-slate-300/80">
                        Link Tuya / Smart Life to control lights from here.
                      </p>
                      {/* Plain anchor: /home is being built by another track and is not
                          in the typed route table yet. */}
                      <a
                        href="/home"
                        onClick={() => buzz(25)}
                        className="holo-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold"
                      >
                        <House className="h-4 w-4" /> Open Smart Home <ArrowRight className="h-4 w-4" />
                      </a>
                    </div>
                  )}
                  {id === "voice" && (
                    <button
                      type="button"
                      onClick={() => {
                        buzz(25);
                        navigate({ to: "/chat" });
                      }}
                      className="holo-voice-btn flex w-full flex-col items-center justify-center gap-2 rounded-xl px-4 py-6"
                    >
                      <Mic className="h-8 w-8" />
                      <span className="text-sm font-black tracking-widest uppercase">
                        Start voice companion
                      </span>
                      <span className="text-[11px] text-slate-300/70">
                        Opens chat — tap the voice button there
                      </span>
                    </button>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Briefing panel — live via existing chat server functions
// ---------------------------------------------------------------------------

function BriefingPanel({ navigateTo }: { navigateTo: () => void }) {
  const fetchThreads = useServerFn(listThreads);
  const fetchMessages = useServerFn(getThreadMessages);

  const threads = useQuery({
    queryKey: ["holo", "briefing-threads"],
    queryFn: () => fetchThreads({}),
    staleTime: 60_000,
  });
  const briefingThread = (threads.data?.threads ?? []).find((t) =>
    t.title.includes("MANO Briefings"),
  );
  const messages = useQuery({
    queryKey: ["holo", "briefing-messages", briefingThread?.id],
    queryFn: () => fetchMessages({ data: { threadId: briefingThread!.id } }),
    enabled: Boolean(briefingThread?.id),
    staleTime: 60_000,
  });

  let summary: string | null = null;
  if (messages.data) {
    const parsed = parseMessages(messages.data.messagesJson);
    const lastAssistant = [...parsed]
      .reverse()
      .find((m) => m.role === "assistant");
    const parts = (lastAssistant as { parts?: { type?: string; text?: string }[] } | undefined)
      ?.parts;
    const text = (parts ?? [])
      .filter((p) => p?.type === "text" && p.text)
      .map((p) => p.text as string)
      .join("\n");
    if (text.trim()) {
      summary = text.trim().length > 420 ? text.trim().slice(0, 420) + "…" : text.trim();
    }
  }

  if (threads.isError || messages.isError) {
    return (
      <div className="space-y-3">
        <p className="text-xs text-slate-300/70">Couldn't load the latest briefing right now.</p>
        <OpenBriefingsButton onClick={navigateTo} />
      </div>
    );
  }

  if (threads.isPending || (briefingThread && messages.isPending)) {
    return <p className="holo-shimmer text-xs text-slate-300/70">Tuning into MANO…</p>;
  }

  if (!briefingThread || !summary) {
    return (
      <div className="space-y-3">
        <p className="text-xs leading-relaxed text-slate-300/70">
          No briefings yet. Ask MANO to brief you — it lands in the ⚡ MANO Briefings thread.
        </p>
        <OpenBriefingsButton onClick={navigateTo} />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="whitespace-pre-wrap text-xs leading-relaxed text-slate-200/90">{summary}</p>
      <OpenBriefingsButton onClick={navigateTo} />
    </div>
  );
}

function OpenBriefingsButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={() => {
        buzz(25);
        onClick();
      }}
      className="holo-btn flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-bold"
    >
      Open briefings in chat <ArrowRight className="h-3.5 w-3.5" />
    </button>
  );
}

// ---------------------------------------------------------------------------
// Devices panel — paired devices + quick actions via the command queue
// ---------------------------------------------------------------------------

function DevicesPanel() {
  const fetchDevices = useServerFn(listDevices);
  const queueCommand = useServerFn(sendDeviceCommand);
  const [message, setMessage] = useState("");

  const devices = useQuery({
    queryKey: ["holo", "devices"],
    queryFn: () => fetchDevices({}),
    staleTime: 30_000,
  });

  const send = useMutation({
    mutationFn: (v: { deviceId: string; kind: "vibrate" | "say" | "notify"; command: string }) =>
      queueCommand({ data: v }),
    onSuccess: () => toast.success("Command queued"),
    onError: (e: Error) => toast.error(e.message),
  });

  const list = devices.data ?? [];

  return (
    <div className="space-y-3">
      <input
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Message for Say / Notify…"
        aria-label="Message for say or notify"
        className="holo-input w-full rounded-xl px-3 py-2 text-xs"
      />
      {devices.isPending && <p className="holo-shimmer text-xs text-slate-300/70">Scanning devices…</p>}
      {devices.isError && (
        <p className="text-xs text-slate-300/70">Couldn't load devices right now.</p>
      )}
      {!devices.isPending && !devices.isError && list.length === 0 && (
        <p className="text-xs leading-relaxed text-slate-300/70">
          No paired devices yet. Pair one from the Devices page to control it from here.
        </p>
      )}
      {list.map((d) => (
        <div key={d.id} className="rounded-xl border border-white/10 bg-white/5 p-2.5">
          <p className="mb-2 truncate text-xs font-bold text-slate-100">{d.name}</p>
          <div className="grid grid-cols-3 gap-1.5">
            <button
              type="button"
              disabled={send.isPending}
              onClick={() => {
                buzz(25);
                send.mutate({ deviceId: d.id, kind: "vibrate", command: "vibrate" });
              }}
              className="holo-action-btn flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold"
            >
              <Vibrate className="h-3.5 w-3.5" /> Vibrate
            </button>
            <button
              type="button"
              disabled={send.isPending || !message.trim()}
              onClick={() => {
                buzz(25);
                send.mutate({ deviceId: d.id, kind: "say", command: message.trim() });
              }}
              className="holo-action-btn flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold"
            >
              <Volume2 className="h-3.5 w-3.5" /> Say
            </button>
            <button
              type="button"
              disabled={send.isPending || !message.trim()}
              onClick={() => {
                buzz(25);
                send.mutate({ deviceId: d.id, kind: "notify", command: message.trim() });
              }}
              className="holo-action-btn flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-[11px] font-bold"
            >
              <Bell className="h-3.5 w-3.5" /> Notify
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Self-contained styling (no shared CSS touched)
// ---------------------------------------------------------------------------

const HOLO_CSS = `
.holo-deck { background: #04070f; }
.holo-bg {
  position: absolute; inset: 0; pointer-events: none;
  background:
    radial-gradient(600px 600px at 20% 30%, rgba(0, 255, 255, 0.10), transparent 60%),
    radial-gradient(700px 700px at 80% 20%, rgba(255, 0, 255, 0.08), transparent 60%),
    radial-gradient(800px 800px at 50% 90%, rgba(80, 0, 255, 0.14), transparent 60%);
  animation: holoDrift 26s ease-in-out infinite alternate;
}
.holo-grid {
  position: absolute; inset: 0; pointer-events: none; opacity: 0.5;
  background-image:
    linear-gradient(rgba(0, 255, 255, 0.05) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0, 255, 255, 0.05) 1px, transparent 1px);
  background-size: 44px 44px;
  mask-image: radial-gradient(ellipse 90% 80% at 50% 40%, black 30%, transparent 100%);
  animation: holoGridPan 40s linear infinite;
}
@keyframes holoDrift {
  0% { transform: translate3d(-4%, -2%, 0) scale(1); }
  50% { transform: translate3d(3%, 4%, 0) scale(1.08); }
  100% { transform: translate3d(-2%, 3%, 0) scale(1.04); }
}
@keyframes holoGridPan {
  from { background-position: 0 0, 0 0; }
  to { background-position: 0 88px, 88px 0; }
}
.holo-title {
  background: linear-gradient(90deg, #67e8f9, #c084fc, #67e8f9);
  background-size: 200% auto;
  -webkit-background-clip: text; background-clip: text; color: transparent;
  animation: holoShine 6s linear infinite;
  text-shadow: 0 0 24px rgba(103, 232, 249, 0.25);
}
@keyframes holoShine { to { background-position: 200% center; } }
.holo-chip {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(103, 232, 249, 0.35);
  color: #a5f3fc; backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px);
  box-shadow: 0 0 16px rgba(103, 232, 249, 0.15);
}
.holo-chip:active { transform: scale(0.96); }
.holo-panel {
  background: rgba(10, 18, 32, 0.55);
  backdrop-filter: blur(18px) saturate(140%);
  -webkit-backdrop-filter: blur(18px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.55), inset 0 1px 0 rgba(255, 255, 255, 0.08);
  transition: box-shadow 0.25s ease;
}
.holo-accent-cyan { border-color: rgba(34, 211, 238, 0.35); box-shadow: 0 18px 50px rgba(0,0,0,0.55), 0 0 22px rgba(34, 211, 238, 0.18), inset 0 1px 0 rgba(255,255,255,0.08); }
.holo-accent-violet { border-color: rgba(167, 139, 250, 0.35); box-shadow: 0 18px 50px rgba(0,0,0,0.55), 0 0 22px rgba(167, 139, 250, 0.18), inset 0 1px 0 rgba(255,255,255,0.08); }
.holo-accent-emerald { border-color: rgba(52, 211, 153, 0.35); box-shadow: 0 18px 50px rgba(0,0,0,0.55), 0 0 22px rgba(52, 211, 153, 0.18), inset 0 1px 0 rgba(255,255,255,0.08); }
.holo-accent-amber { border-color: rgba(251, 191, 36, 0.35); box-shadow: 0 18px 50px rgba(0,0,0,0.55), 0 0 22px rgba(251, 191, 36, 0.18), inset 0 1px 0 rgba(255,255,255,0.08); }
.holo-accent-fuchsia { border-color: rgba(232, 121, 249, 0.35); box-shadow: 0 18px 50px rgba(0,0,0,0.55), 0 0 22px rgba(232, 121, 249, 0.18), inset 0 1px 0 rgba(255,255,255,0.08); }
.holo-glyph { display: inline-flex; filter: drop-shadow(0 0 6px currentColor); }
.holo-glyph-cyan { color: #67e8f9; } .holo-glyph-violet { color: #a78bfa; }
.holo-glyph-emerald { color: #6ee7b7; } .holo-glyph-amber { color: #fcd34d; }
.holo-glyph-fuchsia { color: #e879f9; }
.holo-btn {
  background: linear-gradient(135deg, rgba(34, 211, 238, 0.22), rgba(168, 85, 247, 0.22));
  border: 1px solid rgba(103, 232, 249, 0.4); color: #e0faff;
  box-shadow: 0 0 18px rgba(34, 211, 238, 0.25);
  transition: transform 0.15s ease, box-shadow 0.2s ease;
}
.holo-btn:active { transform: scale(0.97); }
.holo-voice-btn {
  background: radial-gradient(circle at 50% 30%, rgba(232, 121, 249, 0.30), rgba(34, 211, 238, 0.12));
  border: 1px solid rgba(232, 121, 249, 0.45); color: #fae8ff;
  box-shadow: 0 0 28px rgba(232, 121, 249, 0.30);
  transition: transform 0.15s ease;
}
.holo-voice-btn:active { transform: scale(0.96); }
.holo-action-btn {
  background: rgba(255, 255, 255, 0.07);
  border: 1px solid rgba(167, 139, 250, 0.4); color: #ede9fe;
  transition: transform 0.15s ease;
}
.holo-action-btn:active { transform: scale(0.94); }
.holo-action-btn:disabled { opacity: 0.4; }
.holo-input {
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid rgba(255, 255, 255, 0.14); color: #f1f5f9;
}
.holo-input::placeholder { color: rgba(148, 163, 184, 0.7); }
.holo-input:focus { outline: none; border-color: rgba(103, 232, 249, 0.55); box-shadow: 0 0 12px rgba(103, 232, 249, 0.25); }
.holo-shimmer { animation: holoPulse 1.6s ease-in-out infinite; }
@keyframes holoPulse { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; } }
@media (prefers-reduced-motion: reduce) {
  .holo-bg, .holo-grid, .holo-title, .holo-shimmer { animation: none; }
}
`;
