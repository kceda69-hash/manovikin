// Landing-page DNA features: Reverse-Engineer workflow, DNA Prompt Editor,
// and Clone Verifier. All three call the public /api/public/demo-chat
// streaming endpoint — no auth, safe for the landing page.
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Workflow,
  Wand2,
  ShieldCheck,
  X,
  Loader2,
  RotateCcw,
  Save,
  Bot,
  GitBranch,
  Link2,
  FileCode,
} from "lucide-react";
import { Button } from "@/components/ui/button";

// ---------------- Shared streaming helper ----------------

async function streamDemo(
  body: Record<string, unknown>,
  onChunk: (acc: string) => void,
  signal: AbortSignal,
): Promise<string> {
  const res = await fetch("/api/public/demo-chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!res.ok || !res.body) {
    const detail = (await res.text().catch(() => "")).slice(0, 240);
    throw new Error(
      res.status === 429
        ? "Rate limited — try again in a minute."
        : res.status === 402
          ? "Demo credits recharging. Sign in to use your own balance."
          : detail || `Request failed (${res.status})`,
    );
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let acc = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    acc += decoder.decode(value, { stream: true });
    onChunk(acc);
  }
  acc += decoder.decode();
  onChunk(acc);
  return acc;
}

// ============================================================
// 1. Reverse-Engineer Panel
// ============================================================
// Takes a repo URL, description, or pasted code and streams a
// structured requirements/architecture/change-plan report.
// Purely planning — never emits implementation code.
export function DnaPromptEditor({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState<DnaModeId>("build");
  const [drafts, setDrafts] = useState<DnaOverrides>(() => readOverrides());
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (open) {
      setDrafts(readOverrides());
      setDirty(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    return () => window.removeEventListener("keydown", onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const current = drafts[active] ?? "";

  const save = () => {
    writeOverrides(drafts);
    setDirty(false);
    toast.success("DNA prompts saved");
  };
  const resetMode = () => {
    const next = { ...drafts };
    delete next[active];
    setDrafts(next);
    setDirty(true);
  };
  const resetAll = () => {
    setDrafts({});
    setDirty(true);
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="DNA Prompt Editor"
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-3xl rounded-2xl border border-border/60 bg-card shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between border-b border-border/60 p-4">
          <div className="inline-flex items-center gap-2">
            <Wand2 className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">DNA Prompt Editor</div>
              <div className="text-[11px] text-muted-foreground">
                Override MANOVIK's brain — appended to the safety-preserving base prompt.
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-card/60 hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 border-b border-border/60 bg-card/40 p-2">
          {DNA_MODE_META.map((m) => {
            const isActive = active === m.id;
            const hasOverride = Boolean(drafts[m.id]);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => setActive(m.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  isActive
                    ? "bg-aurora text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {m.label}
                {hasOverride && (
                  <span
                    aria-label="Overridden"
                    className={`inline-block h-1.5 w-1.5 rounded-full ${
                      isActive ? "bg-primary-foreground" : "bg-primary"
                    }`}
                  />
                )}
              </button>
            );
          })}
        </div>

        <div className="p-4">
          <label className="text-[11px] text-muted-foreground">
            System prompt override for <span className="text-primary">{active}</span> mode
          </label>
          <textarea
            value={current}
            onChange={(e) => {
              const v = e.target.value.slice(0, 4000);
              setDrafts((d) => ({ ...d, [active]: v }));
              setDirty(true);
            }}
            rows={12}
            placeholder={`e.g. "Reply in a terse, senior-engineer voice. Use Bun instead of Node. Prefer PostgreSQL."`}
            className="mt-2 w-full resize-y rounded-lg bg-background/40 border border-border/60 px-3 py-2 text-xs font-mono outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
          />
          <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
            <span>
              {current.length}/4000 chars · Empty = use MANOVIK default for this mode.
            </span>
            <span>
              Safety rules (no malware, refuse unsafe requests) always apply.
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/60 bg-card/40 p-3">
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={resetMode}>
              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reset this mode
            </Button>
            <Button size="sm" variant="ghost" onClick={resetAll}>
              Reset all
            </Button>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onClose}>
              Close
            </Button>
            <Button
              size="sm"
              disabled={!dirty}
              onClick={save}
              className="bg-aurora text-primary-foreground disabled:opacity-50"
            >
              <Save className="mr-1 h-3.5 w-3.5" /> Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// 3. Clone Verifier (button + inline report)
// ============================================================
// Given the original spec and the generated files from a clone-mode run,
// asks MANOVIK to score parity and emit a parity test plan.

export function CloneVerifier({
  spec,
  files,
  disabled,
}: {
  spec: string;
  files: { path: string; content: string }[];
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => () => abortRef.current?.abort(), []);

  const run = async () => {
    if (!files.length) {
      toast.error("Run Clone-Exactly mode first — no generated files to verify.");
      return;
    }
    setOpen(true);
    setOutput("");
    setErrorMsg(null);
    setStatus("streaming");
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamDemo(
        {
          mode: "verify",
          prompt: "Score parity between the spec and the generated files.",
          spec,
          files,
          model: "GPT-5.5",
        },
        setOutput,
        controller.signal,
      );
      setStatus("done");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setStatus("done");
        return;
      }
      const msg = (err as Error)?.message ?? "Network error";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    } finally {
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();
  const isStreaming = status === "streaming";

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        disabled={disabled || !files.length}
        onClick={run}
        className="border-primary/40 text-primary hover:bg-primary/10"
        title={
          files.length
            ? "Score generated files against the original spec"
            : "Run Clone-Exactly mode first to generate files"
        }
      >
        <ShieldCheck className="mr-1 h-3.5 w-3.5" /> Verify parity
      </Button>

      {open && (
        <div className="mt-3 rounded-xl border border-primary/30 bg-background/60 p-4 animate-fade-in">
          <div className="flex items-center justify-between mb-2">
            <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Clone parity report
              {isStreaming && <Loader2 className="h-3 w-3 animate-spin text-primary" />}
            </div>
            <div className="flex gap-2">
              {isStreaming ? (
                <Button size="sm" variant="outline" onClick={stop}>
                  Stop
                </Button>
              ) : (
                <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
                  Hide
                </Button>
              )}
            </div>
          </div>
          <div
            aria-live="polite"
            className="max-h-80 overflow-y-auto rounded-lg bg-background/70 border border-border/60 p-3 text-sm whitespace-pre-wrap font-mono text-foreground/90"
          >
            {errorMsg ? (
              <span className="text-destructive">{errorMsg}</span>
            ) : output ? (
              <>
                {output}
                {isStreaming && (
                  <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />
                )}
              </>
            ) : (
              <span className="text-muted-foreground">Scoring parity…</span>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ============================================================
// 4. Ship Pipeline (visual stages for the one-click ship flow)
// ============================================================

import { SHIP_PIPELINE_STAGES, type ShipStageId } from "./dna-storage";

export { SHIP_PIPELINE_STAGES };
export type { ShipStageId };


