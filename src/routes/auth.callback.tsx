import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { Card } from "@/components/ui/card";

type State = "processing" | "ok" | "error";

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
        // PKCE code flow: ?code=... in the query string.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        const errorDesc =
          url.searchParams.get("error_description") ||
          url.hash.match(/error_description=([^&]+)/)?.[1];

        if (errorDesc) throw new Error(decodeURIComponent(errorDesc));

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else {
          // Implicit flow: tokens land in the URL hash.
          // Supabase JS auto-detects when detectSessionInUrl is true (default).
          // Give it a moment to hydrate.
          await new Promise((r) => setTimeout(r, 250));
        }

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;
        if (!data.session) throw new Error("No session was created.");

        if (cancelled) return;
        setState("ok");
        // Clean the URL then redirect.
        window.history.replaceState({}, "", "/auth/callback");
        setTimeout(() => navigate({ to: "/chat" }), 500);
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
            <p className="mt-1 text-sm text-muted-foreground">
              Verifying your magic link.
            </p>
          </>
        )}
        {state === "ok" && (
          <>
            <CheckCircle2 className="mx-auto h-8 w-8 text-green-500" />
            <h1 className="mt-4 text-xl font-semibold">Signed in</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Redirecting to your workspace…
            </p>
          </>
        )}
        {state === "error" && (
          <>
            <XCircle className="mx-auto h-8 w-8 text-red-500" />
            <h1 className="mt-4 text-xl font-semibold">Sign-in failed</h1>
            <p className="mt-1 text-sm text-muted-foreground">{errMsg}</p>
            <a
              href="/login"
              className="mt-6 inline-block text-sm underline"
            >
              Back to sign in
            </a>
          </>
        )}
      </Card>
    </main>
  );
}
