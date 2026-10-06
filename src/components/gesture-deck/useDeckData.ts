// Read-only data layer for the Gesture Deck.
// Every query reuses an existing server function — the same ones the chat,
// /missions, /agents and /holo pages call. No new backend endpoints.
import { useMemo } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { listMissions } from "@/lib/mano/agi.functions";
import { listSchedules } from "@/lib/schedules.functions";
import { listForceRuns, getForceRun } from "@/lib/force.functions";
import { listDevices, listDeviceCommands, type DeviceCommand } from "@/lib/devices.functions";
import type { DeckCardData, DeviceCommandKind } from "./deck-types";

// Minimal shapes for the loosely-typed server-function payloads we read.
interface MissionRun {
  id: string;
  goal: string | null;
  status: string;
  score: number | null;
  steps_used: number | null;
  created_at: string | null;
}

interface ScheduleRow {
  id: string;
  name: string | null;
  objective: string | null;
  mode: string;
  cadence: string;
  enabled: boolean | null;
  next_run_at: string | null;
  last_run_at: string | null;
  run_count: number | null;
}

interface ForceAction {
  label?: string | null;
  kind?: string | null;
  command?: string | null;
  risk?: string | null;
  why?: string | null;
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return "";
  const ms = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(ms) || ms < 0) return "";
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString("en-IN");
}

function truncate(s: string, n: number): string {
  const t = (s ?? "").trim();
  return t.length > n ? `${t.slice(0, n - 1)}…` : t;
}

const DEVICE_KINDS: DeviceCommandKind[] = ["shell", "open", "notify", "say", "script", "vibrate"];

function isDeviceKind(kind: string): kind is DeviceCommandKind {
  return (DEVICE_KINDS as string[]).includes(kind);
}

export interface DeckData {
  cards: DeckCardData[];
  isLoading: boolean;
  error: string | null;
  refetch: () => void;
  /** Most recently seen paired device — the approve target. Null when none. */
  pairedDeviceId: string | null;
}

