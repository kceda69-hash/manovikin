import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import type { UserIdentity } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2, Link2, Unlink } from "lucide-react";

export const Route = createFileRoute("/account")({
  component: AccountPage,
  head: () => ({
    meta: [
      { title: "Account & Linked Sign-ins — MANOVIK AI" },
      {
        name: "description",
        content:
          "Manage your MANOVIK AI account: link Google and email sign-in to one account so you never create a duplicate profile.",
      },
      { name: "robots", content: "noindex" },
      { property: "og:title", content: "Account & Linked Sign-ins — MANOVIK AI" },
      {
        property: "og:description",
        content: "Link Google and email sign-in methods to a single MANOVIK AI account.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
});

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  email: "Email & password",
};

function AccountPage() {
  const { user, loading } = useAuth();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase.auth.getUserIdentities();
    if (error) {
      setIdentities([]);
      return;
    }
    setIdentities(data.identities ?? []);
  }, []);

  useEffect(() => {
    if (!loading && user) void refresh();
  }, [loading, user, refresh]);

  const hasGoogle = !!identities?.some((i) => i.provider === "google");

  const linkGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.linkIdentity({
        provider: "google",
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Could not link Google.";
      toast.error(
        /already/i.test(msg)
          ? "That Google account is already linked to a MANOVIK account."
          : msg,
      );
      setBusy(false);
    }
  };

  const unlink = async (identity: UserIdentity) => {
    if ((identities?.length ?? 0) < 2) {
      toast.error("You need at least one sign-in method.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.unlinkIdentity(identity);
      if (error) throw error;
      toast.success(`${PROVIDER_LABEL[identity.provider] ?? identity.provider} unlinked.`);
      await refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not unlink.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!user) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <h1 className="text-2xl font-bold">Account</h1>
        <p className="mt-2 text-muted-foreground">Sign in to manage your linked sign-in methods.</p>
        <Link
          to="/login"
          search={{ next: "/account" } as never}
          className="mt-6 inline-block text-sm underline"
        >
          Go to sign in
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-6 py-12 text-foreground">
      <h1 className="text-3xl font-bold">Account</h1>
      <p className="mt-2 text-muted-foreground">
        Signed in as <span className="text-foreground">{user.email}</span>. Link several sign-in
        methods to this one MANOVIK account instead of creating duplicates.
      </p>

      <Card className="mt-8 divide-y divide-border/60 p-0">
        {identities === null && (
          <div className="flex items-center gap-2 p-5 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading sign-in methods…
          </div>
        )}
        {identities?.map((identity) => (
          <div key={identity.identity_id} className="flex items-center justify-between gap-4 p-5">
            <div>
              <p className="font-medium">
                {PROVIDER_LABEL[identity.provider] ?? identity.provider}
              </p>
              <p className="text-xs text-muted-foreground">
                {(identity.identity_data?.email as string | undefined) ?? user.email}
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              disabled={busy || (identities?.length ?? 0) < 2}
              onClick={() => unlink(identity)}
            >
              <Unlink className="mr-1.5 h-4 w-4" /> Unlink
            </Button>
          </div>
        ))}
        {identities?.length === 0 && (
          <p className="p-5 text-sm text-muted-foreground">No sign-in methods found.</p>
        )}
      </Card>

      {!hasGoogle && (
        <Button className="mt-6" onClick={linkGoogle} disabled={busy}>
          <Link2 className="mr-2 h-4 w-4" /> Link Google to this account
        </Button>
      )}

      <p className="mt-6 text-xs text-muted-foreground">
        Signing in with Google using the same verified email address always returns you to this
        account — a new account is never created.
      </p>
    </main>
  );
}
