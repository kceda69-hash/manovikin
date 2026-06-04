import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Code2, Zap, Shield, Brain, ArrowRight, Globe, Workflow, Terminal, Check, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/nova-x-logo.webp";
import { startCheckout, type CheckoutPlan } from "@/lib/razorpay-checkout";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "MANOVIK AI — Autonomous AI Employee for Apps & APIs" },
      {
        name: "description",
        content:
          "MANOVIK AI is an autonomous coding agent that builds apps, APIs, and automations 24/7. Pro plan ₹699/mo (10% off). Lifetime self-host ₹4999 (20% off). Made in India.",
      },
      { name: "keywords", content: "AI coding agent, autonomous AI, MANOVIK, build apps with AI, AI APIs, self-hosted AI, Indian AI startup" },
      { property: "og:title", content: "MANOVIK AI — Autonomous AI Employee for Apps & APIs" },
      { property: "og:description", content: "Codes, builds, and ships software 24/7. Pro ₹699/mo · Sovereign lifetime ₹4999." },
      { property: "og:url", content: "https://manovik.in/" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "canonical", href: "https://manovik.in/" },
      { rel: "preload", as: "image", href: logo, fetchpriority: "high" },
      { rel: "dns-prefetch", href: "https://checkout.razorpay.com" },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Product",
              name: "MANOVIK AI Pro",
              description: "Unlimited messages and priority models for builders shipping daily.",
              brand: { "@type": "Brand", name: "MANOVIK AI" },
              offers: { "@type": "Offer", price: "699", priceCurrency: "INR", availability: "https://schema.org/InStock", url: "https://manovik.in/#pricing" },
            },
            {
              "@type": "Product",
              name: "MANOVIK AI Sovereign (Lifetime Self-Host)",
              description: "Run MANOVIK on your own infrastructure forever. One-time payment.",
              brand: { "@type": "Brand", name: "MANOVIK AI" },
              offers: { "@type": "Offer", price: "4999", priceCurrency: "INR", availability: "https://schema.org/InStock", url: "https://manovik.in/#pricing" },
            },
            {
              "@type": "FAQPage",
              mainEntity: [
                { "@type": "Question", name: "What is MANOVIK AI?", acceptedAnswer: { "@type": "Answer", text: "MANOVIK is an autonomous AI agent that codes, builds, and ships software for you." } },
                { "@type": "Question", name: "Which languages does it support?", acceptedAnswer: { "@type": "Answer", text: "Any major language — JavaScript, TypeScript, Python, Go, Rust, Java, Swift, Kotlin, SQL and more." } },
                { "@type": "Question", name: "Can I run MANOVIK on my own server?", acceptedAnswer: { "@type": "Answer", text: "Yes. The Sovereign lifetime plan (₹4999, 20% off) includes the self-host setup wizard, Docker support, and BYOK." } },
                { "@type": "Question", name: "Is my data private?", acceptedAnswer: { "@type": "Answer", text: "Threads are encrypted at rest and never used to train third-party models." } },
              ],
            },
          ],
        }),
      },
    ],
  }),
});

const ROTATING_WORDS = ["websites", "apps", "APIs", "agents", "anything"];

const TOUR = [
  {
    icon: Globe,
    label: "Apps",
    title: "Build full-stack apps",
    desc: "MANOVIK scaffolds the UI, wires the database, and ships auth — all from one prompt.",
    lines: [
      "› manovik build \"task tracker with auth\"",
      "✓ Planning routes & schema…",
      "✓ Generating React + Tailwind UI",
      "✓ Wiring Supabase auth + RLS",
      "✓ Deployed → https://yourapp.live",
    ],
  },
  {
    icon: Terminal,
    label: "APIs",
    title: "Spin up production APIs",
    desc: "REST or RPC endpoints, typed validators, rate-limits and logs included.",
    lines: [
      "› manovik api \"POST /invoice with stripe\"",
      "✓ Zod validator generated",
      "✓ Stripe SDK integrated",
      "✓ Tests passing (12/12)",
      "✓ Live at /api/invoice",
    ],
  },
  {
    icon: Workflow,
    label: "Automations",
    title: "Automate everything",
    desc: "Cron jobs, webhooks, AI workflows — MANOVIK glues your tools together.",
    lines: [
      "› manovik automate \"slack daily report\"",
      "✓ Fetching analytics @ 9am IST",
      "✓ Summarizing with GPT",
      "✓ Posting to #growth",
      "✓ Scheduled · cron(0 9 * * *)",
    ],
  },
];

type Pricing = {
  id: "free" | "pro" | "sovereign";
  name: string;
  price: string;
  /** Strikethrough original price, shown when there's a discount. */
  originalPrice?: string;
  /** Percent off (e.g. 10, 20). When set, an animated badge is rendered. */
  discountPct?: number;
  period: string;
  desc: string;
  features: string[];
  cta: string;
  highlight: boolean;
};