export function useDeckData(): DeckData {
  const fetchMissions = useServerFn(listMissions);
  const fetchSchedules = useServerFn(listSchedules);
  const fetchForceRuns = useServerFn(listForceRuns);
  const fetchForceRun = useServerFn(getForceRun);
  const fetchDevices = useServerFn(listDevices);
  const fetchDeviceCommands = useServerFn(listDeviceCommands);

  const missionsQ = useQuery({
    queryKey: ["gesture-deck", "missions"],
    queryFn: () => fetchMissions(),
    staleTime: 30_000,
  });
  const schedulesQ = useQuery({
    queryKey: ["gesture-deck", "schedules"],
    queryFn: () => fetchSchedules(),
    staleTime: 30_000,
  });
  const forceRunsQ = useQuery({
    queryKey: ["gesture-deck", "force-runs"],
    queryFn: () => fetchForceRuns(),
    staleTime: 30_000,
  });

  const recentRunIds = useMemo(() => {
    const runs = forceRunsQ.data ?? [];
    return runs.slice(0, 4).map((r) => r.id);
  }, [forceRunsQ.data]);

  const forceDetailsQ = useQuery({
    queryKey: ["gesture-deck", "force-run-details", recentRunIds],
    queryFn: async () => {
      const details = await Promise.all(
        recentRunIds.map(async (id) => {
          try {
            return await fetchForceRun({ data: { id } });
          } catch {
            return null;
          }
        }),
      );
      return details.filter((d): d is NonNullable<typeof d> => d !== null);
    },
    enabled: recentRunIds.length > 0,
    staleTime: 30_000,
  });

  const devicesQ = useQuery({
    queryKey: ["gesture-deck", "devices"],
    queryFn: () => fetchDevices(),
    staleTime: 30_000,
  });

  const pairedDeviceId = useMemo(() => {
    const devices = devicesQ.data ?? [];
    const paired = devices.filter((d) => d.paired_at);
    paired.sort(
      (a, b) => new Date(b.last_seen_at ?? 0).getTime() - new Date(a.last_seen_at ?? 0).getTime(),
    );
    return paired[0]?.id ?? null;
  }, [devicesQ.data]);

  const deviceCommandsQ = useQuery({
    queryKey: ["gesture-deck", "device-commands", pairedDeviceId],
    queryFn: () => fetchDeviceCommands({ data: { deviceId: pairedDeviceId as string } }),
    enabled: pairedDeviceId !== null,
    staleTime: 30_000,
  });

  const cards = useMemo<DeckCardData[]>(() => {
    const out: DeckCardData[] = [];
    const missionRuns = (missionsQ.data?.runs ?? []) as unknown as MissionRun[];
    const scheduleRows = (schedulesQ.data?.schedules ?? []) as unknown as ScheduleRow[];
    const deviceCommands = (deviceCommandsQ.data ?? []) as unknown as DeviceCommand[];

    // 1. Approval items — structured proposed actions from recent FORCE runs.
    // These carry the full command, so approving can call sendDeviceCommand
    // exactly like the chat does on "do 1 and 3".
    for (const detail of forceDetailsQ.data ?? []) {
      const run = detail.run;
      const actions = (Array.isArray(run.actions) ? run.actions : []) as ForceAction[];
      actions.slice(0, 6).forEach((a, idx) => {
        if (!a || !a.kind || !isDeviceKind(a.kind) || !a.command) return;
        out.push({
          id: `approval:${run.id}:${idx}`,
          kind: "approval",
          title: truncate(a.label || "Proposed action", 90),
          subtitle: `${a.kind} · ${a.risk || "unknown"}-risk`,
          meta: `${truncate(run.objective || "FORCE run", 60)} · ${timeAgo(run.created_at)}`,
          details: [
            { label: "Action", value: a.label || "—" },
            { label: "Kind", value: a.kind },
            { label: "Risk", value: a.risk || "—" },
            { label: "Why", value: a.why || "—" },
            { label: "Command", value: a.command },
            { label: "From", value: truncate(run.objective || "FORCE run", 120) },
          ],
          approve: { kind: a.kind, command: a.command },
        });
      });
      if (out.length >= 12) break;
    }

    // 2. Missions — recent AGI runs, read-only.
    for (const m of missionRuns.slice(0, 8)) {
      out.push({
        id: `mission:${m.id}`,
        kind: "mission",
        title: truncate(m.goal || "Mission", 90),
        subtitle: `mission · ${m.status}`,
        meta: `${m.steps_used ?? 0} steps${m.score != null ? ` · score ${m.score}` : ""} · ${timeAgo(m.created_at)}`,
        details: [
          { label: "Goal", value: m.goal || "—" },
          { label: "Status", value: m.status },
          { label: "Steps used", value: String(m.steps_used ?? 0) },
          { label: "Score", value: m.score != null ? String(m.score) : "—" },
          { label: "Started", value: m.created_at ? new Date(m.created_at).toLocaleString("en-IN") : "—" },
        ],
      });
    }

    // 3. Routines / schedules.
    for (const s of scheduleRows.slice(0, 8)) {
      out.push({
        id: `routine:${s.id}`,
        kind: "routine",
        title: truncate(s.name || "Routine", 90),
        subtitle: `routine · ${s.cadence}${s.enabled ? "" : " · paused"}`,
        meta: `${s.run_count ?? 0} runs · next ${s.next_run_at ? timeAgo(s.next_run_at) : "—"}`,
        details: [
          { label: "Name", value: s.name || "—" },
          { label: "Objective", value: s.objective || "—" },
          { label: "Mode", value: s.mode },
          { label: "Cadence", value: s.cadence },
          { label: "Enabled", value: s.enabled ? "yes" : "paused" },
          { label: "Last run", value: s.last_run_at ? new Date(s.last_run_at).toLocaleString("en-IN") : "—" },
        ],
      });
    }

    // 4. Recent device activity on the most recently seen paired device.
    for (const c of deviceCommands.slice(0, 6)) {
      out.push({
        id: `device:${c.id}`,
        kind: "device",
        title: truncate(c.command || c.kind, 90),
        subtitle: `device · ${c.kind} · ${c.status}`,
        meta: timeAgo(c.created_at),
        details: [
          { label: "Kind", value: c.kind },
          { label: "Command", value: c.command || "—" },
          { label: "Status", value: c.status },
          { label: "Result", value: truncate(c.result || "—", 300) },
          { label: "Ran", value: c.created_at ? new Date(c.created_at).toLocaleString("en-IN") : "—" },
        ],
      });
    }

    return out;
  }, [forceDetailsQ.data, missionsQ.data, schedulesQ.data, deviceCommandsQ.data]);

  const isLoading =
    missionsQ.isLoading || schedulesQ.isLoading || forceRunsQ.isLoading || devicesQ.isLoading;
  const error =
    missionsQ.error ?? schedulesQ.error ?? forceRunsQ.error ?? devicesQ.error
      ? "Some deck data failed to load — showing what we could fetch."
      : null;

  return {
    cards,
    isLoading,
    error,
    pairedDeviceId,
    refetch: () => {
      missionsQ.refetch();
      schedulesQ.refetch();
      forceRunsQ.refetch();
      devicesQ.refetch();
    },
  };
}
