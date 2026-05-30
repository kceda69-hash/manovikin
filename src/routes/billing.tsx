import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { listMyPurchases, cancelRenewal } from "@/lib/payments.functions";
import { startCheckout } from "@/lib/razorpay-checkout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { ArrowLeft, Crown, CheckCircle2, XCircle, Clock, Download } from "lucide-react";

type Purchase = {
  id: string;
  plan: string;
  amount: number;
  currency: string;
  status: string;
  razorpay_payment_id: string | null;
  razorpay_order_id: string | null;
  receipt_no: string | null;
  email: string | null;
  created_at: string;
  metadata?: Record<string, unknown> | null;
};

export const Route = createFileRoute("/billing")({
  component: BillingPage,
  head: () => ({
    meta: [
      { title: "Billing — MANOVIK AI" },
      { name: "description", content: "View your MANOVIK plan, purchase history, and download receipts." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

const PLAN_LABEL: Record<string, string> = {
  pro: "Pro (monthly)",
  sovereign: "Sovereign (lifetime)",
  free: "Free",
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount / 100);
}

function BillingPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<Purchase[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const res = await listMyPurchases();
      setRows((res.purchases as Purchase[]) ?? []);
    } catch (e) {
      toast.error("Could not load billing history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (user) load(); /* eslint-disable-next-line */ }, [user]);

  const paid = rows.filter((r) => r.status === "paid");
  const sovereign = paid.find((r) => r.plan === "sovereign");
  const activePro = paid.find((r) => r.plan === "pro");
  const currentPlan = sovereign ? "sovereign" : activePro ? "pro" : "free";

  const buy = async (plan: "pro" | "sovereign") => {
    await startCheckout(plan, {
      onSuccess: () => { toast.success("Payment successful — receipt emailed"); load(); },
      onError: (m) => toast.error(m),
      prefill: { email: user?.email ?? undefined },
    });
  };

  const autoRenew = (activePro?.metadata as Record<string, unknown> | null)?.auto_renew !== false;
  const nextChargeDate = activePro
    ? new Date(new Date(activePro.created_at).getTime() + 30 * 24 * 60 * 60 * 1000).toLocaleDateString()
    : null;

  const toggleRenewal = async (next: boolean) => {
    try {
      await cancelRenewal({ data: { autoRenew: next } });
      toast.success(next ? "Auto-renewal resumed" : "Auto-renewal cancelled — access continues until period end");
      load();
    } catch {
      toast.error("Could not update renewal");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </Link>
          <span className="text-sm font-semibold">Billing</span>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10 space-y-8">
        <section>
          <h1 className="text-2xl font-bold tracking-tight">Your plan</h1>
          <Card className="mt-4 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Crown className="h-5 w-5 text-primary" />
                <span className="text-lg font-semibold">{PLAN_LABEL[currentPlan]}</span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentPlan === "sovereign" && "Lifetime self-host. No renewals."}
                {currentPlan === "pro" && (autoRenew
                  ? `Monthly subscription. Next charge ~${nextChargeDate}.`
                  : `Auto-renewal cancelled. Access continues until ${nextChargeDate}.`)}
                {currentPlan === "free" && "Upgrade to unlock Pro features."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {currentPlan === "pro" && (
                autoRenew ? (
                  <Button variant="outline" onClick={() => toggleRenewal(false)}>Cancel auto-renewal</Button>
                ) : (
                  <Button variant="outline" onClick={() => toggleRenewal(true)}>Resume auto-renewal</Button>
                )
              )}
              {currentPlan !== "sovereign" && (
                <>
                  {currentPlan !== "pro" && (
                    <Button onClick={() => buy("pro")}>Upgrade to Pro — ₹499/mo</Button>
                  )}
                  <Button variant="outline" onClick={() => buy("sovereign")}>
                    Buy Sovereign — ₹1,999
                  </Button>
                </>
              )}
            </div>
          </Card>
        </section>

        <section>
          <h2 className="text-lg font-semibold">Purchase history</h2>
          <Card className="mt-3 overflow-hidden">
            <div className="grid grid-cols-12 gap-2 border-b border-border/40 bg-muted/40 px-4 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              <div className="col-span-3">Date</div>
              <div className="col-span-3">Plan</div>
              <div className="col-span-2">Amount</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Receipt</div>
            </div>
            {loading ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">Loading…</div>
            ) : rows.length === 0 ? (
              <div className="px-4 py-10 text-center text-sm text-muted-foreground">No purchases yet.</div>
            ) : (
              rows.map((r) => (
                <div key={r.id} className="grid grid-cols-12 items-center gap-2 border-b border-border/40 px-4 py-3 text-sm last:border-0">
                  <div className="col-span-3 text-muted-foreground">{new Date(r.created_at).toLocaleString()}</div>
                  <div className="col-span-3">{PLAN_LABEL[r.plan] ?? r.plan}</div>
                  <div className="col-span-2 font-medium">{fmt(r.amount, r.currency)}</div>
                  <div className="col-span-2">
                    {r.status === "paid" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-green-500/15 px-2 py-0.5 text-xs text-green-500"><CheckCircle2 className="h-3 w-3" /> Paid</span>
                    ) : r.status === "failed" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-500"><XCircle className="h-3 w-3" /> Failed</span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-500"><Clock className="h-3 w-3" /> {r.status}</span>
                    )}
                  </div>
                  <div className="col-span-2 text-right">
                    {r.status === "paid" ? (
                      <Link to="/receipt/$id" params={{ id: r.id }} className="inline-flex items-center gap-1 text-primary hover:underline">
                        <Download className="h-3 w-3" /> View
                      </Link>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Subscriptions renew automatically through Razorpay. To cancel renewals, email support — we'll stop your next charge and your access continues until period end.
          </p>
        </section>
      </main>
    </div>
  );
}
