import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { GraduationCap, BookOpen, Users, ArrowRight, Mail, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/students")({
  component: StudentsPage,
  head: () => ({
    meta: [
      { title: "Students & Educators — MANOVIK AI" },
      {
        name: "description",
        content:
          "MANOVIK AI for students and educators: learn to build apps, APIs, and automations with an autonomous coding agent. Discounted education pricing coming soon.",
      },
      {
        name: "keywords",
        content:
          "AI for students, AI coding assistant education, learn coding with AI, educator discount, student discount, MANOVIK AI for schools",
      },
      { property: "og:title", content: "Students & Educators — MANOVIK AI" },
      {
        property: "og:description",
        content:
          "Learn to build apps, APIs, and automations with an autonomous AI coding agent. Education pricing and classroom tools coming soon.",
      },
      { property: "og:url", content: "https://manovik.in/students" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:title", content: "Students & Educators — MANOVIK AI" },
      {
        name: "twitter:description",
        content:
          "Learn to build apps, APIs, and automations with an autonomous AI coding agent. Education pricing and classroom tools coming soon.",
      },
    ],
    links: [{ rel: "canonical", href: "https://manovik.in/students" }],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "WebPage",
              name: "Students & Educators — MANOVIK AI",
              description:
                "MANOVIK AI for students and educators. Education pricing and classroom tooling coming soon.",
              url: "https://manovik.in/students",
              mainEntity: {
                "@type": "Organization",
                name: "MANOVIK AI",
                url: "https://manovik.in",
              },
            },
            {
              "@type": "FAQPage",
              mainEntity: FAQ.map((item) => ({
                "@type": "Question",
                name: item.q,
                acceptedAnswer: { "@type": "Answer", text: item.a },
              })),
            },
          ],
        }),
      },
    ],
  }),
});

const BENEFITS = [
  {
    icon: GraduationCap,
    title: "Learn by shipping",
    desc: "Turn coursework into real projects. MANOVIK explains, codes, and deploys alongside you.",
  },
  {
    icon: BookOpen,
    title: "Classroom-ready",
    desc: "Educators get team workspaces, usage insights, and private infrastructure for every class.",
  },
  {
    icon: Users,
    title: "Built for collaboration",
    desc: "Students work together in shared threads while teachers review progress and give feedback.",
  },
];

const FAQ = [
  {
    q: "What is the MANOVIK AI student and educator program?",
    a: "It is an education initiative that gives students, teachers, and institutions discounted access to MANOVIK AI, plus classroom tools designed for learning and teaching software development.",
  },
  {
    q: "Who is eligible for the education discount?",
    a: "Verified students enrolled at accredited schools, colleges, or universities, as well as teachers, professors, and institutional IT administrators, are eligible.",
  },
  {
    q: "Can MANOVIK AI be used in coding classes and bootcamps?",
    a: "Yes. MANOVIK can scaffold assignments, explain code, debug student projects, and deploy real apps so learners focus on concepts instead of boilerplate.",
  },
  {
    q: "Is student data kept private?",
    a: "Absolutely. MANOVIK threads are encrypted at rest, never used to train third-party models, and can run fully self-hosted for universities that require data sovereignty.",
  },
  {
    q: "When will education pricing and classroom features be available?",
    a: "We are actively building the program. Join the early-access list by emailing edu@manovik.in to get updates and help shape the roadmap.",
  },
];

