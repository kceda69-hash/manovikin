import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Toaster } from "@/components/ui/sonner";
import { initPerf } from "@/lib/perf";

import appCss from "../styles.css?url";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold text-foreground">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          This page didn't load
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Something went wrong on our end. You can try refreshing or head back home.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Go home
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
      { title: "MANOVIK AI" },
      { name: "description", content: "MANOVIK AI is an autonomous AI agent that codes in any language, builds websites, apps, and APIs, and works for you 24/7." },
      { name: "author", content: "MANOVIK AI" },
      { property: "og:site_name", content: "MANOVIK AI" },
      { property: "og:title", content: "MANOVIK AI — Autonomous AI Employee for Apps & APIs" },
      { property: "og:description", content: "MANOVIK AI is an autonomous coding agent that builds apps, APIs, and automations 24/7 — your futuristic AI employee." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "twitter:site", content: "@manovikai" },
      { name: "twitter:title", content: "MANOVIK AI — Autonomous AI Employee for Apps & APIs" },
      { name: "twitter:description", content: "Autonomous coding agent that builds apps, APIs, and automations 24/7 — your futuristic AI employee." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b60b2fb0-e5b2-4664-957d-ccee1257580a/id-preview-b60afdf7--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app-1778327527940.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/b60b2fb0-e5b2-4664-957d-ccee1257580a/id-preview-b60afdf7--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app-1778327527940.png" },
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
              name: "MANOVIK AI",
              url: "https://manovikin.lovable.app",
              description: "Autonomous AI agent that codes, builds, and ships software 24/7.",
            },
            {
              "@type": "WebSite",
              name: "MANOVIK AI",
              url: "https://manovikin.lovable.app",
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

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  useEffect(() => { initPerf(); }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="top-right" />
    </QueryClientProvider>
  );
}
