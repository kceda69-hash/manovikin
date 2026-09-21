import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const BodySchema = z.object({
  email: z.string().email().max(254),
  redirectTo: z.string().url().max(2048).optional(),
});

const ALLOWED_REDIRECT_HOSTS = new Set([
  "manovik.in",
  "www.manovik.in",
  "manovikin.lovable.app",
  "id-preview--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app",
]);

function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return request.headers.get("cf-connecting-ip") || request.headers.get("x-real-ip") || "unknown";
}

function safeRedirect(input: string | undefined, origin: string): string {
  if (!input) return `${origin}/auth/callback`;
  try {
    const u = new URL(input);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
    if (!ALLOWED_REDIRECT_HOSTS.has(u.hostname) && u.hostname !== "localhost") {
      return `${origin}/auth/callback`;
    }
    return u.toString();
  } catch {
    return `${origin}/auth/callback`;
  }
}

export const Route = createFileRoute("/api/auth/magic-link")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        let json: unknown;
        try {
          json = await request.json();
        } catch {
          return Response.json({ error: "Invalid JSON" }, { status: 400 });
        }

        const parsed = BodySchema.safeParse(json);
        if (!parsed.success) {
          return Response.json({ error: "Invalid input" }, { status: 400 });
        }

        const { email } = parsed.data;
        const ip = getClientIp(request);
        const origin = new URL(request.url).origin;
        const emailRedirectTo = safeRedirect(parsed.data.redirectTo, origin);

        // Rate-limit check + record (atomic in the DB).
        const { data: rl, error: rlErr } = await supabaseAdmin.rpc(
          "magic_link_check_and_record" as never,
          { _email: email, _ip: ip } as never,
        );

        if (rlErr) {
          console.error("[magic-link] rate-limit rpc failed", rlErr);
          return Response.json({ error: "Service unavailable" }, { status: 503 });
        }

        const result = rl as {
          allowed: boolean;
          reason?: string;
          retry_after_sec: number;
        };

        if (!result.allowed) {
          return Response.json(
            {
              error: "Rate limited. Try again shortly.",
              reason: result.reason,
              retryAfterSec: result.retry_after_sec,
            },
            {
              status: 429,
              headers: {
                "Retry-After": String(result.retry_after_sec || 60),
              },
            },
          );
        }

        // Trigger Supabase to mint an OTP + fire our /lovable/email/auth/webhook.
        // Use the publishable key client — signInWithOtp is meant to be called
        // client-side, but doing it server-side lets us apply the rate limit
        // before Supabase even accepts the request.
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
        const publishableKey =
          import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

        if (!supabaseUrl || !publishableKey) {
          console.error("[magic-link] missing supabase env");
          return Response.json({ error: "Server configuration error" }, { status: 500 });
        }

        const client = createClient(supabaseUrl, publishableKey, {
          auth: { persistSession: false, autoRefreshToken: false },
        });

        const { error } = await client.auth.signInWithOtp({
          email,
          options: {
            emailRedirectTo,
            // Don't auto-create users unless you want passwordless signup:
            shouldCreateUser: true,
          },
        });

        if (error) {
          console.error("[magic-link] signInWithOtp failed", {
            message: error.message,
          });
          // Return a generic ok anyway to prevent user enumeration.
          return Response.json({ ok: true });
        }

        return Response.json({ ok: true });
      },
    },
  },
});
