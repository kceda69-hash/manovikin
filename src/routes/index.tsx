import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import { Sparkles, Code2, Zap, Shield, Brain, ArrowRight, Globe, Workflow, Terminal, Check, ChevronDown, Smartphone, Apple, Rocket, Cpu, Paperclip, Send, Store, Bot, Layers, Wand2, Download, Copy, Loader2, KeyRound, ShieldCheck, X, Link2 } from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/nova-x-logo.webp";
import { startCheckout, type CheckoutPlan } from "@/lib/razorpay-checkout";
import { Button } from "@/components/ui/button";
import { useFooterI18n, FOOTER_LOCALES } from "@/lib/i18n-footer";
import { useI18n, LanguageSwitcher } from "@/lib/i18n";
// Only the tiny storage/meta helpers are loaded eagerly. The interactive DNA
// panels are code-split so they don't block first paint of the landing page.
import { getDnaOverride, type ShipStageId } from "@/components/manovik/dna-storage";

const dnaFeatures = () => import("@/components/manovik/dna-features");
const DnaPromptEditor = lazy(() => dnaFeatures().then((m) => ({ default: m.DnaPromptEditor })));
const CloneVerifier = lazy(() => dnaFeatures().then((m) => ({ default: m.CloneVerifier })));


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
      { rel: "preload", as: "image", href: logo, fetchPriority: "high" },
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
  const { locale, setLocale, t: footerT } = useFooterI18n();
  const { t } = useI18n();
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
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="hidden sm:inline-flex" />
          <Link to="/login">
            <Button variant="outline" className="border-primary/40 bg-card/40 backdrop-blur hover-scale">
              {t("nav.signin")}
            </Button>
          </Link>
        </div>
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

        <h2 className="sr-only">What MANOVIK can do</h2>
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
              <h3 className="mt-3 font-semibold">{f.title}</h3>
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


        {/* MANOVIK DNA — unique brains only this agent ships */}
        <section id="dna" className="mt-24">
          <div className="text-center animate-fade-in">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-3 py-1 text-xs font-medium text-primary backdrop-blur">
              <Brain className="h-3.5 w-3.5" /> MANOVIK DNA
            </div>
            <h2 className="mt-4 text-3xl md:text-4xl font-bold">
              Five brains no other AI ships. <span className="text-gradient">Switch mid-prompt.</span>
            </h2>
            <p className="mt-2 text-muted-foreground max-w-2xl mx-auto">
              Every mode below is a live pill on the composer above — pick one and MANOVIK reframes the whole reasoning stack.
            </p>
          </div>
          <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3 text-left">
            {[
              { icon: Workflow, title: "Reverse-Engineer Brain", body: "Paste a URL, screenshot, or snippet. MANOVIK decomposes the architecture, names the tricks, and returns a clean-room rebuild plan — original code only, never verbatim." },
              { icon: Copy, title: "Clone-Exactly Brain", body: "Locks the spec, emits every file with `// file: path` headers, and ships parity tests so you can prove the clone matches before you ship." },
              { icon: Brain, title: "MANOVIK Brain (memory)", body: "A persistent knowledge graph of your stack, style, and past work. Talks to you like it already knows you — because it does." },
              { icon: Rocket, title: "One-Click Ship (100% accuracy)", body: "Play Store, App Store, and Web packaging deliverables with preflight checks. Nothing MANOVIK emits gets rejected on review." },
              { icon: Layers, title: "Skill Packs", body: "Composable, whitelisted skills (Supabase, Razorpay, Expo, RLS…) that plug into the sandbox at runtime — auditable, rate-limited, reversible." },
              { icon: Cpu, title: "Multi-model routing", body: "Cheap Gemini for greetings, GPT-5.5 for architecture, Claude Fable 5 for shipping. Router picks — you don't pay for the wrong brain." },
            ].map((c) => (
              <div key={c.title} className="surface-card relative overflow-hidden rounded-2xl p-5 md:p-6">
                <span className="card-border-glow" aria-hidden="true" />
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary/80 to-accent text-primary-foreground shadow">
                    <c.icon className="h-5 w-5" />
                  </span>
                  <h3 className="font-semibold text-base md:text-lg">{c.title}</h3>
                </div>
                <p className="mt-3 text-sm text-muted-foreground leading-relaxed">{c.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 text-center">
            <a
              href="#top"
              onClick={(e) => { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); }}
              className="inline-flex items-center gap-2 rounded-full border border-primary/40 bg-card/40 px-4 py-2 text-sm text-primary hover:bg-primary/10 transition"
            >
              Try a DNA mode in the composer <ArrowRight className="h-4 w-4" />
            </a>
          </div>
        </section>




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
            <h2 className="text-3xl md:text-4xl font-bold">{t("landing.pricing.title")}</h2>
            <p className="mt-2 text-muted-foreground">{t("landing.pricing.sub")}</p>
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
                <li><Link to="/" hash="pricing" className="hover:text-primary">{t("landing.footer.pricing")}</Link></li>
                <li><Link to="/chat" className="hover:text-primary">Chat</Link></li>
                <li><Link to="/billing" className="hover:text-primary">Billing</Link></li>
                <li><Link to="/login" className="hover:text-primary">{t("landing.footer.signin")}</Link></li>
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

          <div className="mt-8 flex flex-col items-center justify-center gap-2 text-center">
            <div
              className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/5 px-4 py-2 text-[11px] font-medium tracking-[0.2em] text-primary/90 uppercase backdrop-blur"
              aria-label={footerT.builtBy}
              lang={locale}
            >
              {Array.from(footerT.builtWord).map((ch, i) => (
                <span
                  key={`b-${i}`}
                  className="inline-block font-black"
                  style={{ transform: `rotate(${((i % 3) - 1) * 2}deg) translateY(${(i % 2 === 0 ? -1 : 1)}px)` }}
                >
                  {ch}
                </span>
              ))}
              <span className="mx-1.5 inline-block h-3 w-px bg-primary/30" aria-hidden="true" />
              {Array.from(footerT.byWord).map((ch, i) => (
                <span
                  key={`y-${i}`}
                  className="inline-block font-black"
                  style={{ transform: `rotate(${((i % 3) - 1) * -2}deg) translateY(${(i % 2 === 0 ? 1 : -1)}px)` }}
                >
                  {ch}
                </span>
              ))}
              <span className="mx-1.5 inline-block h-3 w-px bg-primary/30" aria-hidden="true" />
              <span className="inline-block rotate-3 bg-gradient-to-r from-primary to-aurora bg-clip-text text-transparent font-black">K</span>
              <span className="inline-block -rotate-1 bg-gradient-to-r from-aurora to-primary bg-clip-text text-transparent font-black">C</span>
            </div>
          </div>

          <div className="mt-4 border-t border-border/40 pt-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <p className="text-[11px] leading-relaxed opacity-80 max-w-3xl" lang={locale}>
              {footerT.copyright(new Date().getFullYear())}
            </p>
            <div className="flex flex-col items-start gap-2 md:items-end">
              <label className="text-[11px] opacity-70 flex items-center gap-2">
                <span>{footerT.languageLabel}:</span>
                <select
                  value={locale}
                  onChange={(e) => setLocale(e.target.value as typeof locale)}
                  className="rounded border border-border/50 bg-background px-2 py-0.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                  aria-label={footerT.languageLabel}
                >
                  {FOOTER_LOCALES.map((l) => (
                    <option key={l.code} value={l.code}>{l.label}</option>
                  ))}
                </select>
              </label>
              <div className="text-[11px] opacity-70 flex items-center gap-2">
                <span>{footerT.paymentsSecuredBy}</span>
                <span className="rounded bg-foreground/10 px-2 py-0.5 font-semibold">Razorpay</span>
              </div>
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
  const [attachments, setAttachments] = useState<Array<{ name: string; content: string }>>([]);
  const [target, setTarget] = useState<(typeof TARGETS)[number]["id"]>("web");
  const [model, setModel] = useState<(typeof MODELS)[number]>("Claude Fable 5");
  const [dnaMode, setDnaMode] = useState<"build" | "reverse" | "clone" | "brain" | "ship-store">("build");
  const [editorOpen, setEditorOpen] = useState(false);

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
    const attachmentContext = attachments.length
      ? `\n\nAttached files:\n${attachments
          .map((file) => `--- ${file.name} ---\n${file.content.slice(0, 4000)}`)
          .join("\n\n")}`
      : "";

    try {
      sessionStorage.setItem(
        "manovik:pending-prompt",
        JSON.stringify({ prompt: `${text}${attachmentContext}`, target, model }),
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
        body: JSON.stringify({ prompt: `${text}${attachmentContext}`, target, model, dnaMode, customSystem: getDnaOverride(dnaMode) }),
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

  const attachFiles = async (list: FileList | null) => {
    if (!list?.length) return;
    const picked = Array.from(list).slice(0, 4);
    const loaded: Array<{ name: string; content: string }> = [];
    for (const file of picked) {
      if (file.size > 64_000) {
        toast.error(`${file.name} is too large for the landing demo`);
        continue;
      }
      const content = await file.text().catch(() => "");
      loaded.push({ name: file.name, content });
    }
    if (loaded.length) {
      setAttachments((cur) => [...cur, ...loaded].slice(-4));
      toast.success(`Attached ${loaded.length} file${loaded.length === 1 ? "" : "s"}`);
    }
  };

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

        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] uppercase tracking-wider text-muted-foreground mr-1">Brain</span>
          {([
            { id: "build", label: "Build", icon: Sparkles },
            { id: "reverse", label: "Reverse-Engineer", icon: Workflow },
            { id: "clone", label: "Clone Exactly", icon: Copy },
            { id: "brain", label: "MANOVIK Brain", icon: Brain },
            { id: "ship-store", label: "One-Click Ship", icon: Rocket },
          ] as const).map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setDnaMode(m.id)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
                dnaMode === m.id
                  ? "border-primary/60 bg-primary/15 text-primary shadow-[0_0_0_1px_hsl(var(--primary)/0.3)]"
                  : "border-border/60 bg-card/40 text-muted-foreground hover:text-foreground"
              }`}
            >
              <m.icon className="h-3 w-3" />
              {m.label}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-primary hover:border-primary/40 transition"
            title="Edit MANOVIK's system prompt for each brain"
          >
            <Wand2 className="h-3 w-3" /> Edit DNA prompt
          </button>
        </div>


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

          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground transition hover:text-foreground">
            <Paperclip className="h-3.5 w-3.5" /> Attach
            <input
              type="file"
              multiple
              className="sr-only"
              accept=".txt,.md,.json,.js,.jsx,.ts,.tsx,.css,.html,.sql,.py,.go,.rs,.java,.kt,.swift,.yaml,.yml"
              onChange={(e) => {
                void attachFiles(e.currentTarget.files);
                e.currentTarget.value = "";
              }}
            />
          </label>

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

        {attachments.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {attachments.map((file) => (
              <span
                key={file.name}
                className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs text-primary"
              >
                <Paperclip className="h-3 w-3" /> {file.name}
                <button
                  type="button"
                  onClick={() => setAttachments((cur) => cur.filter((f) => f.name !== file.name))}
                  className="ml-1 rounded-full p-0.5 hover:bg-primary/15"
                  aria-label={`Remove ${file.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

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

        {dnaMode === "clone" && output && status === "done" && (
          <div className="mt-4 flex items-center justify-between gap-2 flex-wrap">
            <span className="text-[11px] text-muted-foreground">
              Verify the generated files match the original spec.
            </span>
            <Suspense fallback={null}>
              <CloneVerifier
                spec={prompt}
                files={parseDeliverables(output).files.map((f) => ({
                  path: f.filename,
                  content: f.content,
                }))}
              />
            </Suspense>
          </div>
        )}
      </div>
      {editorOpen && (
        <Suspense fallback={null}>
          <DnaPromptEditor open onClose={() => setEditorOpen(false)} />
        </Suspense>
      )}
    </div>
  );
}


// Extract deliverables from streamed markdown. Files are fenced code blocks
// whose first line is `// file: <name>`.
type Deliverable = { filename: string; lang: string; content: string };

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
