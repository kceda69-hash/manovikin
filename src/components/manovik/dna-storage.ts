// Lightweight, dependency-free state for the DNA features.
//
// This lives apart from `dna-features.tsx` on purpose: the landing page needs
// `getDnaOverride` / `SHIP_PIPELINE_STAGES` synchronously, but the heavy
// panels are lazy-loaded. Keeping the tiny bits here means importing them
// does not drag the whole UI bundle into the initial chunk.
import { useEffect, useState } from "react";

export const DNA_MODE_META = [
  { id: "build", label: "Build" },
  { id: "reverse", label: "Reverse-Engineer" },
  { id: "clone", label: "Clone Exactly" },
  { id: "brain", label: "MANOVIK Brain" },
  { id: "ship-store", label: "One-Click Ship" },
] as const;

export type DnaModeId = (typeof DNA_MODE_META)[number]["id"];

const DNA_STORAGE_KEY = "manovik:dna-overrides";

export type DnaOverrides = Partial<Record<DnaModeId, string>>;

export function readOverrides(): DnaOverrides {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(DNA_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return typeof parsed === "object" && parsed ? (parsed as DnaOverrides) : {};
  } catch {
    return {};
  }
}

export function writeOverrides(o: DnaOverrides) {
  try {
    window.localStorage.setItem(DNA_STORAGE_KEY, JSON.stringify(o));
    window.dispatchEvent(new CustomEvent("manovik:dna-overrides-changed"));
  } catch {
    // ignore
  }
}

export function getDnaOverride(mode: DnaModeId): string {
  return readOverrides()[mode] ?? "";
}

export function useDnaOverride(mode: DnaModeId): string {
  const [val, setVal] = useState<string>(() => getDnaOverride(mode));
  useEffect(() => {
    const sync = () => setVal(getDnaOverride(mode));
    window.addEventListener("manovik:dna-overrides-changed", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("manovik:dna-overrides-changed", sync);
      window.removeEventListener("storage", sync);
    };
  }, [mode]);
  return val;
}

export const SHIP_PIPELINE_STAGES = [
  { id: "validate", label: "Validate inputs" },
  { id: "package", label: "Package deliverables" },
  { id: "sign", label: "Sign & preflight" },
  { id: "preview", label: "Ephemeral preview" },
  { id: "submit", label: "Submit to store" },
] as const;

export type ShipStageId = (typeof SHIP_PIPELINE_STAGES)[number]["id"];
