import { createFileRoute } from "@tanstack/react-router";
import { generateText } from "ai";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway";
import {
  aiKeys,
  pickKeyIndex,
  markKeyThrottled,
  clearKeyThrottled,
} from "@/lib/ai-key-failover";
import { storeMemoryFacts } from "@/lib/memory/store.server";
import {
  AMBIENT_OBSERVATION_PROMPT,
  MAX_AMBIENT_FRAME_BYTES,
  isNotableObservation,
} from "@/lib/device-agent-utils";

/**
 * MANOVIK Ambient Watch frame endpoint.
 *
 * POST /api/public/device/ambient-frame   Bearer <deviceToken>
 *   multipart/form-data: { frame: <jpeg blob> }
 *
 * Same device auth as /api/public/device/$action. The frame is analyzed
 * with the vision model and only the ONE-sentence observation is stored
 * (memory note tagged "ambient-watch", plus a notify command when notable).
 * The raw frame bytes are NEVER persisted anywhere.
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

function base64Of(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  // btoa exists in workers/node18+ runtimes
  return btoa(binary);
}

async function describeFrame(dataUrl: string): Promise<string | null> {
  const keys = aiKeys();
  if (keys.length === 0) {
    console.warn("[ambient-frame] no AI keys configured");
    return null;
  }
  const model = process.env.MANOVIK_AI_MODEL ?? "gemini-3.8-flash";
  const lovableKey = process.env.LOVABLE_API_KEY ?? "";
  const startIdx = pickKeyIndex();
  for (let attempt = 0; attempt < keys.length; attempt++) {
    const idx = (startIdx + attempt) % keys.length;
    try {
      const gateway = createLovableAiGatewayProvider(lovableKey, keys[idx]);
      const { text } = await generateText({
        model: gateway(model),
        system:
          "You describe room scenes for a home-watch feature. Reply with exactly ONE sentence. " +
          "Never identify any person: no names, no facial recognition, scene descriptions only.",
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: AMBIENT_OBSERVATION_PROMPT },
              { type: "image", image: dataUrl },
            ],
          },
        ],
        maxRetries: 0,
      });
      clearKeyThrottled(idx);
      return text.trim();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.warn("[ambient-frame] vision attempt failed", { keyIndex: idx, error: msg });
      if (/429|rate.?limit|quota/i.test(msg)) markKeyThrottled(idx);
    }
  }
  return null;
}

export const Route = createFileRoute("/api/public/device/ambient-frame")({
  server: {
    handlers: {
      POST: async ({ request }: { request: Request }) => {
        const device = await authDevice(request);
        if (!device) return json({ error: "Unauthorized" }, 401);

        let form: FormData;
        try {
          form = await request.formData();
        } catch {
          return json({ error: "Expected multipart/form-data with a 'frame' field" }, 400);
        }
        const frame = form.get("frame");
        if (!(frame instanceof File)) return json({ error: "Missing 'frame' file" }, 400);
        if (frame.size === 0) return json({ error: "Empty frame" }, 400);
        if (frame.size > MAX_AMBIENT_FRAME_BYTES) {
          return json({ error: "Frame too large (max ~2MB)" }, 413);
        }
        const mime = (frame.type || "").toLowerCase();
        if (!mime.startsWith("image/")) {
          return json({ error: "Frame must be an image" }, 400);
        }

        // In-memory only — the raw bytes are never written to storage or the DB.
        const bytes = new Uint8Array(await frame.arrayBuffer());
        const dataUrl = `data:${mime};base64,${base64Of(bytes)}`;

        const observation = await describeFrame(dataUrl);
        if (!observation) {
          return json({ error: "Vision analysis failed" }, 502);
        }
        const oneLine = observation.replace(/\s+/g, " ").trim().slice(0, 300);

        const stamp = new Date().toISOString();
        try {
          await storeMemoryFacts(device.user_id, [
            {
              fact: `[ambient-watch · ${stamp}] ${oneLine}`,
              category: "other",
            },
          ]);
        } catch (e) {
          console.warn("[ambient-frame] memory store failed", e instanceof Error ? e.message : e);
        }

        if (isNotableObservation(oneLine)) {
          // Alert every paired device of this user; the web agent shows
          // `notify` kinds as a Notification + alert.
          const { data: devices } = await db()
            .from("manovik_devices")
            .select("id")
            .eq("user_id", device.user_id)
            .not("paired_at", "is", null);
          const rows = (devices ?? []).map((d: { id: string }) => ({
            device_id: d.id,
            user_id: device.user_id,
            kind: "notify",
            command: `Ambient Watch: ${oneLine}`.slice(0, 1000),
          }));
          if (rows.length) {
            const { error } = await db().from("manovik_device_commands").insert(rows as never);
            if (error) {
              console.warn("[ambient-frame] notify insert failed", error.message);
            }
          }
        }

        return json({ ok: true });
      },
    },
  },
});
