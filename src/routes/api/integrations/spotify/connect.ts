import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { getServerEnv } from "@/lib/server-env";
import {
  SP_NOT_CONFIGURED_MESSAGE,
  buildConnectUrl,
  isSpotifyConfigured,
  makeOAuthState,
} from "@/lib/integrations/spotify.server";

const STATE_COOKIE = "sp_oauth_state";

async function requireUserId(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) throw new Response("Unauthorized", { status: 401 });
  const token = authHeader.slice(7);
  const supabase = createClient(getServerEnv("SUPABASE_URL")!, getServerEnv("SUPABASE_PUBLISHABLE_KEY")!, {
    global: { headers: { Authorization: `Bearer ${token}` } },
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data, error } = await supabase.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") throw new Response("Unauthorized", { status: 401 });
  return sub;
}

export const Route = createFileRoute("/api/integrations/spotify/connect")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        if (!isSpotifyConfigured()) {
          return new Response(JSON.stringify({ error: SP_NOT_CONFIGURED_MESSAGE }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
        const userId = await requireUserId(request);
        const { state, nonce } = makeOAuthState(userId);
        const url = buildConnectUrl(state);
        const headers = new Headers({ "Content-Type": "application/json" });
        headers.append(
          "Set-Cookie",
          `${STATE_COOKIE}=${nonce}; Path=/; Max-Age=600; HttpOnly; Secure; SameSite=Lax`,
        );
        return new Response(JSON.stringify({ url }), { headers });
      },
    },
  },
});
