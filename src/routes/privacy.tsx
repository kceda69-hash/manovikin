import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Privacy Policy — MANOVIK AI" },
      { name: "description", content: "How MANOVIK AI collects, uses, stores, and protects your personal data." },
      { property: "og:title", content: "Privacy Policy — MANOVIK AI" },
      { property: "og:url", content: "https://manovik.in/privacy" },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/privacy" }],
  }),
});

function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <span className="text-sm font-semibold">Privacy</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10">
        <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
        <p className="mt-2 text-sm text-muted-foreground">Last updated: {new Date().toLocaleDateString("en-IN", { year: "numeric", month: "long", day: "numeric" })}</p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>MANOVIK AI ("we") respects your privacy. This policy describes what data we collect, why, and your rights.</p>

          <h2 className="text-xl font-semibold text-foreground">Data we collect</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Account: email, display name, auth provider ID.</li>
            <li>Usage: chat threads, audit logs, IP and user-agent for security.</li>
            <li>Payments: order/payment IDs and receipts (card data is handled solely by Razorpay; we never see it).</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">How we use it</h2>
          <ul className="list-disc pl-5 space-y-1">
            <li>Provide and improve the service.</li>
            <li>Process payments and send receipts.</li>
            <li>Prevent abuse, fraud, and security incidents.</li>
            <li>Send essential transactional emails (you can unsubscribe from marketing at any time).</li>
          </ul>

          <h2 className="text-xl font-semibold text-foreground">Sharing</h2>
          <p>We do not sell personal data. We share data only with sub-processors required to operate the service (hosting, database, email, payments) under appropriate safeguards.</p>

          <h2 className="text-xl font-semibold text-foreground">Retention</h2>
          <p>Data is retained while your account is active and for a reasonable period afterwards for legal, tax, and security purposes.</p>

          <h2 className="text-xl font-semibold text-foreground">Your rights</h2>
          <p>You may request access, correction, export, or deletion of your data by emailing <a className="text-primary" href="mailto:privacy@manovik.in">privacy@manovik.in</a>.</p>

          <h2 className="text-xl font-semibold text-foreground">Security</h2>
          <p>Data is encrypted in transit (TLS) and at rest. Threads are scoped per-user with row-level security.</p>

          <h2 className="text-xl font-semibold text-foreground">Contact</h2>
          <p>Grievance Officer: <a className="text-primary" href="mailto:privacy@manovik.in">privacy@manovik.in</a></p>
        </section>
      </main>
    </div>
  );
}