const PRICING: Pricing[] = [
  {
    id: "free",
    name: "Free",
    price: "₹0",
    period: "forever",
    desc: "Perfect to try out MANOVIK.",
    features: ["50 messages / month", "All core models", "Private threads", "Community support"],
    cta: "Start free",
    highlight: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: "₹699",
    originalPrice: "₹777",
    discountPct: 10,
    period: "/month",
    desc: "For builders shipping daily.",
    features: ["Unlimited messages", "Priority models (GPT-5, Gemini Pro)", "File uploads", "Email support"],
    cta: "Go Pro",
    highlight: true,
  },
  {
    id: "sovereign",
    name: "Sovereign",
    price: "₹4999",
    originalPrice: "₹6249",
    discountPct: 20,
    period: "lifetime",
    desc: "One-time payment. Run MANOVIK on your own infra forever.",
    features: ["Bring your own keys", "Ollama / OpenAI / Groq", "Zero vendor lock-in", "Setup wizard + Docker", "Lifetime updates"],
    cta: "Buy lifetime",
    highlight: false,
  },
];

const FAQ = [
  { q: "What is MANOVIK AI?", a: "MANOVIK is an autonomous AI agent that codes, builds, and ships software for you. Think of it as a digital employee that turns ideas into working products." },
  { q: "Which languages does it support?", a: "Any major language — JavaScript, TypeScript, Python, Go, Rust, Java, Swift, Kotlin, SQL and more. It picks the right stack for the job." },
  { q: "Can I run MANOVIK on my own server?", a: "Yes. MANOVIK is sovereign-ready. Use the in-app /setup wizard to deploy with Docker, your own database, and any OpenAI-compatible model (Ollama, Groq, OpenAI)." },
  { q: "Is my data private?", a: "Threads are encrypted at rest and never used to train third-party models. In sovereign mode, your data never leaves your infrastructure." },
  { q: "Do I need to know how to code?", a: "No. Describe what you want in plain English and MANOVIK handles the rest — planning, coding, testing, and deployment." },
];

