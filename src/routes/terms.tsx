import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Terms of Service — MANOVIK AI" },
      {
        name: "description",
        content:
          "MANOVIK AI Terms of Service governing use of our website, products, subscriptions, and APIs.",
      },
      { property: "og:title", content: "Terms of Service — MANOVIK AI" },
      {
        property: "og:description",
        content:
          "MANOVIK AI Terms of Service governing use of our website, products, subscriptions, and APIs.",
      },
      { property: "og:url", content: "https://manovik.in/terms" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Terms of Service — MANOVIK AI" },
      {
        name: "twitter:description",
        content:
          "MANOVIK AI Terms of Service governing use of our website, products, subscriptions, and APIs.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/terms" }],
  }),
});

function TermsPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <span className="text-sm font-semibold">Terms</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 prose prose-invert prose-headings:text-foreground prose-p:text-muted-foreground">
        <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Last updated:{" "}
          {new Date().toLocaleDateString("en-IN", {
            year: "numeric",
            month: "long",
            day: "numeric",
          })}
        </p>

        <section className="mt-8 space-y-6 text-sm leading-relaxed text-muted-foreground">
          <p>
            Welcome to MANOVIK AI ("MANOVIK", "we", "us", "our"). By accessing or using manovik.in
            or any MANOVIK product, you agree to these Terms of Service. If you do not agree, do not
            use the service.
          </p>

          <h2 className="text-xl font-semibold text-foreground">1. Eligibility</h2>
          <p>
            You must be at least 18 years old, or the age of majority in your jurisdiction, to use
            MANOVIK. By using the service you represent that you meet this requirement.
          </p>

          <h2 className="text-xl font-semibold text-foreground">2. Account & Security</h2>
          <p>
            You are responsible for safeguarding your account credentials and for all activity that
            occurs under your account. Notify us immediately at{" "}
            <a className="text-primary" href="mailto:support@manovik.in">
              support@manovik.in
            </a>{" "}
            of any unauthorized use.
          </p>

          <h2 className="text-xl font-semibold text-foreground">
            3. Subscriptions, Pricing & Billing
          </h2>
          <p>
            Pro plans are billed monthly via Razorpay. Sovereign is a one-time lifetime purchase.
            All prices are in INR and inclusive of applicable taxes unless stated otherwise.
            Renewals occur automatically until cancelled from{" "}
            <Link to="/billing" className="text-primary">
              /billing
            </Link>
            .
          </p>

          <h2 className="text-xl font-semibold text-foreground">4. Acceptable Use</h2>
          <p>
            You agree not to use MANOVIK to generate or distribute unlawful, harmful, defamatory, or
            infringing content; attempt to reverse-engineer the service; resell access; or run
            automated abuse against our infrastructure.
          </p>

          <h2 className="text-xl font-semibold text-foreground">5. Intellectual Property</h2>
          <p>
            "MANOVIK", the MANOVIK logo, the site design, code, and trade dress are the exclusive
            property of MANOVIK AI and protected under Indian and international IP law. You retain
            ownership of content you create with the service, subject to our license to operate the
            platform.
          </p>

          <h2 className="text-xl font-semibold text-foreground">6. Disclaimers</h2>
          <p>
            The service is provided "as is" without warranties of any kind. AI output may be
            inaccurate; you are responsible for reviewing it before use in production.
          </p>

          <h2 className="text-xl font-semibold text-foreground">7. Limitation of Liability</h2>
          <p>
            To the maximum extent permitted by law, MANOVIK's aggregate liability for any claim
            shall not exceed the amount you paid to MANOVIK in the 12 months preceding the claim.
          </p>

          <h2 className="text-xl font-semibold text-foreground">8. Termination</h2>
          <p>
            We may suspend or terminate access for violation of these Terms. You may cancel at any
            time from{" "}
            <Link to="/billing" className="text-primary">
              /billing
            </Link>
            .
          </p>

          <h2 className="text-xl font-semibold text-foreground">9. Governing Law</h2>
          <p>
            These Terms are governed by the laws of India. Courts at the seller's place of business
            shall have exclusive jurisdiction.
          </p>

          <h2 className="text-xl font-semibold text-foreground">10. Contact</h2>
          <p>
            Questions? Email{" "}
            <a className="text-primary" href="mailto:support@manovik.in">
              support@manovik.in
            </a>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
