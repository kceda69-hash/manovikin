import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import logo from "@/assets/nova-x-logo.webp";
import { useAuth } from "@/hooks/useAuth";

function sanitizeNextPath(value: unknown) {
  if (typeof value !== "string") return "/chat";
  if (!value.startsWith("/") || value.startsWith("//")) return "/chat";
  if (/^\/(?:login|auth\/callback)\b/.test(value)) return "/chat";
  return value;
}

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>) => ({
    next: sanitizeNextPath(search.next),
  }),
  component: LoginPage,
  head: () => ({
    meta: [
      { title: "Sign in to MANOVIK AI" },
      { name: "description", content: "Sign in to MANOVIK AI to launch your autonomous AI agent and start building." },
      { property: "og:title", content: "Sign in to MANOVIK AI" },
      { property: "og:description", content: "Access your MANOVIK AI workspace and command your autonomous AI agent." },
      { property: "og:url", content: "https://manovik.in/login" },
      { property: "og:type", content: "website" },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/login" }],
  }),
});

function LoginPage() {
  const navigate = useNavigate();
  const { next } = Route.useSearch();
  const { user, loading } = useAuth();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [magicBusy, setMagicBusy] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [magicCooldown, setMagicCooldown] = useState(0);

  useEffect(() => {
    if (magicCooldown <= 0) return;
    const id = setInterval(() => setMagicCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [magicCooldown]);

  useEffect(() => {
    if (!loading && user) navigate({ to: next as any });
  }, [loading, user, navigate, next]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}` },
        });
        if (error) throw error;
        toast.success("Check your email to confirm your account.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        navigate({ to: next as any });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setBusy(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      });
      if (result.error) {
        toast.error(result.error.message ?? "Google sign-in failed");
        setBusy(false);
        return;
      }
      if (result.redirected) return;
      // Session was set by the lovable wrapper; navigate to app.
      navigate({ to: next as any });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Sign-in failed");
      setBusy(false);
    }
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error("Enter your email first.");
      return;
    }
    setMagicBusy(true);
    try {
      const res = await fetch("/api/auth/magic-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
        }),
      });
      if (res.status === 429) {
        const body = await res.json().catch(() => ({}));
        const secs: number = body.retryAfterSec ?? 60;
        setMagicCooldown(secs);
        toast.error(`Too many attempts. Try again in ${secs}s.`);
        return;
      }
      if (!res.ok) {
        toast.error("Could not send magic link. Please try again.");
        return;
      }
      setMagicSent(true);
      setMagicCooldown(60);
      toast.success("Check your inbox for the login link.");
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setMagicBusy(false);
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden px-4">
      {/* Animated background */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute inset-0 mesh-aurora opacity-60" />
        <div className="absolute inset-0 bg-grid opacity-30" />
        <div
          className="login-orb"
          style={{ width: 320, height: 320, left: "10%", top: "20%", background: "var(--gradient-aurora)" }}
        />
        <div
          className="login-orb"
          style={{ width: 260, height: 260, right: "8%", bottom: "14%", background: "radial-gradient(circle, oklch(0.65 0.25 305 / 0.8), transparent 70%)", animationDuration: "22s" }}
        />
      </div>

      <Link
        to="/"
        className="absolute top-6 left-6 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/40 px-3 py-1.5 text-xs text-muted-foreground backdrop-blur-sm transition-colors hover:text-foreground hover:border-primary/60"
      >
        <span aria-hidden="true">←</span> Back to home
      </Link>

      <div className="surface-card relative w-full max-w-md rounded-2xl p-8 animate-fade-in">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <img src={logo} alt="MANOVIK AI" width={40} height={40} className="h-10 w-10" />
          <span className="text-xl font-bold tracking-wider text-gradient">MANOVIK AI</span>
        </Link>
        <h1 className="text-center text-2xl font-bold">
          {mode === "signin" ? "Sign in to MANOVIK AI" : "Create your MANOVIK AI account"}
        </h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">
          {mode === "signin" ? "Sign in to continue" : "Start commanding your AI agent"}
        </p>

        <div className="mt-6 space-y-2">
          <Button
            type="button"
            variant="outline"
            className="w-full border-border/60 bg-card/40"
            onClick={handleGoogleSignIn}
            disabled={busy}
          >
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.76h3.55c2.08-1.92 3.29-4.74 3.29-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.55-2.76c-.98.66-2.24 1.06-3.73 1.06-2.87 0-5.3-1.94-6.17-4.55H2.18v2.85A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.83 14.09a6.61 6.61 0 0 1 0-4.18V7.07H2.18a11 11 0 0 0 0 9.86l3.65-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.65 2.84C6.7 7.32 9.13 5.38 12 5.38z"/></svg>
            Continue with Google
          </Button>
        </div>


        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="h-px flex-1 bg-border/60" /> or <div className="h-px flex-1 bg-border/60" />
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1.5 input-glow" />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-1.5 input-glow" />
          </div>
          <Button type="submit" disabled={busy} className="w-full bg-aurora text-primary-foreground glow hover:opacity-90">
            {busy ? "..." : mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="mt-4">
          <Button
            type="button"
            variant="outline"
            className="w-full border-border/60 bg-card/40"
            onClick={handleMagicLink}
            disabled={magicBusy || magicCooldown > 0}
          >
            {magicBusy
              ? "Sending…"
              : magicCooldown > 0
                ? `Resend in ${magicCooldown}s`
                : magicSent
                  ? "Email another login link"
                  : "Email me a magic link"}
          </Button>
          {magicSent && magicCooldown === 0 && (
            <p className="mt-2 text-center text-xs text-muted-foreground">
              Didn't get it? Check spam, or resend above.
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setMode(mode === "signin" ? "signup" : "signin")}
          className="mt-5 w-full text-center text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === "signin" ? "No account? Sign up" : "Already have an account? Sign in"}
        </button>

        <div className="mt-6 border-t border-border/40 pt-3 text-center">
          <Link
            to="/login"
            search={{ next: "/admin" } as any}
            className="text-[11px] uppercase tracking-wider text-muted-foreground/70 hover:text-foreground"
          >
            Admin sign-in →
          </Link>
        </div>
      </div>
    </main>
  );
}
