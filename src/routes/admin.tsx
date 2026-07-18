import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  adminWhoami,
  adminSearchUsers,
  adminGetUserDetail,
  adminCancelSubscription,
  adminRefundPayment,
  adminAdjustCredits,
  adminGrantRole,
  adminRevokeRole,
  adminListAuditLogs,
  adminListPurchases,
} from "@/lib/admin.functions";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Shield, ShieldCheck, RefreshCw, Search, Ban, Coins, Trash2, UserPlus } from "lucide-react";

export const Route = createFileRoute("/admin")({
  component: AdminPage,
  head: () => ({
    meta: [
      { title: "Admin — MANOVIK" },
      { name: "robots", content: "noindex, nofollow" },
      { name: "description", content: "Internal MANOVIK admin console for managing users, roles, subscriptions, refunds, credits, and audit logs. Restricted to admins with 2FA." },
      { property: "og:title", content: "Admin — MANOVIK" },
      { property: "og:description", content: "Restricted MANOVIK admin console for user, subscription, and refund management." },
    ],
  }),
});

type Whoami = { userId: string; email: string | null; isAdmin: boolean; aal: string };

function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [who, setWho] = useState<Whoami | null>(null);
  const [checking, setChecking] = useState(true);

  const refreshWhoami = async () => {
    try {
      const w = await adminWhoami();
      setWho(w as Whoami);
    } catch {
      setWho(null);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    if (!authLoading && !user && typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent("/admin")}`;
    }
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (user) refreshWhoami();
  }, [user]);

  if (authLoading || checking) {
    return <FullPage>Loading…</FullPage>;
  }

  if (!who || !who.isAdmin) {
    return (
      <FullPage>
        <Shell>
          <Card className="p-8 text-center">
            <Shield className="mx-auto mb-3 h-8 w-8 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Access denied</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              This area is restricted to MANOVIK administrators.
            </p>
            <Button className="mt-4" asChild variant="outline">
              <Link to="/">Back to home</Link>
            </Button>
          </Card>
        </Shell>
      </FullPage>
    );
  }

  return <AdminConsole who={who} />;
}

function FullPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen max-w-6xl items-center justify-center px-4 py-10">
        {children}
      </div>
    </div>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return <div className="w-full max-w-lg">{children}</div>;
}

// -------- MFA Gate --------------------------------------------------

function MfaGate({ onVerified }: { onVerified: () => void }) {
  const [phase, setPhase] = useState<"loading" | "enroll" | "verify">("loading");
  const [factorId, setFactorId] = useState<string | null>(null);
  const [challengeId, setChallengeId] = useState<string | null>(null);
  const [qr, setQr] = useState<string | null>(null);
  const [secret, setSecret] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const boot = async () => {
    setPhase("loading");
    const { data: list, error } = await supabase.auth.mfa.listFactors();
    if (error) {
      toast.error(error.message);
      return;
    }
    const totp = list?.totp?.find((f) => f.status === "verified");
    if (totp) {
      // Already enrolled → challenge
      setFactorId(totp.id);
      const { data: ch, error: err } = await supabase.auth.mfa.challenge({ factorId: totp.id });
      if (err) {
        toast.error(err.message);
        return;
      }
      setChallengeId(ch.id);
      setPhase("verify");
      return;
    }
    // Enroll a new TOTP factor
    const { data: en, error: enErr } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `MANOVIK Admin ${Date.now()}`,
    });
    if (enErr) {
      toast.error(enErr.message);
      return;
    }
    setFactorId(en.id);
    setQr(en.totp.qr_code);
    setSecret(en.totp.secret);
    setPhase("enroll");
  };

  useEffect(() => {
    boot();
  }, []);

  const submit = async () => {
    if (!factorId) return;
    setBusy(true);
    try {
      if (phase === "enroll") {
        const { data: ch, error: err } = await supabase.auth.mfa.challenge({ factorId });
        if (err) throw err;
        const { error: vErr } = await supabase.auth.mfa.verify({
          factorId,
          challengeId: ch.id,
          code: code.trim(),
        });
        if (vErr) throw vErr;
      } else {
        if (!challengeId) return;
        const { error: vErr } = await supabase.auth.mfa.verify({
          factorId,
          challengeId,
          code: code.trim(),
        });
        if (vErr) throw vErr;
      }
      toast.success("Two-factor verified");
      onVerified();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <FullPage>
      <Shell>
        <Card className="p-6">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            <h1 className="text-lg font-semibold">Two-factor required</h1>
          </div>
          {phase === "loading" && <p className="mt-3 text-sm text-muted-foreground">Loading…</p>}
          {phase === "enroll" && (
            <>
              <p className="mt-2 text-sm text-muted-foreground">
                Set up an authenticator app (Google Authenticator, 1Password, Authy) to protect admin access.
                Scan the QR code, or enter the secret manually.
              </p>
              {qr && (
                <div className="mt-4 flex justify-center rounded-md border bg-white p-4">
                  <img src={qr} alt="TOTP QR code" className="h-44 w-44" />
                </div>
              )}
              {secret && (
                <div className="mt-3">
                  <p className="text-xs text-muted-foreground">Manual key</p>
                  <code className="mt-1 block break-all rounded bg-muted p-2 text-xs">{secret}</code>
                </div>
              )}
            </>
          )}
          {phase === "verify" && (
            <p className="mt-2 text-sm text-muted-foreground">
              Enter the 6-digit code from your authenticator app.
            </p>
          )}
          {(phase === "enroll" || phase === "verify") && (
            <div className="mt-4 space-y-3">
              <Input
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={6}
                placeholder="123456"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
              />
              <div className="flex gap-2">
                <Button className="flex-1" onClick={submit} disabled={busy || code.length !== 6}>
                  {busy ? "Verifying…" : "Verify"}
                </Button>
                <Button variant="outline" onClick={boot} disabled={busy}>
                  <RefreshCw className="mr-1 h-3 w-3" /> Restart
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Lost your device? Sign out and contact support to reset your 2FA factor.
              </p>
            </div>
          )}
        </Card>
      </Shell>
    </FullPage>
  );
}

// -------- Admin Console ---------------------------------------------

type UserRow = {
  id: string;
  email: string | null | undefined;
  created_at: string;
  last_sign_in_at: string | null | undefined;
  confirmed: boolean;
  factors: number;
};

function AdminConsole({ who }: { who: Whoami }) {
  const [tab, setTab] = useState("users");
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to site
          </Link>
          <div className="flex items-center gap-2 text-sm">
            <Badge variant="secondary" className="gap-1">
              <ShieldCheck className="h-3 w-3" /> Admin{who.aal === "aal2" ? " · 2FA" : ""}
            </Badge>
            <span className="text-muted-foreground">{who.email}</span>
            <Button
              size="sm"
              variant="outline"
              onClick={async () => {
                await supabase.auth.signOut();
                window.location.href = "/";
              }}
            >
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="text-2xl font-bold tracking-tight">Admin console</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Manage users, subscriptions, refunds, credits, roles, and review audit logs.
        </p>

        <Tabs value={tab} onValueChange={setTab} className="mt-6">
          <TabsList>
            <TabsTrigger value="users">Users</TabsTrigger>
            <TabsTrigger value="purchases">Purchases</TabsTrigger>
            <TabsTrigger value="audit">Audit log</TabsTrigger>
            <TabsTrigger value="manovik">MANOVIK</TabsTrigger>
          </TabsList>
          <TabsContent value="users" className="mt-4"><UsersTab currentAdminId={who.userId} /></TabsContent>
          <TabsContent value="purchases" className="mt-4"><PurchasesTab /></TabsContent>
          <TabsContent value="audit" className="mt-4"><AuditTab /></TabsContent>
          <TabsContent value="manovik" className="mt-4"><ManovikTab /></TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: currency || "INR",
    maximumFractionDigits: 0,
  }).format(amount / 100);
}

// -------- Users tab -------------------------------------------------

function UsersTab({ currentAdminId }: { currentAdminId: string }) {
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const search = async () => {
    setLoading(true);
    try {
      const res = await adminSearchUsers({ data: { query: q } });
      setRows(res.users as UserRow[]);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Search failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    search();
  }, []);

  return (
    <Card className="p-4">
      <div className="flex gap-2">
        <Input
          placeholder="Search by email or user id…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
        />
        <Button onClick={search} disabled={loading}>
          <Search className="mr-1 h-4 w-4" /> Search
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border/40">
        <div className="grid grid-cols-12 gap-2 border-b border-border/40 bg-muted/40 px-3 py-2 text-xs font-medium uppercase text-muted-foreground">
          <div className="col-span-5">Email</div>
          <div className="col-span-3">Signed up</div>
          <div className="col-span-2">Last seen</div>
          <div className="col-span-2 text-right">2FA</div>
        </div>
        {loading ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-8 text-center text-sm text-muted-foreground">No users match.</div>
        ) : (
          rows.map((u) => (
            <button
              key={u.id}
              className="grid w-full grid-cols-12 items-center gap-2 border-b border-border/40 px-3 py-2 text-left text-sm last:border-0 hover:bg-muted/30"
              onClick={() => setSelected(u.id)}
            >
              <div className="col-span-5 truncate">
                {u.email ?? <span className="text-muted-foreground">(no email)</span>}
                {!u.confirmed && <Badge variant="outline" className="ml-2">unconfirmed</Badge>}
              </div>
              <div className="col-span-3 text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</div>
              <div className="col-span-2 text-muted-foreground">
                {u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString() : "—"}
              </div>
              <div className="col-span-2 text-right">
                {u.factors > 0 ? (
                  <Badge variant="secondary" className="gap-1"><ShieldCheck className="h-3 w-3" />on</Badge>
                ) : (
                  <span className="text-xs text-muted-foreground">off</span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <UserDetailDialog
        userId={selected}
        onClose={() => setSelected(null)}
        onChanged={search}
        currentAdminId={currentAdminId}
      />
    </Card>
  );
}

// -------- User detail dialog ----------------------------------------

function UserDetailDialog({
  userId,
  onClose,
  onChanged,
  currentAdminId,
}: {
  userId: string | null;
  onClose: () => void;
  onChanged: () => void;
  currentAdminId: string;
}) {
  const [detail, setDetail] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [creditDelta, setCreditDelta] = useState("");
  const [creditReason, setCreditReason] = useState("");

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const res = await adminGetUserDetail({ data: { userId } });
      setDetail(res);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (userId) load();
    else setDetail(null);
  }, [userId]);

  const cancel = async (purchaseId: string) => {
    if (!confirm("Cancel auto-renewal for this subscription?")) return;
    try {
      await adminCancelSubscription({ data: { purchaseId } });
      toast.success("Subscription cancelled");
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const refund = async (p: any) => {
    if (!confirm(`Refund ${fmt(p.amount, p.currency)} for this payment? This cannot be undone.`)) return;
    try {
      await adminRefundPayment({ data: { purchaseId: p.id } });
      toast.success("Refund processed");
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Refund failed");
    }
  };

  const adjustCredits = async () => {
    const n = Number(creditDelta);
    if (!Number.isInteger(n) || n === 0) return toast.error("Enter a non-zero integer");
    if (!creditReason.trim()) return toast.error("Reason required");
    if (!userId) return;
    try {
      await adminAdjustCredits({ data: { userId, delta: n, reason: creditReason.trim() } });
      toast.success("Credits updated");
      setCreditDelta("");
      setCreditReason("");
      load();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  const toggleAdmin = async () => {
    if (!userId) return;
    const isAdmin = (detail?.roles ?? []).includes("admin");
    try {
      if (isAdmin) {
        if (userId === currentAdminId) return toast.error("You cannot revoke your own admin role");
        if (!confirm("Revoke admin role from this user?")) return;
        await adminRevokeRole({ data: { userId, role: "admin" } });
      } else {
        if (!confirm("Grant admin role to this user? They must set up 2FA on their next admin login.")) return;
        await adminGrantRole({ data: { userId, role: "admin" } });
      }
      toast.success("Role updated");
      load();
      onChanged();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed");
    }
  };

  return (
    <Dialog open={!!userId} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>User detail</DialogTitle>
          <DialogDescription>{detail?.user?.email ?? userId}</DialogDescription>
        </DialogHeader>

        {loading || !detail ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : (
          <div className="space-y-5 max-h-[70vh] overflow-y-auto pr-1">
            {/* Roles */}
            <section>
              <h3 className="text-sm font-semibold">Roles</h3>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {(detail.roles as string[]).length === 0 && <span className="text-xs text-muted-foreground">user</span>}
                {(detail.roles as string[]).map((r) => (
                  <Badge key={r} variant="secondary">{r}</Badge>
                ))}
                <Button size="sm" variant="outline" onClick={toggleAdmin}>
                  {(detail.roles as string[]).includes("admin") ? (
                    <><Trash2 className="mr-1 h-3 w-3" /> Revoke admin</>
                  ) : (
                    <><UserPlus className="mr-1 h-3 w-3" /> Grant admin</>
                  )}
                </Button>
              </div>
            </section>

            {/* Credits */}
            <section>
              <h3 className="text-sm font-semibold">AI Credits</h3>
              <p className="mt-1 text-sm">
                Balance: <span className="font-semibold">{detail.credits}</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Input
                  className="w-28"
                  placeholder="±delta"
                  value={creditDelta}
                  onChange={(e) => setCreditDelta(e.target.value.replace(/[^0-9-]/g, ""))}
                />
                <Input
                  className="flex-1 min-w-[180px]"
                  placeholder="Reason (goodwill, refund adj, etc.)"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                />
                <Button size="sm" onClick={adjustCredits}>
                  <Coins className="mr-1 h-3 w-3" /> Apply
                </Button>
              </div>
            </section>

            {/* Purchases */}
            <section>
              <h3 className="text-sm font-semibold">Purchases</h3>
              <div className="mt-2 overflow-hidden rounded-md border border-border/40">
                <div className="grid grid-cols-12 gap-2 bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">
                  <div className="col-span-3">Date</div>
                  <div className="col-span-2">Plan</div>
                  <div className="col-span-2">Amount</div>
                  <div className="col-span-2">Status</div>
                  <div className="col-span-3 text-right">Actions</div>
                </div>
                {detail.purchases.length === 0 ? (
                  <div className="px-3 py-4 text-center text-xs text-muted-foreground">None</div>
                ) : (
                  detail.purchases.map((p: any) => (
                    <div key={p.id} className="grid grid-cols-12 items-center gap-2 border-t border-border/40 px-3 py-2 text-sm">
                      <div className="col-span-3 text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</div>
                      <div className="col-span-2">{p.plan}</div>
                      <div className="col-span-2 font-medium">{fmt(p.amount, p.currency)}</div>
                      <div className="col-span-2"><Badge variant="outline">{p.status}</Badge></div>
                      <div className="col-span-3 flex flex-wrap justify-end gap-1">
                        {p.status === "paid" && p.plan === "pro" && (
                          <Button size="sm" variant="outline" onClick={() => cancel(p.id)}>
                            <Ban className="mr-1 h-3 w-3" /> Cancel
                          </Button>
                        )}
                        {p.status === "paid" && p.razorpay_payment_id && (
                          <Button size="sm" variant="destructive" onClick={() => refund(p)}>
                            Refund
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </section>

            {/* Ledger */}
            <section>
              <h3 className="text-sm font-semibold">Recent credit ledger</h3>
              <div className="mt-2 max-h-40 overflow-y-auto rounded-md border border-border/40">
                {detail.ledger.length === 0 ? (
                  <div className="px-3 py-3 text-xs text-muted-foreground">No activity</div>
                ) : (
                  detail.ledger.map((l: any, i: number) => (
                    <div key={i} className="flex justify-between border-t border-border/40 px-3 py-1 text-xs first:border-0">
                      <span className="text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
                      <span className={l.delta < 0 ? "text-red-500" : "text-green-500"}>{l.delta > 0 ? `+${l.delta}` : l.delta}</span>
                      <span className="truncate text-muted-foreground">{l.reason}</span>
                    </div>
                  ))
                )}
              </div>
            </section>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// -------- Purchases tab ---------------------------------------------

function PurchasesTab() {
  const [status, setStatus] = useState("");
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListPurchases({ data: { status: status || undefined, limit: 200 } });
      setRows(res.purchases);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [status]);

  return (
    <Card className="p-4">
      <div className="flex flex-wrap items-center gap-2">
        {(["", "paid", "created", "failed", "refunded"] as const).map((s) => (
          <Button
            key={s}
            size="sm"
            variant={status === s ? "default" : "outline"}
            onClick={() => setStatus(s)}
          >
            {s || "all"}
          </Button>
        ))}
        <Button size="sm" variant="ghost" className="ml-auto" onClick={load}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>

      <div className="mt-4 overflow-hidden rounded-md border border-border/40">
        <div className="grid grid-cols-12 gap-2 bg-muted/40 px-3 py-2 text-xs uppercase text-muted-foreground">
          <div className="col-span-3">Date</div>
          <div className="col-span-3">Email</div>
          <div className="col-span-2">Plan</div>
          <div className="col-span-2">Amount</div>
          <div className="col-span-2">Status</div>
        </div>
        {loading ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No purchases.</div>
        ) : (
          rows.map((p) => (
            <div key={p.id} className="grid grid-cols-12 items-center gap-2 border-t border-border/40 px-3 py-2 text-sm">
              <div className="col-span-3 text-muted-foreground">{new Date(p.created_at).toLocaleString()}</div>
              <div className="col-span-3 truncate">{p.email ?? "—"}</div>
              <div className="col-span-2">{p.plan}</div>
              <div className="col-span-2 font-medium">{fmt(p.amount, p.currency)}</div>
              <div className="col-span-2"><Badge variant="outline">{p.status}</Badge></div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// -------- Audit tab -------------------------------------------------

function AuditTab() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminListAuditLogs({ data: { limit: 200 } });
      setRows(res.logs);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Last 200 admin actions.</p>
        <Button size="sm" variant="ghost" onClick={load}>
          <RefreshCw className="mr-1 h-3 w-3" /> Refresh
        </Button>
      </div>
      <div className="mt-3 overflow-hidden rounded-md border border-border/40">
        {loading ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="px-3 py-6 text-center text-sm text-muted-foreground">No admin actions yet.</div>
        ) : (
          rows.map((r) => (
            <div key={r.id} className="border-t border-border/40 px-3 py-2 text-xs first:border-0">
              <div className="flex justify-between">
                <span className="font-medium">{r.event_type.replace("admin.", "")}</span>
                <span className="text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
              </div>
              <p className="text-muted-foreground">{r.summary}</p>
              {r.metadata && Object.keys(r.metadata).length > 0 && (
                <code className="mt-1 block break-all rounded bg-muted px-1 py-0.5 text-[10px] text-muted-foreground">
                  {JSON.stringify(r.metadata)}
                </code>
              )}
            </div>
          ))
        )}
      </div>
    </Card>
  );
}

// -------- MANOVIK tab (updates + self-build console) ----------------

function ManovikTab() {
  const [updates, setUpdates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const loadUpdates = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("manovik_brain_updates" as any)
      .select("id, version, notes, metadata, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) toast.error(error.message);
    else setUpdates((data ?? []) as any[]);
    setLoading(false);
  };

  const saveUpdate = async () => {
    if (!notes.trim()) return toast.error("Add release notes first");
    setSaving(true);
    const version = `admin-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "")}`;
    const { error } = await supabase
      .from("manovik_brain_updates" as any)
      .insert({ version, notes: notes.trim(), metadata: { source: "admin" } as any });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success(`Published ${version}`);
    setNotes("");
    loadUpdates();
  };

  useEffect(() => { loadUpdates(); }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Publish MANOVIK update</h3>
          <Badge variant="secondary" className="text-[10px]">admin · unlimited</Badge>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Announces a new brain version. Admin chat calls skip credit metering server-side.
        </p>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={5}
          placeholder="What's new in this brain update…"
          className="mt-3 w-full rounded-md border border-border/60 bg-background p-2 text-sm focus:border-primary/60 focus:outline-none"
        />
        <Button className="mt-3" onClick={saveUpdate} disabled={saving}>
          {saving ? "Publishing…" : "Publish update"}
        </Button>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">Self-build console</h3>
          <Button size="sm" variant="ghost" onClick={loadUpdates}>
            <RefreshCw className="mr-1 h-3 w-3" /> Refresh
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Ask MANOVIK to draft features into the workspace. Generated code lands in the
          landing-page workspace; admin reviews the diff and applies. No repo writes.
        </p>
        <Button className="mt-3" variant="outline" asChild>
          <Link to="/">Open workspace →</Link>
        </Button>
      </Card>

      <Card className="p-4 lg:col-span-2">
        <h3 className="text-sm font-semibold">Brain update history</h3>
        <div className="mt-3 overflow-hidden rounded-md border border-border/40">
          {loading ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">Loading…</div>
          ) : updates.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm text-muted-foreground">No brain updates yet.</div>
          ) : (
            updates.map((u) => (
              <div key={u.id} className="border-t border-border/40 px-3 py-2 text-xs first:border-0">
                <div className="flex justify-between">
                  <span className="font-mono font-medium">{u.version}</span>
                  <span className="text-muted-foreground">{new Date(u.created_at).toLocaleString()}</span>
                </div>
                {u.notes && <p className="mt-1 text-muted-foreground">{u.notes}</p>}
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
