import { createFileRoute } from "@tanstack/react-router";
import { getServerEnv } from "@/lib/server-env";
import {
  exchangeCodeForTokens,
  isGoogleWorkspaceConfigured,
  parseOAuthState,
  saveWorkspaceTokens,
} from "@/lib/integrations/google-workspace.server";

const STATE_COOKIE = "gw_oauth_state";

function readCookie(request: Request, name: string): string | null {
  const header = request.headers.get("cookie") ?? "";
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === name) return decodeURIComponent(rest.join("="));
  }
  return null;
}

function redirectToAccount(params: Record<string, string>): Response {
  const origin = (getServerEnv("APP_ORIGIN") ?? "https://manovik.in").replace(/\/$/, "");
  const url = new URL("/account", origin);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = new Headers({ Location: url.toString() });
  // Clear the one-time state cookie either way.
  headers.append(
    "Set-Cookie",
    `${STATE_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax`,
  );
  return new Response(null, { status: 302, headers });
}

export const Route = createFileRoute("/api/integrations/google/callback")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!isGoogleWorkspaceConfigured()) {
          return redirectToAccount({ gw: "error", reason: "not_configured" });
        }
        const url = new URL(request.url);
        const code = url.searchParams.get("code");
        const state = url.searchParams.get("state");
        const oauthError = url.searchParams.get("error");
        if (oauthError) return redirectToAccount({ gw: "error", reason: "denied" });

        const parsed = parseOAuthState(state, readCookie(request, STATE_COOKIE));
        if (!parsed || !code) {
          return redirectToAccount({ gw: "error", reason: "bad_state" });
        }
        try {
          const tokens = await exchangeCodeForTokens(code);
          await saveWorkspaceTokens(parsed.userId, tokens);
          return redirectToAccount({ gw: "linked" });
        } catch (e) {
          console.error(
            "[google-workspace] callback failed",
            e instanceof Error ? e.message : e,
          );
          return redirectToAccount({ gw: "error", reason: "exchange_failed" });
        }
      },
    },
  },
});
