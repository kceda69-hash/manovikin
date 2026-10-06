// Location Tracker tools for MANO.
//
// Exported in registry shape (name, description, schema, timeoutMs,
// maxOutputBytes, rateLimitPerMin, execute) so the coordinator can register
// them in src/lib/agent-tools.ts. NOT registered here on purpose.
//
// Privacy: device.locate ONLY works for the user's own paired devices
// (user_id + paired_at enforced, same as queueDeviceCommand). geo.ip only
// geolocates syntactically valid public IPs the user provides.
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { ToolDef } from "@/lib/sandbox";
import { geolocateIp, isPublicIp, isValidIp } from "@/lib/geolocation/geolocation.server";

const ipSchema = z
  .string()
  .trim()
  .min(1)
  .max(45)
  .refine((v) => isValidIp(v), { message: "Not a valid IPv4/IPv6 address." })
  .refine((v) => isPublicIp(v), { message: "Only public IPs can be geolocated." });

const geoIpTool: ToolDef<{ ip: string }> = {
  name: "geo.ip",
  description:
    "Geolocate a public IP address (country, city, coordinates, ISP) for security recon on infrastructure you own or are authorized to test. Only public IPs — private/loopback addresses are refused.",
  schema: z.object({ ip: ipSchema }),
  timeoutMs: 15_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 20,
  execute: async ({ ip }, { userId }) => {
    const result = await geolocateIp(ip);
    if (!result) {
      return { ok: false, error: "geo_failed", message: "Could not geolocate that IP." };
    }
    const { logAgentAction } = await import("@/lib/agent-audit.server");
    await logAgentAction({
      userId,
      action: "geo.ip",
      summary: `IP geolocated: ${result.city}, ${result.country}`,
      metadata: { country: result.country, city: result.city },
    });
    return { ok: true, ...result };
  },
};

const deviceLocateTool: ToolDef<{ deviceId: string }> = {
  name: "device.locate",
  description:
    "Request a live location from one of the user's OWN paired devices (use device.list first for the id). Queues a 'locate' command; the device agent reports back with coordinates within seconds. Only works for devices the user owns and has paired.",
  schema: z.object({ deviceId: z.string().uuid() }),
  timeoutMs: 10_000,
  maxOutputBytes: 2_000,
  rateLimitPerMin: 10,
  execute: async ({ deviceId }, { userId }) => {
    // Same ownership + pairing enforcement as queueDeviceCommand.
    const { data: device } = await supabaseAdmin
      .from("manovik_devices")
      .select("id,name,paired_at")
      .eq("id", deviceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!device) {
      return { ok: false, error: "not_found", message: "Device not found." };
    }
    if (!device.paired_at) {
      return {
        ok: false,
        error: "not_paired",
        message: `Device "${device.name}" is not paired yet.`,
      };
    }
    const { error } = await supabaseAdmin
      .from("manovik_device_commands")
      .insert({ device_id: deviceId, user_id: userId, kind: "locate", command: "locate" });
    if (error) {
      return { ok: false, error: "queue_failed", message: error.message.slice(0, 200) };
    }
    const { logAgentAction } = await import("@/lib/agent-audit.server");
    await logAgentAction({
      userId,
      action: "device.locate",
      summary: `Locate requested for "${device.name}"`,
      metadata: { deviceId, deviceName: device.name },
    });
    return {
      ok: true,
      message: `Locate request queued for "${device.name}" — the device reports back with coordinates within seconds.`,
    };
  },
};

export const locationTools = [geoIpTool, deviceLocateTool];
