import { createFileRoute } from "@tanstack/react-router";

/**
 * Public probe: which third-party OAuth providers are actually enabled on the
 * Supabase project. The login page uses this to show the Google button only
 * when clicking it can succeed — otherwise users would land on a dead broker
 * URL or a raw "provider is not enabled" error page.
 *
 * The check is done server-side (no CORS issues): hitting GoTrue's authorize
 * endpoint for a disabled provider returns 400 "Unsupported provider", while
 * an enabled provider redirects (302) to the upstream IdP.
 */
async function probeProvider(provider: string): Promise<boolean> {
  const base = process.env.SUPABASE_URL;
  if (!base) return false;
  try {
    const res = await fetch(
      `${base.replace(/\/$/, "")}/auth/v1/authorize?provider=${encodeURIComponent(provider)}`,
      { method: "GET", redirect: "manual" },
    );
    // 400 = GoTrue's "Unsupported provider: provider is not enabled".
    // Anything else (302 to the IdP, 200, …) means the provider is wired up.
    return res.status !== 400;
  } catch {
    return false;
  }
}

export const Route = createFileRoute("/api/auth/providers")({
  server: {
    handlers: {
      GET: async () => {
        const google = await probeProvider("google");
        return new Response(JSON.stringify({ google }), {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            // Provider config changes rarely; a short cache keeps the login
            // page fast without going stale for long.
            "Cache-Control": "public, max-age=300",
          },
        });
      },
    },
  },
});
