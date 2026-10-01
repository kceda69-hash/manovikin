/**
 * Jarvis-style boot sequence definition.
 *
 * Pure data + timing: the component in `components/mano/BootSequence.tsx`
 * reveals these lines on schedule. Keeping the steps here (instead of in the
 * component) makes the sequence unit-testable and easy to extend.
 *
 * The lines are system-status flavor ("power systems … online"), never a
 * recitation of MANOVIK's specifications.
 */

export interface BootStep {
  /** Stable id for React keys. */
  id: string;
  /** Left-hand label shown in the terminal. */
  label: string;
  /** Right-hand status word, shown in accent color. */
  status: string;
  /** Milliseconds after boot start when this line appears. */
  atMs: number;
}

export function buildBootSequence(): BootStep[] {
  return [
    { id: "os", label: "MANOVIK OS — cold start", status: "…", atMs: 0 },
    { id: "power", label: "Power systems", status: "ONLINE", atMs: 320 },
    { id: "neural", label: "Neural core", status: "ONLINE", atMs: 680 },
    { id: "memory", label: "Memory banks", status: "ONLINE", atMs: 1040 },
    { id: "voice", label: "Voice interface", status: "ONLINE", atMs: 1400 },
    { id: "sentinel", label: "Security sentinel", status: "ARMED", atMs: 1760 },
    { id: "nominal", label: "All systems nominal", status: "✓", atMs: 2120 },
  ];
}

/** Total boot time: last step plus a beat for the "all systems" line to land. */
export const BOOT_SEQUENCE_DURATION_MS = 2500;
