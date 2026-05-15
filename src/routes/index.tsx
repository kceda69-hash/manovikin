import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Code2, Zap, Shield, Brain, ArrowRight } from "lucide-react";
import logo from "@/assets/nova-x-logo.webp";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "MANOVIK AI — Your Autonomous AI Employee" },
      {
        name: "description",
        content:
          "MANOVIK AI is a futuristic AI agent that codes in any language, builds websites, apps, APIs, and works for you 24/7.",
      },
      { property: "og:title", content: "MANOVIK AI — Your Autonomous AI Employee" },
      { property: "og:description", content: "Futuristic AI agent that codes, builds, and ships." },
      { property: "og:url", content: "https://manovikin.lovable.app/" },
    ],
    links: [
      { rel: "canonical", href: "https://manovikin.lovable.app/" },
      { rel: "preload", as: "image", href: logo, fetchpriority: "high" },
    ],
  }),
});

const ROTATING_WORDS = ["websites", "apps", "APIs", "agents", "anything"];

function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [wordIdx, setWordIdx] = useState(0);

  // Defer auth check — keeps landing TTI tiny.
  useEffect(() => {
    let cancelled = false;
    const t = window.setTimeout(() => {
      import("@/integrations/supabase/client").then(({ supabase }) => {
        if (cancelled) return;
        supabase.auth.getSession().then(({ data }) => {
          if (!cancelled && data.session?.user) navigate({ to: "/chat" });
        });
      });
    }, 50);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [navigate]);

  // Rotating headline word.
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setWordIdx((i) => (i + 1) % ROTATING_WORDS.length), 2200);
    return () => window.clearInterval(id);
  }, []);

  // Pointer-driven aurora glow (rAF-throttled, GPU transforms only).
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    let raf = 0;
    let tx = 50, ty = 30;
    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      tx = ((e.clientX - r.left) / r.width) * 100;
      ty = ((e.clientY - r.top) / r.height) * 100;
      if (!raf) {
        raf = requestAnimationFrame(() => {
          el.style.setProperty("--mx", `${tx}%`);
          el.style.setProperty("--my", `${ty}%`);
          raf = 0;
        });
      }
    };
    el.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      el.removeEventListener("pointermove", onMove);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  return (
    <main ref={heroRef} className="hero-surface relative min-h-screen overflow-hidden">
      {/* Animated mesh + grid backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-grid opacity-[0.18]" />
        <div className="absolute inset-0 mesh-aurora" />
        <div className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-aurora opacity-25 blur-3xl animate-blob" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl animate-blob-slow" />
        <div className="absolute top-1/3 left-[-100px] h-[360px] w-[360px] rounded-full bg-accent/20 blur-3xl animate-blob-slower" />
        <div className="cursor-glow" />
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex">
            <span className="absolute inset-0 -z-10 rounded-full bg-aurora opacity-60 blur-md animate-pulse-glow" />
            <img
              src={logo}
              alt="MANOVIK AI logo"
              width={36}
              height={36}
              className="h-9 w-9 animate-float"
            />
          </span>
          <span className="text-lg font-bold tracking-wider text-gradient text-shimmer">
            MANOVIK AI
          </span>
        </div>
        <Link to="/login">
          <Button variant="outline" className="border-primary/40 bg-card/40 backdrop-blur hover-scale">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Autonomous AI agent · online
        </div>

        <h1
          className="text-balance text-5xl font-bold leading-tight tracking-tight md:text-7xl animate-fade-in"
          style={{ animationDelay: "60ms", animationFillMode: "both" }}
        >
          Meet <span className="text-gradient text-shimmer">MANOVIK AI</span>
          <br />
          that builds{" "}
          <span className="relative inline-block align-baseline">
            <span key={wordIdx} className="inline-block text-gradient animate-word-swap">
              {ROTATING_WORDS[wordIdx]}
            </span>
            <span className="caret" aria-hidden="true" />
          </span>
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl animate-fade-in"
          style={{ animationDelay: "180ms", animationFillMode: "both" }}
        >
          A futuristic agent that writes code in any language, builds websites, apps, and APIs,
          and gets the job done — autonomously.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-in"
          style={{ animationDelay: "300ms", animationFillMode: "both" }}
        >
          <Link to="/login">
            <Button
              size="lg"
              className="group relative overflow-hidden bg-aurora text-primary-foreground glow hover:opacity-95"
            >
              <span className="relative z-10 inline-flex items-center">
                Launch MANOVIK AI
                <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
              <span className="btn-sheen" aria-hidden="true" />
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {[
            { icon: Code2, title: "Polyglot coder", desc: "Ships production code in any language or stack." },
            { icon: Brain, title: "Reasoning core", desc: "Plans, breaks down, and executes complex tasks." },
            { icon: Zap, title: "Streaming fast", desc: "Real-time responses, no waiting around." },
            { icon: Shield, title: "Private threads", desc: "Your conversations are yours — encrypted at rest." },
            { icon: Sparkles, title: "Markdown native", desc: "Beautiful code blocks, tables, and rich output." },
            { icon: Brain, title: "Memory across threads", desc: "Organized conversations you can revisit." },
          ].map((f, i) => (
            <div
              key={f.title}
              className="surface-card tilt-card group relative overflow-hidden rounded-xl p-5 text-left animate-fade-in"
              style={{ animationDelay: `${380 + i * 70}ms`, animationFillMode: "both" }}
            >
              <span className="card-border-glow" aria-hidden="true" />
              <f.icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
              <h2 className="mt-3 font-semibold">{f.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        Powered by Lovable AI · Built for builders
      </footer>
    </main>
  );
}
