import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Mail, Globe, MapPin } from "lucide-react";

export const Route = createFileRoute("/contact")({
  component: ContactPage,
  head: () => ({
    meta: [
      { title: "Contact — MANOVIK AI" },
      { name: "description", content: "Contact MANOVIK AI for support, sales, partnerships, and grievances." },
      { property: "og:title", content: "Contact — MANOVIK AI" },
      { property: "og:description", content: "Reach MANOVIK AI for support, sales, partnerships, and grievance redressal." },
      { property: "og:url", content: "https://manovik.in/contact" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Contact — MANOVIK AI" },
      { name: "twitter:description", content: "Reach MANOVIK AI for support, sales, partnerships, and grievance redressal." },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/contact" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "MANOVIK AI",
          url: "https://manovik.in",
          email: "support@manovik.in",
          areaServed: "IN",
          contactPoint: [
            {
              "@type": "ContactPoint",
              email: "support@manovik.in",
              contactType: "customer support",
              areaServed: "IN",
              availableLanguage: ["English", "Hindi"],
            },
            {
              "@type": "ContactPoint",
              email: "sales@manovik.in",
              contactType: "sales",
              areaServed: "IN",
            },
          ],
        }),
      },
    ],
  }),
});

function ContactPage() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border/40">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-4">
          <Link to="/" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back to home
          </Link>
          <span className="text-sm font-semibold">Contact</span>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-4 py-10 space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Contact MANOVIK AI</h1>
        <p className="text-muted-foreground">We typically respond within one business day.</p>

        <div className="grid gap-4 sm:grid-cols-2">
          <a href="mailto:support@manovik.in" className="rounded-xl border border-border/60 bg-card/40 p-5 hover:border-primary/50 transition">
            <Mail className="h-5 w-5 text-primary" />
            <div className="mt-2 font-semibold">Support</div>
            <div className="text-sm text-muted-foreground">support@manovik.in</div>
          </a>
          <a href="mailto:sales@manovik.in" className="rounded-xl border border-border/60 bg-card/40 p-5 hover:border-primary/50 transition">
            <Mail className="h-5 w-5 text-primary" />
            <div className="mt-2 font-semibold">Sales & Partnerships</div>
            <div className="text-sm text-muted-foreground">sales@manovik.in</div>
          </a>
          <a href="mailto:privacy@manovik.in" className="rounded-xl border border-border/60 bg-card/40 p-5 hover:border-primary/50 transition">
            <Mail className="h-5 w-5 text-primary" />
            <div className="mt-2 font-semibold">Grievance Officer</div>
            <div className="text-sm text-muted-foreground">privacy@manovik.in</div>
          </a>
          <div className="rounded-xl border border-border/60 bg-card/40 p-5">
            <Globe className="h-5 w-5 text-primary" />
            <div className="mt-2 font-semibold">Website</div>
            <div className="text-sm text-muted-foreground">https://manovik.in</div>
          </div>
          <div className="rounded-xl border border-border/60 bg-card/40 p-5 sm:col-span-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div className="mt-2 font-semibold">Registered Operator</div>
            <div className="text-sm text-muted-foreground">MANOVIK AI · India</div>
            <div className="mt-1 text-xs text-muted-foreground">For postal correspondence, request the address by email and we'll share it directly.</div>
          </div>
        </div>
      </main>
    </div>
  );
}
