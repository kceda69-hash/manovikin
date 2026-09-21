import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * MANOVIK device bridge (JARVIS mode).
 *
 * A tiny local agent runs on the user's phone/PC and talks to these endpoints:
 *   POST /api/public/device/pair    { code }                -> { deviceToken, deviceId }
 *   POST /api/public/device/poll    Bearer <deviceToken>    -> { commands: [...] }
 *   POST /api/public/device/result  Bearer <deviceToken>    { id, result, status }
 *
 * The device token is stored hashed; commands are always scoped to one device.
 */
async function sha256(input: string) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const db = () => supabaseAdmin;

async function authDevice(request: Request) {
  const header = request.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const hash = await sha256(header.slice(7));
  const { data } = await db()
    .from("manovik_devices")
    .select("id,user_id,name")
    .eq("token_hash", hash)
    .maybeSingle();
  return data ?? null;
}

export const Route = createFileRoute("/api/public/device/$action")({
  server: {
    handlers: {
      POST: async ({ request, params }: { request: Request; params: { action: string } }) => {
        const action = params.action;

        if (action === "pair") {
          let body: { code?: string; platform?: string };
          try {
            body = (await request.json()) as typeof body;
          } catch {
            return json({ error: "Bad request" }, 400);
          }
          const code = (body.code ?? "").trim().toUpperCase();
          if (!code) return json({ error: "Pairing code required" }, 400);
          const { data: device } = await db()
            .from("manovik_devices")
            .select("id,pair_code_expires_at")
            .eq("pair_code", code)
            .maybeSingle();
          if (!device) return json({ error: "Invalid pairing code" }, 404);
          if (
            device.pair_code_expires_at &&
            new Date(device.pair_code_expires_at).getTime() < Date.now()
          ) {
            return json({ error: "Pairing code expired" }, 410);
          }
          const deviceToken =
            crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
          const { error } = await db()
            .from("manovik_devices")
            .update({
              token_hash: await sha256(deviceToken),
              paired_at: new Date().toISOString(),
              last_seen_at: new Date().toISOString(),
              pair_code: null,
              pair_code_expires_at: null,
              platform: (body.platform ?? "unknown").slice(0, 30),
            })
            .eq("id", device.id);
          if (error) return json({ error: error.message }, 500);
          return json({ deviceId: device.id, deviceToken });
        }

        const device = await authDevice(request);
        if (!device) return json({ error: "Unauthorized" }, 401);

        if (action === "poll") {
          await db()
            .from("manovik_devices")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("id", device.id);
          const { data: commands } = await db()
            .from("manovik_device_commands")
            .select("id,kind,command")
            .eq("device_id", device.id)
            .eq("status", "pending")
            .order("created_at", { ascending: true })
            .limit(10);
          const ids = (commands ?? []).map((c: { id: string }) => c.id);
          if (ids.length) {
            await db().from("manovik_device_commands").update({ status: "running" }).in("id", ids);
          }
          return json({ commands: commands ?? [] });
        }

        if (action === "result") {
          let body: { id?: string; result?: string; status?: string };
          try {
            body = (await request.json()) as typeof body;
          } catch {
            return json({ error: "Bad request" }, 400);
          }
          if (!body.id) return json({ error: "Command id required" }, 400);
          const status = body.status === "failed" ? "failed" : "done";
          const { error } = await db()
            .from("manovik_device_commands")
            .update({
              status,
              result: String(body.result ?? "").slice(0, 20_000),
              completed_at: new Date().toISOString(),
            })
            .eq("id", body.id)
            .eq("device_id", device.id);
          if (error) return json({ error: error.message }, 500);
          return json({ ok: true });
        }

        return json({ error: "Unknown action" }, 404);
      },
    },
  },
});
