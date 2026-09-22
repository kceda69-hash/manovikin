import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { getMyPurchase } from "@/lib/payments.functions";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Printer } from "lucide-react";

export const Route = createFileRoute("/receipt/$id")({
  component: ReceiptPage,
  head: () => ({
    meta: [
      { title: "Receipt — MANOVIK AI" },
      {
        name: "description",
        content:
          "View and download your MANOVIK AI payment receipt and tax invoice for this transaction.",
      },
      { property: "og:title", content: "Your MANOVIK AI receipt" },
      { property: "og:description", content: "View and download your MANOVIK AI tax invoice." },
      { name: "robots", content: "noindex" },
    ],
  }),
});

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
  name: string | null;
  created_at: string;
};

const PLAN_LABEL: Record<string, string> = {
  pro: "MANOVIK Pro (one-time)",
  sovereign: "MANOVIK Sovereign (lifetime self-host)",
};

function fmt(amount: number, currency: string) {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency }).format(amount / 100);
}

function ReceiptPage() {
  const { id } = Route.useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<Purchase | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) navigate({ to: "/login" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!user) return;
    getMyPurchase({ data: { id } }).then((r) => {
      if (r.error || !r.purchase) setErr(r.error ?? "Not found");
      else setP(r.purchase as Purchase);
    });
  }, [id, user]);

  if (err) return <div className="p-10 text-center text-sm text-muted-foreground">{err}</div>;
  if (!p) return <div className="p-10 text-center text-sm text-muted-foreground">Loading…</div>;

  const tax = Math.round((p.amount * 0.18) / 1.18);
  const net = p.amount - tax;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-3xl px-4 py-8 print:py-0">
        <div className="flex items-center justify-between print:hidden">
          <Link
            to="/billing"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to billing
          </Link>
          <Button onClick={() => window.print()} size="sm">
            <Printer className="h-4 w-4" /> Print / Save PDF
          </Button>
        </div>
        <h1 className="sr-only">Tax Invoice {p.receipt_no ?? p.id.slice(0, 12)}</h1>
        <div className="mt-6 rounded-xl border border-border/60 bg-card p-8 print:border-0 print:p-0">
          <div className="flex items-start justify-between border-b border-border/40 pb-6">
            <div>
              <div className="text-2xl font-bold tracking-tight">MANOVIK AI</div>
              <div className="text-xs text-muted-foreground">Powered by KC 🇮🇳</div>
            </div>
            <div className="text-right">
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Tax Invoice
              </div>
              <div className="font-mono text-sm">{p.receipt_no ?? p.id.slice(0, 12)}</div>
              <div className="text-xs text-muted-foreground">
                {new Date(p.created_at).toLocaleString()}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6 py-6 text-sm">
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">
                Billed to
              </div>
              <div className="mt-1 font-medium">
                {p.name ?? user?.user_metadata?.display_name ?? "Customer"}
              </div>
              <div className="text-muted-foreground">{p.email ?? user?.email}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wider text-muted-foreground">Payment</div>
              <div className="mt-1 font-mono text-xs">{p.razorpay_payment_id ?? "—"}</div>
              <div className="font-mono text-xs text-muted-foreground">
                Order: {p.razorpay_order_id ?? "—"}
              </div>
              <div className="mt-1 inline-flex rounded-full bg-green-500/15 px-2 py-0.5 text-xs font-medium text-green-500">
                {p.status === "paid" ? "PAID" : p.status.toUpperCase()}
              </div>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-y border-border/40 text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2">Description</th>
                <th className="py-2 text-right">Amount</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/40">
                <td className="py-3">{PLAN_LABEL[p.plan] ?? p.plan}</td>
                <td className="py-3 text-right font-medium">{fmt(net, p.currency)}</td>
              </tr>
              <tr className="border-b border-border/40 text-muted-foreground">
                <td className="py-2">GST (18%)</td>
                <td className="py-2 text-right">{fmt(tax, p.currency)}</td>
              </tr>
              <tr>
                <td className="py-3 text-base font-semibold">Total paid</td>
                <td className="py-3 text-right text-base font-semibold">
                  {fmt(p.amount, p.currency)}
                </td>
              </tr>
            </tbody>
          </table>

          <div className="mt-8 border-t border-border/40 pt-4 text-xs text-muted-foreground">
            Thank you for supporting MANOVIK. This is a system-generated receipt and is valid
            without a signature. For questions, reply to your payment confirmation email.
          </div>
        </div>
      </div>
    </div>
  );
}
