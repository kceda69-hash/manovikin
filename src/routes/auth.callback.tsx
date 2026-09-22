import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

type State = "processing" | "ok" | "error";

function sanitizeNextPath(value: string | null) {
  if (!value) return "/chat";
  if (!value.startsWith("/") || value.startsWith("//")) return "/chat";
  if (/^\/(?:login|auth\/callback)\b/.test(value)) return "/chat";
  return value;
}

/** Wait for the Supabase client to hydrate a session from the URL. */
async function waitForSession(ms = 12000) {
  const deadline = Date.now() + ms;
  // Resolve as soon as the client reports a sign-in, instead of relying on
  // polling alone (detectSessionInUrl can land between two polls).
  let signedIn: (() => void) | null = null;
  const signal = new Promise<void>((resolve) => {
    signedIn = resolve;
  });
  const { data: sub } = supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") signedIn?.();
  });
  try {
    for (;;) {
      const { data } = await supabase.auth.getSession();
      if (data.session) return data.session;
      if (Date.now() > deadline) return null;
      await Promise.race([signal, new Promise((r) => setTimeout(r, 250))]);
    }
  } finally {
    sub.subscription.unsubscribe();
  }
}

export const Route = createFileRoute("/auth/callback")({
  component: AuthCallbackPage,
  head: () => ({
    meta: [
      { title: "Signing you in — MANOVIK AI" },
      {
        name: "description",
        content: "Completing your magic-link sign-in to MANOVIK AI.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function AuthCallbackPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<State>("processing");
  const [errMsg, setErrMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function complete() {
      try {
        const url = new URL(window.location.href);
        const hash = new URLSearchParams(url.hash.replace(/^#/, ""));
        const param = (k: string) => url.searchParams.get(k) ?? hash.get(k);

        let next = sanitizeNextPath(param("next"));
        if (next === "/chat") {
          try {
            next = sanitizeNextPath(sessionStorage.getItem("manovik.auth.next"));
          } catch {
            /* ignore */
          }
        }
        try {
          sessionStorage.removeItem("manovik.auth.next");
        } catch {
          /* ignore */
        }

        const errorDesc = param("error_description") || param("error");
        if (errorDesc) throw new Error(decodeURIComponent(errorDesc));

        // 1) Tokens delivered directly (OAuth broker / implicit flow).
        const accessToken = param("access_token");
        const refreshToken = param("refresh_token");
        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (error) throw error;
        } else {
          // 2) PKCE code flow. If the verifier isn't ours (broker-issued code),
          // the exchange fails — the session may still arrive via the client's
          // own URL detection, so fall through to polling instead of erroring.
          const code = param("code");
          if (code) await supabase.auth.exchangeCodeForSession(code).catch(() => undefined);
        }

        const session = await waitForSession();
        if (!session) throw new Error("No session was created. Please try signing in again.");

        if (cancelled) return;
        setState("ok");
        try {
          sessionStorage.setItem("manovik:just-logged-in", "1");
        } catch {
          /* ignore */
        }
        // Clean the URL then redirect.
        window.history.replaceState({}, "", "/auth/callback");
        setTimeout(() => navigate({ to: next }), 400);
      } catch (err) {
        if (cancelled) return;
        setErrMsg(err instanceof Error ? err.message : "Sign-in failed.");
        setState("error");
      }
    }

    complete();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-8 text-center">
        {state === "processing" && (
          <>
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-muted-foreground" />
            <h1 className="mt-4 text-xl font-semibold">Signing you in…</h1>
            <p className="mt-1 text-sm text-muted-foreground">Verifying your magic link.</p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <h1 className="mt-4 text-xl font-semibold">Signed in</h1>
            <p className="mt-1 text-sm text-muted-foreground">Redirecting to your workspace…</p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto h-8 w-8 text-red-500" />
            <h1 className="mt-4 text-xl font-semibold">Sign-in failed</h1>
            <p className="mt-1 text-sm text-muted-foreground">{errMsg}</p>
            <a href="/login" className="mt-6 inline-block text-sm underline">
              Back to sign in
            </a>
          </>
        )}
      </Card>
    </main>
  );
}