function Landing() {
  const navigate = useNavigate();
  const heroRef = useRef<HTMLDivElement>(null);
  const [wordIdx, setWordIdx] = useState(0);
  const [tourIdx, setTourIdx] = useState(0);
  const [faqOpen, setFaqOpen] = useState<number | null>(0);
  const [buying, setBuying] = useState<CheckoutPlan | null>(null);

  const handleBuy = (plan: CheckoutPlan) => {
    if (buying) return;
    setBuying(plan);
    startCheckout(plan, {
      onSuccess: (paymentId) => {
        setBuying(null);
        toast.success("Payment successful!", { description: `ID: ${paymentId}` });
        navigate({ to: "/chat" });
      },
      onError: (msg) => {
        setBuying(null);
        toast.error(msg);
      },
      onDismiss: () => setBuying(null),
    });
  };

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

  // Auto-cycle interactive feature tour
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) return;
    const id = window.setInterval(() => setTourIdx((i) => (i + 1) % 3), 4200);
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
        {/* Orbiting particles */}
        <div className="orbit-wrap" aria-hidden="true">
          <div className="orbit orbit-1"><span /></div>
          <div className="orbit orbit-2"><span /></div>
          <div className="orbit orbit-3"><span /></div>
        </div>
        {/* Scanline shimmer */}
        <div className="scanline" aria-hidden="true" />
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

        {/* Interactive Feature Tour */}
        <div className="mt-24 text-left">
          <div className="text-center mb-8 animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold">See MANOVIK in action</h2>
            <p className="mt-2 text-muted-foreground">One agent. Three superpowers. Click to explore.</p>
          </div>
          <div className="surface-card relative overflow-hidden rounded-2xl p-2 md:p-3">
            <span className="card-border-glow" aria-hidden="true" />
            {/* Tabs */}
            <div className="flex gap-1 p-2 border-b border-border/40">
              {TOUR.map((t, i) => (
                <button
                  key={t.label}
                  onClick={() => setTourIdx(i)}
                  className={`relative flex-1 inline-flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium transition-all ${
                    tourIdx === i
                      ? "bg-aurora text-primary-foreground shadow-lg"
                      : "text-muted-foreground hover:text-foreground hover:bg-card/60"
                  }`}
                >
                  <t.icon className="h-4 w-4" />
                  <span>{t.label}</span>
                  {tourIdx === i && (
                    <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-primary-foreground/60 rounded-full animate-tour-progress" />
                  )}
                </button>
              ))}
            </div>
            {/* Panel */}
            <div key={tourIdx} className="grid md:grid-cols-2 gap-6 p-5 md:p-8 animate-tour-fade">
              <div>
                <div className="inline-flex items-center gap-2 text-primary text-xs uppercase tracking-wider mb-3">
                  {(() => { const Icon = TOUR[tourIdx].icon; return <Icon className="h-4 w-4" />; })()}
                  {TOUR[tourIdx].label}
                </div>
                <h3 className="text-2xl md:text-3xl font-bold">{TOUR[tourIdx].title}</h3>
                <p className="mt-3 text-muted-foreground">{TOUR[tourIdx].desc}</p>
                <Link to="/login">
                  <Button variant="outline" className="mt-5 border-primary/40 hover-scale">
                    Try it now <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </Link>
              </div>
              {/* Mock terminal */}
              <div className="rounded-xl bg-[oklch(0.1_0.02_275)] border border-border/60 overflow-hidden shadow-2xl">
                <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/40 bg-card/40">
                  <span className="h-2.5 w-2.5 rounded-full bg-red-500/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-yellow-500/70" />
                  <span className="h-2.5 w-2.5 rounded-full bg-green-500/70" />
                  <span className="ml-2 text-[10px] text-muted-foreground font-mono">manovik · live</span>
                </div>
                <pre className="p-4 text-xs md:text-sm font-mono leading-relaxed text-foreground/90 overflow-hidden">
                  {TOUR[tourIdx].lines.map((line, i) => (
                    <div
                      key={i}
                      className="animate-tour-line"
                      style={{ animationDelay: `${i * 280}ms`, animationFillMode: "both" }}
                    >
                      {line.startsWith("✓") ? <span className="text-primary">{line}</span> : line}
                    </div>
                  ))}
                </pre>
              </div>
            </div>
          </div>
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

        {/* Pricing */}
        <div id="pricing" className="mt-24 scroll-mt-20">
          <div className="text-center animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold">Simple pricing</h2>
            <p className="mt-2 text-muted-foreground">Start free. Upgrade when you outgrow it.</p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-3 text-left">
            {PRICING.map((p, i) => (
              <div
                key={p.name}
                className={`surface-card tilt-card relative overflow-hidden rounded-2xl p-6 animate-fade-in ${
                  p.highlight ? "price-card-featured ring-2 ring-primary/60 md:scale-105" : ""
                }`}
                style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
              >
                {p.highlight && (
                  <span className="sparkle-field" aria-hidden="true">
                    {Array.from({ length: 10 }).map((_, k) => (
                      <i
                        key={k}
                        style={{
                          left: `${(k * 9 + 5) % 100}%`,
                          animationDuration: `${5 + (k % 5)}s`,
                          animationDelay: `${(k * 0.6) % 5}s`,
                        }}
                      />
                    ))}
                  </span>
                )}
                <span className="card-border-glow" aria-hidden="true" />
                {p.highlight && (
                  <span className="absolute top-4 right-4 rounded-full bg-aurora px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">
                    Popular
                  </span>
                )}
                {p.discountPct && (
                  <span
                    className="absolute -top-2 -left-2 z-10 rounded-full bg-gradient-to-r from-pink-500 via-rose-500 to-orange-400 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-white shadow-lg shadow-rose-500/40 ring-2 ring-background animate-bounce-soft"
                    aria-label={`${p.discountPct}% discount`}
                  >
                    <span className="relative inline-flex items-center gap-1">
                      <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                      Save {p.discountPct}%
                    </span>
                  </span>
                )}
                <div className="text-sm font-semibold text-primary">{p.name}</div>
                <div className="mt-2 flex items-baseline gap-2 flex-wrap">
                  {p.originalPrice && (
                    <span className="text-lg font-medium text-muted-foreground line-through decoration-rose-500/70 decoration-2">
                      {p.originalPrice}
                    </span>
                  )}
                  <span className="text-4xl font-bold price-liquid animate-price-pop">{p.price}</span>
                  <span className="text-sm text-muted-foreground">{p.period}</span>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{p.desc}</p>
                <ul className="mt-5 space-y-2.5">
                  {p.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                {p.id === "free" ? (
                  <Link to="/login" className="block mt-6">
                    <Button
                      className={`w-full ${p.highlight ? "bg-aurora text-primary-foreground glow hover:opacity-95" : ""}`}
                      variant={p.highlight ? "default" : "outline"}
                    >
                      {p.cta}
                    </Button>
                  </Link>
                ) : (
                  <Button
                    onClick={() => handleBuy(p.id as CheckoutPlan)}
                    disabled={buying !== null}
                    className={`w-full mt-6 ${p.highlight ? "bg-aurora text-primary-foreground glow hover:opacity-95" : ""}`}
                    variant={p.highlight ? "default" : "outline"}
                  >
                    {buying === p.id ? "Opening checkout…" : p.cta}
                  </Button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* FAQ */}
        <div className="mt-24">
          <div className="text-center animate-fade-in">
            <h2 className="text-3xl md:text-4xl font-bold">Questions, answered</h2>
            <p className="mt-2 text-muted-foreground">Everything you need to know about MANOVIK.</p>
          </div>
          <div className="mt-8 space-y-3 max-w-2xl mx-auto text-left">
            {FAQ.map((item, i) => {
              const open = faqOpen === i;
              return (
                <div
                  key={item.q}
                  className="surface-card relative overflow-hidden rounded-xl animate-fade-in"
                  style={{ animationDelay: `${i * 80}ms`, animationFillMode: "both" }}
                >
                  <button
                    onClick={() => setFaqOpen(open ? null : i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-card/40 transition-colors"
                    aria-expanded={open}
                  >
                    <span className="font-medium">{item.q}</span>
                    <ChevronDown
                      className={`h-5 w-5 text-primary shrink-0 transition-transform duration-300 ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-all duration-300 ease-out ${
                      open ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
                    }`}
                  >
                    <div className="overflow-hidden">
                      <p className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed">
                        {item.a}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
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
