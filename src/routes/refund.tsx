import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/refund")({
  component: RefundPage,
  head: () => ({
    meta: [
      { title: "Refund & Cancellation Policy — MANOVIK AI" },
      { name: "description", content: "MANOVIK AI refund, cancellation, and shipping policy for digital subscriptions and lifetime purchases." },
      { property: "og:title", content: "Refund & Cancellation Policy — MANOVIK AI" },
      { property: "og:description", content: "MANOVIK AI refund, cancellation, and shipping policy for digital subscriptions and lifetime purchases." },
      { property: "og:url", content: "https://manovik.in/refund" },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/refund" }],
  }),
});

function RefundPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <span className="text-sm font-semibold">Refund & Cancellation</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 space-y-6 text-sm leading-relaxed text-muted-foreground">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Refund & Cancellation Policy</h1>

        <h2 className="text-xl font-semibold text-foreground">Digital Service — No Shipping</h2>
        <p>MANOVIK AI is a 100% digital SaaS product. There is no physical shipment. Access is granted instantly on successful payment.</p>

        <h2 className="text-xl font-semibold text-foreground">Cancellation</h2>
        <p>Pro monthly subscriptions can be cancelled anytime from <Link to="/billing" className="text-primary">/billing</Link>. Your access continues until the end of the current billing period; you will not be charged again.</p>

        <h2 className="text-xl font-semibold text-foreground">Refunds</h2>
        <p>Because MANOVIK delivers compute and AI services instantly, all sales are generally final. However, we offer a discretionary refund within 7 days of purchase if the service was materially non-functional on our side. Email <a className="text-primary" href="mailto:support@manovik.in">support@manovik.in</a> with your payment ID and we will respond within 3 business days.</p>

        <h2 className="text-xl font-semibold text-foreground">Refund Method</h2>
        <p>Approved refunds are issued to the original payment method via Razorpay within 5–10 business days.</p>

        <h2 className="text-xl font-semibold text-foreground">Failed Payments</h2>
        <p>If your account was debited but no plan was activated, contact <a className="text-primary" href="mailto:support@manovik.in">support@manovik.in</a> with your Razorpay Order ID. Razorpay typically auto-reverses failed authorizations within 5–7 business days.</p>
      </main>
    </div>
  );
}
