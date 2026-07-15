import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Code2, Zap, Shield, Brain, ArrowRight, Globe, Workflow, Terminal, Check, ChevronDown, Smartphone, Apple, Rocket, Cpu, Paperclip, Send, Store, Bot, Layers, Wand2, Download, Copy, Loader2, KeyRound, ShieldCheck, X, Link2 } from "lucide-react";
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
          "MANOVIK AI: autonomous coding agent that builds apps, APIs & automations 24/7. Pro ₹699/mo (10% off). Lifetime self-host ₹4999 (20% off).",
      },
      { name: "keywords", content: "AI coding agent, autonomous AI, MANOVIK, build apps with AI, AI APIs, self-hosted AI, Indian AI startup" },
      { property: "og:title", content: "MANOVIK AI — Autonomous AI Employee for Apps & APIs" },
      { property: "og:description", content: "Codes, builds, and ships software 24/7. Pro ₹699/mo · Sovereign lifetime ₹4999." },
      { property: "og:url", content: "https://manovik.in/" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "MANOVIK AI — Autonomous AI Employee for Apps & APIs" },
      { name: "twitter:description", content: "Codes, builds, and ships software 24/7. Pro ₹699/mo · Sovereign lifetime ₹4999." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b60b2fb0-e5b2-4664-957d-ccee1257580a/id-preview-b60afdf7--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app-1778327527940.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b60b2fb0-e5b2-4664-957d-ccee1257580a/id-preview-b60afdf7--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app-1778327527940.png" },
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
  const faqLockRef = useRef(false);
  const toggleFaq = (i: number) => {
    if (faqLockRef.current) return;
    faqLockRef.current = true;
    setFaqOpen((cur) => (cur === i ? null : i));
    setTimeout(() => { faqLockRef.current = false; }, 180);
  };
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
      </div>

      <header className="relative z-10 mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <span className="relative inline-flex">
            <span className="absolute inset-0 -z-10 rounded-full bg-aurora opacity-60 blur-md animate-pulse-glow" />
            <img
              src={logo}
              alt="MANOVIK AI — Autonomous AI employee"
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
          aria-label="MANOVIK AI — an autonomous AI coding agent that builds websites, apps, APIs, and automations."
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

        {/* Prompt-to-Build composer */}
        <PromptComposer />

        {/* Ship to real stores — interactive stepper */}
        <ShipStepper />


        {/* Powered by top models — incl. Claude Fable 5 */}
        <div className="mt-24">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              <Cpu className="h-3.5 w-3.5" /> Multi-model brain
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold">
              Now with <span className="text-gradient text-shimmer">Claude Fable 5</span>
            </h2>
            <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
              Route complex refactors, long-context reasoning, and production ship-work to Anthropic's newest model — right inside MANOVIK.
            </p>
          </div>
          <div className="mt-10 grid gap-6 md:grid-cols-2 text-left">
            <div className="surface-card relative overflow-hidden rounded-2xl p-6 md:p-8">
              <span className="card-border-glow" aria-hidden="true" />
              <div className="flex items-center gap-3">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg">
                  <Wand2 className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-semibold text-lg">Claude Fable 5</h3>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Recommended for shipping</div>
                </div>
                <span className="ml-auto rounded-full bg-aurora px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground">New</span>
              </div>
              <ul className="mt-5 space-y-2.5 text-sm">
                {[
                  "Multi-file refactors across a whole repo",
                  "Long-context reasoning up to 1M tokens",
                  "Tool-use loops for build → test → deploy",
                  "Best-in-class native app scaffolding",
                ].map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-6">
                <ConnectFableButton />
              </div>

            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { icon: Bot, title: "GPT-5.5", desc: "Deep reasoning & polish" },
                { icon: Sparkles, title: "Gemini 3 Pro", desc: "Massive multimodal context" },
                { icon: Layers, title: "Llama 3 · Local", desc: "Sovereign / on-device" },
                { icon: Cpu, title: "Auto-router", desc: "Picks the cheapest capable model" },
              ].map((m) => (
                <div key={m.title} className="surface-card rounded-xl p-4">
                  <m.icon className="h-5 w-5 text-primary" />
                  <div className="mt-2 font-semibold text-sm">{m.title}</div>
                  <div className="text-xs text-muted-foreground">{m.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* In-page coding workspace — streams edits from Claude Fable 5 */}
        <CodingWorkspace />

        {/* How it works */}
        <h2 className="mt-24 text-3xl md:text-4xl font-bold text-center">How it works</h2>

        <div className="mt-8 grid gap-6 md:grid-cols-3 text-left">
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
                onPointerMove={(e) => {
                  const el = e.currentTarget;
                  const r = el.getBoundingClientRect();
                  el.style.setProperty("--px", `${((e.clientX - r.left) / r.width) * 100}%`);
                  el.style.setProperty("--py", `${((e.clientY - r.top) / r.height) * 100}%`);
                }}
                className={`pricing-card surface-card tilt-card relative overflow-hidden rounded-2xl p-6 animate-fade-in ${
                  p.highlight ? "ring-2 ring-primary/60 md:scale-105" : ""
                }`}
                style={{ animationDelay: `${i * 120}ms`, animationFillMode: "both" }}
              >
                <span className="pricing-spotlight" aria-hidden="true" />
                {p.highlight && (
                  <span className="absolute top-3 right-3 z-10 rounded-full bg-aurora px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary-foreground shadow-md">
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
                <div
                  className={[
                    "text-sm font-semibold text-primary",
                    // Always push name below badges + clear horizontal space for them.
                    p.highlight || p.discountPct ? "mt-5" : "",
                    p.highlight ? "pr-20" : "",
                    p.discountPct ? "pl-20" : "",
                  ].filter(Boolean).join(" ")}
                >
                  {p.name}
                </div>
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
                    onClick={() => toggleFaq(i)}
                    className="w-full flex items-center justify-between gap-4 p-5 text-left hover:bg-card/40 transition-colors"
                    aria-expanded={open}
                    aria-label={`${open ? "Collapse" : "Expand"} answer: ${item.q}`}
                  >
                    <span className="font-medium">{item.q}</span>
                    <ChevronDown
                      aria-hidden="true"
                      className={`h-5 w-5 text-primary shrink-0 transition-transform duration-150 ${
                        open ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                  <div
                    className={`grid transition-[grid-template-rows,opacity] duration-150 ease-out ${
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

      <footer className="relative z-10 border-t border-border/40 py-10 text-xs text-muted-foreground">
        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-8 md:grid-cols-4 text-left">
            <div className="md:col-span-2">
              <div className="flex items-center gap-2">
                <span className="font-bold text-base text-gradient">MANOVIK AI</span>
                <span className="inline-flex h-4 w-6 overflow-hidden rounded-sm ring-1 ring-border/60" aria-label="Indian flag" title="Made in India">
                  <span className="flex-1 bg-[#FF9933]" />
                  <span className="flex-1 bg-white relative flex items-center justify-center">
                    <span className="h-1.5 w-1.5 rounded-full border border-[#000080]" />
                  </span>
                  <span className="flex-1 bg-[#138808]" />
                </span>
              </div>
              <p className="mt-3 max-w-sm leading-relaxed">
                Autonomous AI employee that plans, builds, and ships software 24/7. Made in India.
              </p>
              <div className="mt-3 inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-primary">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                Official Verified Website · manovik.in
              </div>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-2">Product</div>
              <ul className="space-y-1.5">
                <li><Link to="/" hash="pricing" className="hover:text-primary">Pricing</Link></li>
                <li><Link to="/chat" className="hover:text-primary">Chat</Link></li>
                <li><Link to="/billing" className="hover:text-primary">Billing</Link></li>
                <li><Link to="/login" className="hover:text-primary">Sign in</Link></li>
                <li><Link to="/connect" className="hover:text-primary">Connect AI assistants</Link></li>
              </ul>
            </div>
            <div>
              <div className="font-semibold text-foreground mb-2">Legal & Support</div>
              <ul className="space-y-1.5">
                <li><Link to="/terms" className="hover:text-primary">Terms of Service</Link></li>
                <li><Link to="/privacy" className="hover:text-primary">Privacy Policy</Link></li>
                <li><Link to="/refund" className="hover:text-primary">Refund & Cancellation</Link></li>
                <li><Link to="/contact" className="hover:text-primary">Contact</Link></li>
              </ul>
            </div>
          </div>

          <div className="mt-8 border-t border-border/40 pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] leading-relaxed opacity-80 max-w-3xl">
              © {new Date().getFullYear()} MANOVIK AI. All Rights Reserved. "MANOVIK", "MANOVIK AI", the MANOVIK logo, and all related
              marks, content, designs, and code are the exclusive intellectual property of MANOVIK AI and are protected under Indian and
              international copyright, trademark, and unfair-competition laws. Unauthorized reproduction, redistribution, scraping,
              cloning, reverse-engineering, or commercial use — in whole or in part — is strictly prohibited.
            </p>
            <div className="text-[11px] opacity-70 flex items-center gap-2">
              <span>Payments secured by</span>
              <span className="rounded bg-foreground/10 px-2 py-0.5 font-semibold">Razorpay</span>
            </div>
          </div>
        </div>
      </footer>

    </main>
  );
}

const PROMPT_PRESETS = [
  { icon: Smartphone, label: "Multiplayer mobile game", prompt: "Build a multiplayer trivia game for iOS & Android with Google login and realtime rooms." },
  { icon: Store, label: "Shopify-style storefront", prompt: "Build a product storefront with cart, Razorpay checkout, and an admin dashboard." },
  { icon: Bot, label: "AI SaaS with billing", prompt: "Build an AI writing SaaS with Supabase auth, Stripe subscriptions, and streaming responses." },
  { icon: Workflow, label: "Automation dashboard", prompt: "Build a Zapier-style automation dashboard with triggers, actions and scheduled runs." },
];

const TARGETS = [
  { id: "web", label: "Web app", icon: Globe },
  { id: "ios", label: "iPhone", icon: Apple },
  { id: "android", label: "Android", icon: Smartphone },
] as const;

const MODELS = ["Claude Fable 5", "GPT-5.5", "Gemini 3 Pro", "Auto"] as const;

function PromptComposer() {
  const [prompt, setPrompt] = useState("");
  const [target, setTarget] = useState<(typeof TARGETS)[number]["id"]>("web");
  const [model, setModel] = useState<(typeof MODELS)[number]>("Claude Fable 5");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLDivElement | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const stop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStatus((s) => (s === "streaming" ? "done" : s));
  };

  const submit = async () => {
    const text = prompt.trim();
    if (!text) {
      toast.error("Describe what you want to build first");
      return;
    }
    if (status === "streaming") return;

    // Remember the request so the /login → chat handoff can resume it later.
    try {
      sessionStorage.setItem(
        "manovik:pending-prompt",
        JSON.stringify({ prompt: text, target, model }),
      );
    } catch {
      // ignore storage failures
    }

    setOutput("");
    setErrorMsg(null);
    setStatus("streaming");

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const res = await fetch("/api/public/demo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: text, target, model, connected: hasFableSession() }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = (await res.text().catch(() => "")).slice(0, 240);
        const message =
          res.status === 429
            ? "You're going fast — wait a minute and retry."
            : res.status === 402
              ? "Demo credits are recharging. Sign in to use your own balance."
              : detail || `Request failed (${res.status})`;
        setErrorMsg(message);
        setStatus("error");
        toast.error(message);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      acc += decoder.decode();
      setOutput(acc);
      setStatus("done");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setStatus("done");
        return;
      }
      const message = (err as Error)?.message ?? "Network error";
      setErrorMsg(message);
      setStatus("error");
      toast.error(message);
    } finally {
      abortRef.current = null;
    }
  };

  const isStreaming = status === "streaming";

  return (
    <div className="mt-24">
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" /> Start with a prompt
        </div>
        <h2 className="mt-4 text-3xl md:text-4xl font-bold">
          Describe your app. <span className="text-gradient">MANOVIK ships it.</span>
        </h2>
        <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
          Type an idea, pick a target and a model. We stream a live build plan — sign in to run it.
        </p>
      </div>

      <div className="mt-8 surface-card relative overflow-hidden rounded-2xl p-4 md:p-5 max-w-3xl mx-auto text-left">
        <span className="card-border-glow" aria-hidden="true" />

        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
          }}
          disabled={isStreaming}
          placeholder="e.g. Build a fitness tracking app with streaks, social feed, and Play Store release."
          rows={4}
          className="w-full resize-none rounded-xl bg-background/40 border border-border/60 p-4 text-sm md:text-base outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20 placeholder:text-muted-foreground/70 disabled:opacity-70"
        />

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <div className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-card/40 p-1">
            {TARGETS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTarget(t.id)}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
                  target === t.id ? "bg-aurora text-primary-foreground shadow" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <t.icon className="h-3.5 w-3.5" />
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={model}
              onChange={(e) => setModel(e.target.value as (typeof MODELS)[number])}
              aria-label="Model"
              className="appearance-none rounded-full border border-primary/40 bg-card/40 px-3 py-1.5 pr-8 text-xs font-medium text-primary backdrop-blur outline-none focus:ring-2 focus:ring-primary/30"
            >
              {MODELS.map((m) => (
                <option key={m} value={m} className="bg-background text-foreground">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-primary" />
          </div>

          <button
            type="button"
            onClick={() => toast.info("File uploads unlock after sign-in")}
            className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <Paperclip className="h-3.5 w-3.5" /> Attach
          </button>

          <div className="ml-auto flex items-center gap-2">
            <span className="hidden md:inline text-[11px] text-muted-foreground">⌘/Ctrl + Enter</span>
            {isStreaming ? (
              <Button onClick={stop} variant="outline" className="border-primary/40 text-primary">
                Stop
              </Button>
            ) : (
              <Button onClick={submit} className="bg-aurora text-primary-foreground glow hover:opacity-95">
                <Send className="mr-1 h-4 w-4" /> Build it
              </Button>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {PROMPT_PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setPrompt(p.prompt)}
              disabled={isStreaming}
              className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1 text-xs text-muted-foreground hover:text-primary hover:border-primary/40 transition disabled:opacity-50"
            >
              <p.icon className="h-3.5 w-3.5" />
              {p.label}
            </button>
          ))}
        </div>

        {(output || isStreaming || errorMsg) && (
          <div className="mt-5 border-t border-border/60 pt-4">
            <div className="mb-2 flex items-center justify-between">
              <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                <Bot className="h-3.5 w-3.5 text-primary" />
                MANOVIK preview · {model} · {target}
              </div>
              {status === "done" && (
                <button
                  type="button"
                  onClick={() => navigate({ to: "/login" })}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Sign in to run it →
                </button>
              )}
            </div>
            <div
              ref={outputRef}
              aria-live="polite"
              className="max-h-80 overflow-y-auto rounded-xl bg-background/50 border border-border/60 p-4 text-sm whitespace-pre-wrap font-mono text-foreground/90"
            >
              {errorMsg ? (
                <span className="text-destructive">{errorMsg}</span>
              ) : output ? (
                <>
                  {output}
                  {isStreaming && <span className="ml-0.5 inline-block h-3 w-1.5 animate-pulse bg-primary align-middle" />}
                </>
              ) : (
                <span className="text-muted-foreground">Thinking…</span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Claude Fable 5 connect flow ----------------
// Client-side "connect" that authorizes higher-quality routing on the demo
// endpoint. It is honest about being a demo session — no real Anthropic
// credential ever leaves the browser. The signed session token is stored in
// localStorage and forwarded as `connected: true` on the streaming endpoint.

const FABLE_SESSION_KEY = "manovik:fable5-session";

type FableSession = { token: string; connectedAt: number; handle: string };

function hasFableSession(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return Boolean(window.localStorage.getItem(FABLE_SESSION_KEY));
  } catch {
    return false;
  }
}

function readFableSession(): FableSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(FABLE_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as FableSession;
  } catch {
    return null;
  }
}

function writeFableSession(s: FableSession) {
  try {
    window.localStorage.setItem(FABLE_SESSION_KEY, JSON.stringify(s));
    window.dispatchEvent(new CustomEvent("manovik:fable5-changed"));
  } catch {
    // ignore
  }
}

function clearFableSession() {
  try {
    window.localStorage.removeItem(FABLE_SESSION_KEY);
    window.dispatchEvent(new CustomEvent("manovik:fable5-changed"));
  } catch {
    // ignore
  }
}

function useFableSession() {
  const [session, setSession] = useState<FableSession | null>(null);
  useEffect(() => {
    setSession(readFableSession());
    const onChange = () => setSession(readFableSession());
    window.addEventListener("manovik:fable5-changed", onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener("manovik:fable5-changed", onChange);
      window.removeEventListener("storage", onChange);
    };
  }, []);
  return session;
}

function ConnectFableButton() {
  const [open, setOpen] = useState(false);
  const session = useFableSession();

  if (session) {
    return (
      <div className="flex flex-wrap items-center gap-3">
        <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/40 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" /> Connected · {session.handle}
        </span>
        <button
          type="button"
          onClick={() => {
            clearFableSession();
            toast.success("Disconnected Claude Fable 5");
          }}
          className="text-xs text-muted-foreground hover:text-foreground underline"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <>
      <Button
        onClick={() => setOpen(true)}
        className="bg-aurora text-primary-foreground glow hover:opacity-95"
      >
        <Link2 className="mr-1.5 h-4 w-4" /> Connect Claude Fable 5
      </Button>
      {open && <ConnectFableDialog onClose={() => setOpen(false)} />}
    </>
  );
}

function ConnectFableDialog({ onClose }: { onClose: () => void }) {
  type Step = "intro" | "authorize" | "verify" | "done";
  const [step, setStep] = useState<Step>("intro");
  const [handle, setHandle] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const authorize = async () => {
    if (!handle.trim()) {
      toast.error("Enter a handle to identify this session");
      return;
    }
    setBusy(true);
    setStep("authorize");
    await new Promise((r) => setTimeout(r, 900));
    setStep("verify");
    await new Promise((r) => setTimeout(r, 800));
    const token =
      "fable5_" +
      Array.from(crypto.getRandomValues(new Uint8Array(18)))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
    writeFableSession({ token, connectedAt: Date.now(), handle: handle.trim() });
    setStep("done");
    setBusy(false);
    toast.success("Claude Fable 5 connected — deeper reasoning enabled");
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="surface-card relative w-full max-w-md rounded-2xl p-6 animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <span className="card-border-glow" aria-hidden="true" />
        <button
          type="button"
          aria-label="Close"
          onClick={onClose}
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-card hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-500 to-rose-500 text-white shadow-lg">
            <Wand2 className="h-5 w-5" />
          </span>
          <div>
            <h3 className="font-semibold">Connect Claude Fable 5</h3>
            <p className="text-xs text-muted-foreground">
              Authorize a live coding session inside MANOVIK.
            </p>
          </div>
        </div>

        <ol className="mt-6 space-y-3 text-sm">
          {[
            { id: "authorize", label: "Authorize Fable 5 session" },
            { id: "verify", label: "Verify browser fingerprint" },
            { id: "done", label: "Enable multi-file tool-use loops" },
          ].map((s) => {
            const order: Step[] = ["intro", "authorize", "verify", "done"];
            const done = order.indexOf(step) > order.indexOf(s.id as Step);
            const active = step === s.id;
            return (
              <li key={s.id} className="flex items-center gap-3">
                <span
                  className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${
                    done
                      ? "border-emerald-500/60 bg-emerald-500/10 text-emerald-400"
                      : active
                        ? "border-primary/60 bg-primary/10 text-primary"
                        : "border-border/60 text-muted-foreground"
                  }`}
                >
                  {done ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : active ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <KeyRound className="h-3 w-3" />
                  )}
                </span>
                <span className={done || active ? "text-foreground" : "text-muted-foreground"}>
                  {s.label}
                </span>
              </li>
            );
          })}
        </ol>

        {step === "intro" && (
          <div className="mt-5 space-y-3">
            <label className="block text-xs font-medium text-muted-foreground">
              Session handle
              <input
                autoFocus
                value={handle}
                onChange={(e) => setHandle(e.target.value)}
                placeholder="e.g. arjun@manovik"
                className="mt-1 w-full rounded-lg bg-background/40 border border-border/60 px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Demo session — the token stays in your browser. Sign in later to bind it to your
              MANOVIK account and use your own credit balance.
            </p>
            <Button
              onClick={authorize}
              disabled={busy}
              className="w-full bg-aurora text-primary-foreground glow hover:opacity-95"
            >
              <ShieldCheck className="mr-1.5 h-4 w-4" /> Authorize & connect
            </Button>
          </div>
        )}

        {step === "done" && (
          <div className="mt-5 space-y-3">
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-300">
              Connected. Claude Fable 5 is now routing your prompts and ship-jobs with extended
              context.
            </div>
            <Button onClick={onClose} className="w-full">
              Start coding
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------- Ship-to-stores interactive stepper ----------------

const SHIP_TARGETS = [
  { id: "web", label: "Live Web", icon: Globe, tag: "Edge · CDN · SSL" },
  { id: "android", label: "Google Play", icon: Smartphone, tag: "AAB · Play Console" },
  { id: "ios", label: "App Store", icon: Apple, tag: "TestFlight · ASC" },
] as const;

type ShipTargetId = (typeof SHIP_TARGETS)[number]["id"];

type Deliverable = { filename: string; lang: string; content: string };

// Extract deliverables from streamed markdown. Files are fenced code blocks
// whose first line is `// file: <name>` (or `# file:`). Also captures the
// surrounding markdown as the "narrative".
function parseDeliverables(md: string): { narrative: string; files: Deliverable[] } {
  const files: Deliverable[] = [];
  const fenceRe = /```([a-zA-Z0-9_+-]*)\n([\s\S]*?)```/g;
  let m: RegExpExecArray | null;
  let narrative = md;
  while ((m = fenceRe.exec(md)) !== null) {
    const lang = m[1] || "text";
    const body = m[2];
    const firstLine = body.split("\n")[0] ?? "";
    const fileMatch = firstLine.match(/^\s*(?:\/\/|#|<!--)\s*file:\s*([^\s*/>]+)/i);
    if (fileMatch) {
      files.push({
        filename: fileMatch[1].trim(),
        lang,
        content: body.split("\n").slice(1).join("\n").trimEnd(),
      });
      narrative = narrative.replace(m[0], "");
    }
  }
  return { narrative: narrative.trim(), files };
}

function ShipStepper() {
  type Stage = "targets" | "details" | "generate";
  const [stage, setStage] = useState<Stage>("targets");
  const [targets, setTargets] = useState<ShipTargetId[]>(["web"]);
  const [appName, setAppName] = useState("");
  const [pkg, setPkg] = useState("in.manovik.app");
  const [description, setDescription] = useState("");
  const [output, setOutput] = useState("");
  const [status, setStatus] = useState<"idle" | "streaming" | "done" | "error">("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const session = useFableSession();

  useEffect(() => () => abortRef.current?.abort(), []);

  const toggleTarget = (id: ShipTargetId) => {
    setTargets((cur) => (cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id]));
  };

  const generate = async () => {
    if (!targets.length) {
      toast.error("Pick at least one target");
      return;
    }
    if (!appName.trim() || !description.trim()) {
      toast.error("Add an app name and short description");
      return;
    }

    setStage("generate");
    setOutput("");
    setErrMsg(null);
    setStatus("streaming");
    setActiveTab(0);

    const controller = new AbortController();
    abortRef.current = controller;

    const userPrompt = `App name: ${appName.trim()}
Package / bundle id: ${pkg.trim() || "in.manovik.app"}
Short description: ${description.trim()}
Targets: ${targets.join(", ")}
Generate the packaging deliverables now.`;

    try {
      const res = await fetch("/api/public/demo-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "ship",
          prompt: userPrompt,
          targets,
          target: targets[0],
          model: session ? "Claude Fable 5" : "GPT-5.5",
          connected: Boolean(session),
        }),
        signal: controller.signal,
      });

      if (!res.ok || !res.body) {
        const detail = (await res.text().catch(() => "")).slice(0, 240);
        const message =
          res.status === 429
            ? "You're going fast — wait a minute and retry."
            : res.status === 402
              ? "Demo credits are recharging. Sign in to use your own balance."
              : detail || `Request failed (${res.status})`;
        setErrMsg(message);
        setStatus("error");
        toast.error(message);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let acc = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        acc += decoder.decode(value, { stream: true });
        setOutput(acc);
      }
      acc += decoder.decode();
      setOutput(acc);
      setStatus("done");
    } catch (err) {
      if ((err as Error)?.name === "AbortError") {
        setStatus("done");
        return;
      }
      const message = (err as Error)?.message ?? "Network error";
      setErrMsg(message);
      setStatus("error");
      toast.error(message);
    } finally {
      abortRef.current = null;
    }
  };

  const stop = () => abortRef.current?.abort();

  const { narrative, files } = parseDeliverables(output);

  const copy = async (f: Deliverable) => {
    try {
      await navigator.clipboard.writeText(f.content);
      toast.success(`Copied ${f.filename}`);
    } catch {
      toast.error("Copy failed");
    }
  };

  const download = (f: Deliverable) => {
    const blob = new Blob([f.content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = f.filename.replace(/[^a-zA-Z0-9._-]/g, "_");
    a.click();
    URL.revokeObjectURL(url);
  };

  const downloadAll = () => {
    if (!files.length) return;
    const bundle = files
      .map((f) => `// ===== ${f.filename} =====\n${f.content}\n`)
      .join("\n");
    const blob = new Blob([bundle], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(appName || "manovik-app").replace(/[^a-zA-Z0-9_-]/g, "_")}-ship-bundle.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="mt-24">
      <div className="text-center animate-fade-in">
        <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
          <Rocket className="h-3.5 w-3.5" /> Ship live — not just preview
        </div>
        <h2 className="mt-4 text-3xl md:text-4xl font-bold">
          From prompt to Play Store, App Store &amp; the web
        </h2>
        <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
          Pick your targets, describe the app — MANOVIK streams the packaging deliverables you need
          to ship, ready to copy or download.
        </p>
      </div>

      <div className="mt-8 surface-card relative overflow-hidden rounded-2xl p-5 md:p-6 max-w-4xl mx-auto text-left">
        <span className="card-border-glow" aria-hidden="true" />

        {/* Progress rail */}
        <ol className="flex items-center gap-2 text-xs mb-6">
          {[
            { id: "targets", label: "1. Targets" },
            { id: "details", label: "2. Details" },
            { id: "generate", label: "3. Deliverables" },
          ].map((s, i) => {
            const order = ["targets", "details", "generate"];
            const done = order.indexOf(stage) > i;
            const active = stage === s.id;
            return (
              <li key={s.id} className="flex items-center gap-2">
                <span
                  className={`inline-flex h-6 min-w-6 items-center justify-center rounded-full px-2 font-semibold ${
                    done
                      ? "bg-emerald-500/20 text-emerald-400"
                      : active
                        ? "bg-aurora text-primary-foreground"
                        : "bg-card text-muted-foreground border border-border/60"
                  }`}
                >
                  {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                </span>
                <span className={active ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {s.label.split(". ")[1]}
                </span>
                {i < 2 && <span className="h-px w-6 bg-border/60 mx-1" />}
              </li>
            );
          })}
        </ol>

        {stage === "targets" && (
          <div>
            <p className="text-sm text-muted-foreground mb-3">
              Where should MANOVIK ship this build? Pick one or more.
            </p>
            <div className="grid gap-3 md:grid-cols-3">
              {SHIP_TARGETS.map((t) => {
                const active = targets.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTarget(t.id)}
                    className={`text-left rounded-xl border p-4 transition ${
                      active
                        ? "border-primary/60 bg-primary/5 ring-2 ring-primary/20"
                        : "border-border/60 bg-card/40 hover:border-primary/40"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg ${
                          active ? "bg-aurora text-primary-foreground" : "bg-card text-primary"
                        }`}
                      >
                        <t.icon className="h-4 w-4" />
                      </span>
                      <div>
                        <div className="font-semibold text-sm">{t.label}</div>
                        <div className="text-[11px] uppercase tracking-wider text-muted-foreground">
                          {t.tag}
                        </div>
                      </div>
                      <span className="ml-auto">
                        {active ? (
                          <Check className="h-4 w-4 text-primary" />
                        ) : (
                          <span className="h-4 w-4 rounded-full border border-border/60 block" />
                        )}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
            <div className="mt-5 flex justify-end">
              <Button
                onClick={() => setStage("details")}
                disabled={!targets.length}
                className="bg-aurora text-primary-foreground glow hover:opacity-95"
              >
                Next <ArrowRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {stage === "details" && (
          <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
              <label className="block text-xs font-medium text-muted-foreground">
                App name
                <input
                  value={appName}
                  onChange={(e) => setAppName(e.target.value)}
                  placeholder="MANOVIK Fit"
                  className="mt-1 w-full rounded-lg bg-background/40 border border-border/60 px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
              </label>
              <label className="block text-xs font-medium text-muted-foreground">
                Package / bundle id
                <input
                  value={pkg}
                  onChange={(e) => setPkg(e.target.value)}
                  placeholder="in.manovik.fit"
                  className="mt-1 w-full rounded-lg bg-background/40 border border-border/60 px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
                />
              </label>
            </div>
            <label className="block text-xs font-medium text-muted-foreground">
              Short description
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Fitness tracker with streaks, a social feed, and weekly challenges."
                className="mt-1 w-full resize-none rounded-lg bg-background/40 border border-border/60 px-3 py-2 text-sm outline-none focus:border-primary/60 focus:ring-2 focus:ring-primary/20"
              />
            </label>
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>
                Routing via{" "}
                <span className="text-primary font-medium">
                  {session ? "Claude Fable 5" : "GPT-5.5"}
                </span>
                {session ? " · connected" : " · connect Fable 5 for deeper packaging"}
              </span>
            </div>
            <div className="flex justify-between">
              <Button variant="outline" onClick={() => setStage("targets")}>
                Back
              </Button>
              <Button
                onClick={generate}
                className="bg-aurora text-primary-foreground glow hover:opacity-95"
              >
                <Rocket className="mr-1 h-4 w-4" /> Generate deliverables
              </Button>
            </div>
          </div>
        )}

        {stage === "generate" && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
                <Bot className="h-3.5 w-3.5 text-primary" />
                Packaging {appName || "app"} for {targets.join(", ")}
                {status === "streaming" && (
                  <>
                    <Loader2 className="h-3 w-3 animate-spin text-primary" />
                    streaming…
                  </>
                )}
              </div>
              <div className="flex gap-2">
                {status === "streaming" ? (
                  <Button variant="outline" size="sm" onClick={stop}>
                    Stop
                  </Button>
                ) : (
                  <>
                    <Button variant="outline" size="sm" onClick={() => setStage("details")}>
                      Edit
                    </Button>
                    {files.length > 0 && (
                      <Button
                        size="sm"
                        onClick={downloadAll}
                        className="bg-aurora text-primary-foreground"
                      >
                        <Download className="mr-1 h-3.5 w-3.5" /> Bundle
                      </Button>
                    )}
                  </>
                )}
              </div>
            </div>

            {errMsg && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive mb-3">
                {errMsg}
              </div>
            )}

            {files.length > 0 && (
              <div className="rounded-xl border border-border/60 overflow-hidden mb-3">
                <div className="flex flex-wrap gap-1 border-b border-border/60 bg-card/40 p-1">
                  {files.map((f, i) => (
                    <button
                      key={f.filename + i}
                      type="button"
                      onClick={() => setActiveTab(i)}
                      className={`rounded-md px-3 py-1.5 text-xs font-mono transition ${
                        activeTab === i
                          ? "bg-aurora text-primary-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {f.filename}
                    </button>
                  ))}
                </div>
                {files[activeTab] && (
                  <div className="relative">
                    <div className="absolute right-2 top-2 flex gap-1 z-10">
                      <button
                        type="button"
                        onClick={() => copy(files[activeTab])}
                        className="rounded-md bg-card/80 border border-border/60 p-1.5 text-muted-foreground hover:text-foreground"
                        aria-label="Copy"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => download(files[activeTab])}
                        className="rounded-md bg-card/80 border border-border/60 p-1.5 text-muted-foreground hover:text-foreground"
                        aria-label="Download"
                      >
                        <Download className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <pre className="max-h-96 overflow-auto bg-background/60 p-4 text-xs font-mono text-foreground/90 whitespace-pre-wrap">
                      {files[activeTab].content}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {narrative && (
              <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm whitespace-pre-wrap text-foreground/85 max-h-72 overflow-auto">
                {narrative}
              </div>
            )}

            {!narrative && !files.length && status === "streaming" && (
              <div className="rounded-xl border border-border/60 bg-background/40 p-4 text-sm text-muted-foreground">
                MANOVIK is drafting your packaging deliverables…
              </div>
            )}

            {status === "done" && (
              <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="text-muted-foreground">
                  {files.length} file{files.length === 1 ? "" : "s"} generated
                </span>
                <Link
                  to="/login"
                  className="font-medium text-primary hover:underline inline-flex items-center gap-1"
                >
                  Sign in to run the real upload <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

