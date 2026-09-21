import { createFileRoute, Link, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

type State = "loading" | "valid" | "already" | "invalid" | "done" | "error";

export const Route = createFileRoute("/unsubscribe")({
  validateSearch: (s: Record<string, unknown>) => ({
    token: typeof s.token === "string" ? s.token : "",
  }),
  component: UnsubscribePage,
  head: () => ({
    meta: [
      { title: "Unsubscribe — MANOVIK AI" },
      {
        name: "description",
        content:
          "Unsubscribe from MANOVIK AI transactional and marketing emails. One click and you're off the list.",
      },
      { property: "og:title", content: "Unsubscribe from MANOVIK AI emails" },
      { property: "og:description", content: "One-click opt-out from MANOVIK AI emails." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

function UnsubscribePage() {
  const { token } = useSearch({ from: "/unsubscribe" });
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    let alive = true;
    if (!token) {
      setState("invalid");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((r) => r.json())
      .then((j) => {
        if (!alive) return;
        if (j.valid) setState("valid");
        else if (j.reason === "already_unsubscribed") setState("already");
        else setState("invalid");
      })
      .catch(() => alive && setState("error"));
    return () => {
      alive = false;
    };
  }, [token]);

  const confirm = async () => {
    setState("loading");
    try {
      const r = await fetch("/email/unsubscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      const j = await r.json();
      if (j.success) setState("done");
      else if (j.reason === "already_unsubscribed") setState("already");
      else setState("error");
    } catch {
      setState("error");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="max-w-md w-full p-8 text-center">
        {state === "loading" && (
          <Loader2 className="h-8 w-8 mx-auto animate-spin text-muted-foreground" />
        )}
        {state === "valid" && (
          <>
            <h1 className="text-xl font-semibold">Unsubscribe from MANOVIK emails?</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              You won't receive transactional or notification emails from us anymore.
            </p>
            <Button className="mt-6" onClick={confirm}>
              Confirm unsubscribe
            </Button>
          </>
        )}
        {state === "done" && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-green-500" />
            <h1 className="mt-3 text-xl font-semibold">You're unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We won't email you again. Sorry to see you go.
            </p>
          </>
        )}
        {state === "already" && (
          <>
            <CheckCircle2 className="h-8 w-8 mx-auto text-muted-foreground" />
            <h1 className="mt-3 text-xl font-semibold">Already unsubscribed</h1>
            <p className="mt-2 text-sm text-muted-foreground">This address is already opted out.</p>
          </>
        )}
        {(state === "invalid" || state === "error") && (
          <>
            <XCircle className="h-8 w-8 mx-auto text-red-500" />
            <h1 className="mt-3 text-xl font-semibold">Link invalid</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              This unsubscribe link is no longer valid. Please use the link in a recent email.
            </p>
          </>
        )}
        <div className="mt-6">
          <Link to="/" className="text-xs text-muted-foreground hover:text-foreground underline">
            Back to MANOVIK
          </Link>
        </div>
      </Card>
    </div>
  );
}
