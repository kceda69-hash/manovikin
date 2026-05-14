import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
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
    links: [{ rel: "canonical", href: "https://manovikin.lovable.app/" }],
  }),
});

function Landing() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    // Defer Supabase client off the critical landing-page bundle.
    import("@/integrations/supabase/client").then(({ supabase }) => {
      if (cancelled) return;
      supabase.auth.getSession().then(({ data }) => {
        if (!cancelled && data.session?.user) navigate({ to: "/chat" });
      });
    });
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Aurora backdrop */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -top-40 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-aurora opacity-20 blur-3xl" />
        <div className="absolute bottom-0 right-0 h-96 w-96 rounded-full bg-primary/20 blur-3xl" />
      </div>

      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="flex items-center gap-3">
          <img src={logo} alt="MANOVIK AI logo" width={36} height={36} className="h-9 w-9 animate-float" />
          <span className="text-lg font-bold tracking-wider text-gradient">MANOVIK AI</span>
        </div>
        <Link to="/login">
          <Button variant="outline" className="border-primary/40 bg-card/40 backdrop-blur">
            Sign in
          </Button>
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-20 pt-16 text-center">
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur">
          <Sparkles className="h-3.5 w-3.5" />
          Autonomous AI agent · v1.0
        </div>
        <h1 className="text-balance text-5xl font-bold leading-tight tracking-tight md:text-7xl">
          Meet <span className="text-gradient">MANOVIK AI</span>
          <br />
          your AI employee.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl">
          A futuristic agent that writes code in any language, builds websites, apps, and APIs,
          and gets the job done — autonomously.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/login">
            <Button size="lg" className="bg-aurora text-primary-foreground glow hover:opacity-90">
              Launch MANOVIK AI <ArrowRight className="ml-1 h-4 w-4" />
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
          ].map((f) => (
            <div key={f.title} className="surface-card rounded-xl p-5 text-left">
              <f.icon className="h-5 w-5 text-primary" />
              <h3 className="mt-3 font-semibold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border/40 py-6 text-center text-xs text-muted-foreground">
        Powered by Lovable AI · Built for builders
      </footer>
    </main>
  );
}
