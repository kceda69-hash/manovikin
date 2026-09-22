import { useCallback, useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { bootDisplayName, type BootUser } from "@/lib/boot-greeting";

type WakePhase = "boot" | "ready" | "awake" | "done";

interface WakeScreenProps {
  user: BootUser | null | undefined;
  justLoggedIn: boolean;
  onWake: (voiceMode: boolean) => void;
  onDismiss: () => void;
}

function speak(text: string): boolean {
  try {
    if (typeof window === "undefined" || !("speechSynthesis" in window)) return false;
    window.speechSynthesis.cancel();
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = navigator.language || "en-US";
    utter.rate = 1.03;
    window.speechSynthesis.speak(utter);
    return true;
  } catch {
    return false;
  }
}

/**
 * Jarvis-style wake screen. Appears automatically on app open (and after login),
 * one tap wakes MANO: she speaks the greeting aloud, then voice companion mode
 * starts listening. A tap is required because browsers block audio before the
 * first user gesture — this is the closest honest equivalent to auto-wake.
 */
export function WakeScreen({ user, justLoggedIn, onWake, onDismiss }: WakeScreenProps) {
  const [phase, setPhase] = useState<WakePhase>("boot");
  const name = bootDisplayName(user);
  const greeting = name ? `MANO online, ${name}` : "MANO online. What are we working on?";
  const spokenGreeting = justLoggedIn
    ? name
      ? `Welcome back, ${name}. MANO online and ready.`
      : "Welcome back. MANO online and ready."
    : greeting;
  const timers = useRef<number[]>([]);

  useEffect(() => {
    timers.current.push(window.setTimeout(() => setPhase("ready"), 1400));
    return () => {
      timers.current.forEach((t) => window.clearTimeout(t));
      timers.current = [];
    };
  }, []);

  const wake = useCallback(
    (voiceMode: boolean) => {
      setPhase("awake");
      speak(spokenGreeting);
      timers.current.push(
        window.setTimeout(() => {
          setPhase("done");
          onWake(voiceMode);
        }, 1800),
      );
    },
    [onWake, spokenGreeting],
  );

  if (phase === "done") return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="MANO waking up"
    >
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span
          className={`absolute inset-0 rounded-full border-2 border-primary/40 ${
            phase === "boot" ? "animate-ping" : ""
          }`}
          aria-hidden
        />
        <span
          className={`absolute inset-4 rounded-full border border-primary/60 ${
            phase === "awake" ? "animate-ping" : ""
          }`}
          aria-hidden
        />
        <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary/15 text-2xl font-bold text-primary">
          M
        </span>
      </div>

      <h1 className="mt-8 text-center text-2xl font-semibold tracking-tight">
        {phase === "boot" ? "Initializing MANO…" : greeting}
      </h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        {phase === "boot"
          ? "Loading companion systems"
          : phase === "awake"
            ? "Good to see you."
            : "Tap to wake her up — she'll greet you out loud."}
      </p>

      {phase !== "boot" && (
        <div className="mt-8 flex flex-col items-center gap-3">
          <Button
            type="button"
            size="lg"
            onClick={() => wake(true)}
            className="h-14 min-h-[56px] rounded-full px-8 text-base"
          >
            <Mic className="mr-2 h-5 w-5" aria-hidden />
            Wake up, MANO
          </Button>
          <button
            type="button"
            onClick={() => {
              setPhase("done");
              onDismiss();
            }}
            className="text-sm text-muted-foreground underline-offset-4 hover:underline"
          >
            Continue quietly
          </button>
        </div>
      )}
    </div>
  );
}
