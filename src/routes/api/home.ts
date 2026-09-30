import "@tanstack/react-start";
import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  linkAccount,
  unlinkAccount,
  linkStatus,
  listDevices,
  sendCommand,
  HOME_ACTIONS,
  NOT_LINKED_MESSAGE,
  TUYA_REGIONS,
} from "@/lib/smarthome/tuya.server";

const MAX_BODY_BYTES = 16 * 1024;

/** Verify the Supabase JWT from the Authorization header (same pattern as /api/chat). */
async function requireUserId(request: Request): Promise<string> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response("Unauthorized", { status: 401 });
  }
  const token = authHeader.slice(7);
  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_PUBLISHABLE_KEY!,
    {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const { data, error } = await supabase.auth.getClaims(token);
  const sub = data?.claims?.sub;
  if (error || typeof sub !== "string") {
    throw new Response("Unauthorized", { status: 401 });
  }
  return sub;
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const raw = await request.text();
  if (raw.length > MAX_BODY_BYTES) throw new Response("Payload too large", { status: 413 });
  try {
    return (JSON.parse(raw) as Record<string, unknown>) ?? {};
  } catch {
    throw new Response("Bad request", { status: 400 });
  }
}

const linkSchema = z.object({
  clientId: z.string().trim().min(1).max(200),
  clientSecret: z.string().trim().min(1).max(400),
  region: z.enum(TUYA_REGIONS as [string, ...string[]]).default("us"),
  uid: z.string().trim().min(1).max(100),
});

const commandSchema = z.object({
  deviceId: z.string().trim().min(1).max(200),
  action: z.enum(HOME_ACTIONS as [string, ...string[]]),
  value: z.number().int().min(0).max(1000).optional(),
});

export const Route = createFileRoute("/api/home")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        try {
          const userId = await requireUserId(request);
          const url = new URL(request.url);
          if (url.searchParams.get("devices") === "1") {
            const devices = await listDevices(userId);
            return json({ devices });
          }
          const status = await linkStatus(userId);
          return json(status);
        } catch (e) {
          if (e instanceof Response) return e;
          if (e instanceof Error && e.message === NOT_LINKED_MESSAGE) {
            return json({ error: e.message }, 404);
          }
          return json({ error: e instanceof Error ? e.message : "Request failed" }, 500);
        }
      },
      POST: async ({ request }: { request: Request }) => {
        try {
          const userId = await requireUserId(request);
          const body = await readBody(request);
          const op = body.op;
          if (op === "link") {
            const input = linkSchema.parse(body);
            // Secrets are validated against Tuya server-side and stored in the
            // service-role-only table; never echoed back.
            const result = await linkAccount(userId, input);
            return json(result);
          }
          if (op === "unlink") {
            await unlinkAccount(userId);
            return json({ ok: true });
          }
          if (op === "command") {
            const input = commandSchema.parse(body);
            const result = await sendCommand(
              userId,
              input.deviceId,
              input.action as (typeof HOME_ACTIONS)[number],
              input.value,
            );
            return json(result);
          }
          return json({ error: "Unknown op" }, 400);
        } catch (e) {
          if (e instanceof Response) return e;
          if (e instanceof z.ZodError) {
            return json({ error: e.issues[0]?.message ?? "Invalid input" }, 400);
          }
          if (e instanceof Error && e.message === NOT_LINKED_MESSAGE) {
            return json({ error: e.message }, 404);
          }
          return json({ error: e instanceof Error ? e.message : "Request failed" }, 500);
        }
      },
    },
  },
});
