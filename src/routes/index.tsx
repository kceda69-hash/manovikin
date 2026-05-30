import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Code2, Zap, Shield, Brain, ArrowRight, Globe, Workflow, Terminal, Check, ChevronDown } from "lucide-react";
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
      <div className="pointer-events-none absolute inset-0 -z-10 [contain:paint]">
        <div className="absolute inset-0 bg-grid opacity-[0.18]" />
        <div className="absolute inset-0 mesh-aurora" />
        <div className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-aurora opacity-25 blur-3xl animate-blob" />
        <div className="absolute bottom-[-120px] right-[-80px] h-[420px] w-[420px] rounded-full bg-primary/25 blur-3xl animate-blob-slow" />
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
              fetchPriority="high"
              decoding="async"
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

        {/* How it works */}
        <div className="mt-24 grid gap-6 md:grid-cols-3 text-left">
          {[
            { step: "01", title: "Describe", desc: "Tell MANOVIK what to build — a site, an API, an agent, a script." },
            { step: "02", title: "Reason & Plan", desc: "It breaks the goal into steps, picks tools, and writes the code." },
            { step: "03", title: "Ship", desc: "Streaming output, instant preview, and production-ready files." },
          ].map((s, i) => (
            <div
              key={s.step}
              className="surface-card tilt-card relative overflow-hidden rounded-xl p-6 animate-fade-in"
              style={{ animationDelay: `${800 + i * 120}ms`, animationFillMode: "both" }}
            >
              <span className="card-border-glow" aria-hidden="true" />
              <div className="text-3xl font-bold text-gradient">{s.step}</div>
              <h3 className="mt-3 font-semibold text-lg">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>

        {/* Stats */}
        <div className="mt-20 grid grid-cols-2 gap-6 md:grid-cols-4">
          {[
            { k: "20+", v: "Languages" },
            { k: "24/7", v: "Always-on" },
            { k: "∞", v: "Private threads" },
            { k: "0ms", v: "Streams live" },
          ].map((s, i) => (
            <div
              key={s.v}
              className="surface-card rounded-xl p-5 text-center animate-fade-in hover-scale"
              style={{ animationDelay: `${1100 + i * 100}ms`, animationFillMode: "both" }}
            >
              <div className="text-3xl font-bold text-gradient text-shimmer">{s.k}</div>
              <div className="mt-1 text-xs uppercase tracking-wider text-muted-foreground">{s.v}</div>
            </div>
          ))}
        </div>

        {/* About MANOVIK */}
        <div
          className="surface-card mt-20 relative overflow-hidden rounded-2xl p-8 md:p-12 text-left animate-fade-in"
          style={{ animationDelay: "1500ms", animationFillMode: "both" }}
        >
          <span className="card-border-glow" aria-hidden="true" />
          <h2 className="text-3xl md:text-4xl font-bold text-gradient">Why MANOVIK?</h2>
          <p className="mt-4 text-muted-foreground md:text-lg leading-relaxed">
            MANOVIK AI is your autonomous digital employee. It doesn't just answer —
            it <span className="text-primary">plans</span>,{" "}
            <span className="text-primary">builds</span>, and{" "}
            <span className="text-primary">delivers</span>. From a one-line idea to a
            deployable product, MANOVIK reasons across files, calls tools, and ships
            real software. Sovereign-ready — run it on your own infrastructure, with
            your keys and your rules.
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {["Autonomous", "Sovereign", "Polyglot", "Streaming", "Private", "Made in 🇮🇳"].map((t) => (
              <span key={t} className="rounded-full border border-primary/30 bg-card/50 px-3 py-1 text-xs text-primary backdrop-blur">
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* Final CTA */}
        <div className="mt-20 text-center animate-fade-in" style={{ animationDelay: "1700ms", animationFillMode: "both" }}>
          <h2 className="text-3xl md:text-5xl font-bold">Ready to hire your AI employee?</h2>
          <p className="mt-4 text-muted-foreground">No setup. No limits. Just describe and ship.</p>
          <Link to="/login">
            <Button size="lg" className="mt-6 group relative overflow-hidden bg-aurora text-primary-foreground glow">
              <span className="relative z-10 inline-flex items-center">
                Start building free
                <ArrowRight className="ml-1 h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </span>
              <span className="btn-sheen" aria-hidden="true" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="relative z-10 border-t border-border/40 py-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-2 animate-fade-in">
          <span>Powered by</span>
          <span className="font-bold text-gradient text-shimmer">KC</span>
          <span className="inline-flex h-4 w-6 overflow-hidden rounded-sm shadow-sm ring-1 ring-border/60" aria-label="Indian flag" title="Made in India">
            <span className="flex-1 bg-[#FF9933]" />
            <span className="flex-1 bg-white relative flex items-center justify-center">
              <span className="h-1.5 w-1.5 rounded-full border border-[#000080]" />
            </span>
            <span className="flex-1 bg-[#138808]" />
          </span>
          <span>· Made in India with ❤️</span>
        </div>
      </footer>
    </main>
  );
}
