import { useEffect, useRef, useState } from "react";
import { BOOT_SEQUENCE_DURATION_MS, buildBootSequence } from "@/lib/mano/boot-sequence";

interface BootSequenceProps {
  /** Called with 0..1 progress as the sequence plays. */
  onProgress?: (progress: number) => void;
  /** Called once when the sequence finishes (or is skipped). */
  onDone: () => void;
}

/**
 * Cinematic Jarvis-style boot terminal: system-check lines appear on a
 * staggered schedule with a progress bar. Tap anywhere to skip.
 * Respects prefers-reduced-motion by showing everything immediately.
 */
export function BootSequence({ onProgress, onDone }: BootSequenceProps) {
  const steps = useRef(buildBootSequence()).current;
  const [visibleCount, setVisibleCount] = useState(0);
  const doneRef = useRef(false);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;
  const onProgressRef = useRef(onProgress);
  onProgressRef.current = onProgress;

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      typeof window.matchMedia === "function" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) {
      setVisibleCount(steps.length);
      onProgressRef.current?.(1);
      onDoneRef.current();
      return;
    }

    doneRef.current = false;
    const timers: number[] = [];
    const start = Date.now();

    steps.forEach((step, i) => {
      timers.push(
        window.setTimeout(() => {
          if (doneRef.current) return;
          setVisibleCount(i + 1);
          onProgressRef.current?.(Math.min(1, (Date.now() - start) / BOOT_SEQUENCE_DURATION_MS));
        }, step.atMs),
      );
    });
    timers.push(
      window.setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        onProgressRef.current?.(1);
        onDoneRef.current();
      }, BOOT_SEQUENCE_DURATION_MS),
    );
    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
  }, [steps]);

  const skip = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    setVisibleCount(steps.length);
    onProgressRef.current?.(1);
    onDoneRef.current();
  };

  const progress = visibleCount / steps.length;

  return (
    <button
      type="button"
      onClick={skip}
      aria-label="Skip boot sequence"
      className="w-full max-w-xs cursor-pointer text-left"
    >
      <div
        className="rounded-lg border border-emerald-500/20 bg-black/60 p-4 font-mono text-xs leading-6"
        aria-live="polite"
      >
        {steps.slice(0, visibleCount).map((step) => (
          <div key={step.id} className="flex items-baseline justify-between gap-4">
            <span className="text-emerald-300/90">{step.label}</span>
            <span className="shrink-0 text-amber-300">{step.status}</span>
          </div>
        ))}
        {visibleCount < steps.length && (
          <span className="inline-block h-3.5 w-2 animate-pulse bg-emerald-400/80" aria-hidden />
        )}
      </div>
      <div
        className="mt-3 h-1 overflow-hidden rounded-full bg-white/10"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-400 to-amber-300 transition-[width] duration-200"
          style={{ width: `${progress * 100}%` }}
        />
      </div>
      <p className="mt-2 text-center text-[11px] text-muted-foreground">tap to skip</p>
    </button>
  );
}
