import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  useRouterState,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { Toaster } from "@/components/ui/sonner";
import { initPerf } from "@/lib/perf";
import { initClientErrorMonitor } from "@/lib/client-error-monitor";
import { I18nProvider, useI18n } from "@/lib/i18n";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">{t("notfound.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("notfound.body")}</p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("notfound.goHome")}
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  const { t } = useI18n();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          {t("error.pageTitle")}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">{t("error.pageBody")}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("cta.retry")}
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            {t("notfound.goHome")}
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { name: "author", content: "MANOVIK AI" },
      { property: "og:site_name", content: "MANOVIK AI" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "twitter:site", content: "@manovikai" },
      { name: "google-site-verification", content: "2FYBW62bNs978cpUu3IS_F1pqZPeFNyWsh0uZBRHb3w" },
    ],
    links: [
      { rel: "preconnect", href: "https://cdn.gpteng.co", crossOrigin: "anonymous" },
      { rel: "dns-prefetch", href: "https://cdn.gpteng.co" },
      {
        rel: "stylesheet",
        href: appCss,
      },
    ],
    scripts: [
      {
        type: "application/ld+json",
        children: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": [
            {
              "@type": "Organization",
              "@id": "https://manovik.in/#organization",
              name: "MANOVIK AI",
              url: "https://manovik.in",
              logo: {
                "@type": "ImageObject",
                url: "https://manovik.in/favicon.ico",
              },
              description:
                "Autonomous AI agent that codes, builds, and ships software 24/7.",
              sameAs: [
                "https://twitter.com/manovikai",
                "https://manovikin.lovable.app",
              ],
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer support",
                url: "https://manovik.in/contact",
                availableLanguage: ["English", "Hindi"],
              },
            },
            {
              "@type": "WebSite",
              "@id": "https://manovik.in/#website",
              name: "MANOVIK AI",
              url: "https://manovik.in",
              publisher: { "@id": "https://manovik.in/#organization" },
              inLanguage: "en",
              potentialAction: {
                "@type": "SearchAction",
                target: {
                  "@type": "EntryPoint",
                  urlTemplate: "https://manovik.in/?q={search_term_string}",
                },
                "query-input": "required name=search_term_string",
              },
            },
          ],
        }),
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

const BREADCRUMB_LABELS: Record<string, string> = {
  setup: "Setup",
  login: "Login",
  contact: "Contact",
  privacy: "Privacy",
  terms: "Terms",
  refund: "Refund",
  blog: "Blog",
  "best-ai-coding-agent": "Best AI coding agent",
  "ai-coding-assistant": "AI coding assistant",
  "best-ai-coding-agents": "Best AI coding agents",
  "will-ai-replace-software-engineers": "Will AI replace software engineers?",
  students: "Students & Educators",
  billing: "Billing",
  chat: "Chat",
  balance: "Balance",
  audit: "Audit log",
  seo: "SEO health",
  receipt: "Receipt",
  unsubscribe: "Unsubscribe",
};

function humanize(segment: string) {
  return (
    BREADCRUMB_LABELS[segment] ??
    segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}

function BreadcrumbJsonLd() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const json = useMemo(() => {
    const clean = pathname.split("?")[0].split("#")[0];
    const parts = clean.split("/").filter(Boolean);
    if (parts.length === 0) return null;
    const items = [
      { "@type": "ListItem", position: 1, name: "Home", item: "https://manovik.in/" },
      ...parts.map((seg, i) => ({
        "@type": "ListItem",
        position: i + 2,
        name: humanize(decodeURIComponent(seg)),
        item: `https://manovik.in/${parts.slice(0, i + 1).join("/")}`,
      })),
    ];
    return JSON.stringify({
      "@context": "https://schema.org",
      "@type": "BreadcrumbList",
      itemListElement: items,
    }).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026").replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
  }, [pathname]);

  if (!json) return null;
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: json }}
    />
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { initPerf(); initClientErrorMonitor(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <I18nProvider>
        <BreadcrumbJsonLd />
        <Outlet />
        <Toaster richColors position="top-right" />
      </I18nProvider>
    </QueryClientProvider>
  );
}