function StudentsPage() {
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const toggleFaq = (i: number) => setFaqOpen((cur) => (cur === i ? null : i));
  return (
    <main className="hero-surface relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 -z-10 [contain:paint]">
        <div className="absolute inset-0 bg-grid opacity-[0.18]" />
        <div className="absolute inset-0 mesh-aurora" />
        <div className="absolute -top-40 left-1/2 h-[640px] w-[640px] -translate-x-1/2 rounded-full bg-aurora opacity-25 blur-3xl animate-blob" />
      </div>

      <section className="relative z-10 mx-auto max-w-4xl px-6 pb-24 pt-24 text-center">
        <div className="mx-auto mb-8 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-card/40 px-4 py-1.5 text-xs font-medium text-primary backdrop-blur animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Education program — early access
        </div>

        <h1 className="text-balance text-4xl font-bold leading-tight tracking-tight md:text-6xl animate-fade-in">
          <span className="text-gradient text-shimmer">MANOVIK</span> for students & educators
        </h1>

        <p
          className="mx-auto mt-6 max-w-2xl text-balance text-lg text-muted-foreground md:text-xl animate-fade-in"
          style={{ animationDelay: "120ms", animationFillMode: "both" }}
        >
          A self-hosted, privacy-first AI coding agent that helps students learn modern development
          and helps educators teach at scale. Education pricing and classroom features are coming
          soon.
        </p>

        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-3 animate-fade-in"
          style={{ animationDelay: "240ms", animationFillMode: "both" }}
        >
          <a href="mailto:edu@manovik.in">
            <Button
              size="lg"
              className="group relative overflow-hidden bg-aurora text-primary-foreground glow hover:opacity-95"
            >
              <span className="relative z-10 inline-flex items-center">
                Get in touch
                <Mail className="ml-2 h-4 w-4 transition-transform duration-300 group-hover:scale-110" />
              </span>
              <span className="btn-sheen" aria-hidden="true" />
            </Button>
          </a>
          <Link to="/">
            <Button
              size="lg"
              variant="outline"
              className="border-primary/40 bg-card/40 backdrop-blur hover-scale"
            >
              Explore MANOVIK
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>

        <div className="mt-20 grid gap-4 md:grid-cols-3">
          {BENEFITS.map((b, i) => (
            <div
              key={b.title}
              className="surface-card tilt-card group relative overflow-hidden rounded-xl p-6 text-left animate-fade-in"
              style={{ animationDelay: `${360 + i * 80}ms`, animationFillMode: "both" }}
            >
              <span className="card-border-glow" aria-hidden="true" />
              <b.icon className="h-6 w-6 text-primary transition-transform duration-300 group-hover:scale-110" />
              <h2 className="mt-4 text-lg font-semibold">{b.title}</h2>
              <p className="mt-2 text-sm text-muted-foreground">{b.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-20 text-left animate-fade-in">
          <div className="surface-card relative overflow-hidden rounded-2xl p-8 md:p-10">
            <span className="card-border-glow" aria-hidden="true" />
            <h2 className="text-2xl font-bold md:text-3xl">Program details</h2>
            <p className="mt-4 text-muted-foreground">
              We are building a dedicated education plan with verified student discounts,
              institution licensing, and curriculum-aligned project templates. If you are a student,
              teacher, or school administrator, reach out — we would love to shape this with you.
            </p>
            <ul className="mt-6 space-y-3 text-sm text-muted-foreground">
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                Discounted pricing for verified students and educators.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                Classroom dashboards and assignment-friendly project sharing.
              </li>
              <li className="flex items-start gap-3">
                <span className="mt-0.5 h-2 w-2 rounded-full bg-primary" />
                Self-host option for universities that need data sovereignty.
              </li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <a href="mailto:edu@manovik.in">
                <Button className="bg-primary text-primary-foreground hover:opacity-90">
                  Request early access
                </Button>
              </a>
              <Link to="/contact">
                <Button variant="outline" className="border-primary/40 bg-card/40 hover-scale">
                  Contact sales
                </Button>
              </Link>
            </div>
          </div>
        </div>
        <div className="mt-20 text-left animate-fade-in">
          <div className="surface-card relative overflow-hidden rounded-2xl p-8 md:p-10">
            <span className="card-border-glow" aria-hidden="true" />
            <h2 className="text-2xl font-bold md:text-3xl">Frequently asked questions</h2>
            <p className="mt-4 text-muted-foreground">
              Quick answers about MANOVIK AI for students, educators, and institutions.
            </p>
            <dl className="mt-8 space-y-3">
              {FAQ.map((item, i) => {
                const open = faqOpen === i;
                return (
                  <div
                    key={item.q}
                    className={`overflow-hidden rounded-xl border transition-colors ${
                      open
                        ? "border-primary/40 bg-card/60"
                        : "border-border/40 bg-card/40 hover:bg-card/60"
                    }`}
                  >
                    <dt>
                      <button
                        type="button"
                        onClick={() => toggleFaq(i)}
                        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium"
                        aria-expanded={open}
                      >
                        {item.q}
                        <ChevronDown
                          className={`h-4 w-4 shrink-0 text-primary transition-transform duration-200 ${
                            open ? "rotate-180" : ""
                          }`}
                        />
                      </button>
                    </dt>
                    <dd
                      className={`px-5 text-sm text-muted-foreground transition-all duration-200 ${
                        open ? "pb-5 pt-0 opacity-100" : "h-0 overflow-hidden opacity-0"
                      }`}
                    >
                      {item.a}
                    </dd>
                  </div>
                );
              })}
            </dl>
          </div>
        </div>
      </section>
    </main>
  );
}
