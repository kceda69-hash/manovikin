// Security Sentinel — server-only anomaly check for device activity.
// Flags newly-paired devices (last 24h) and abnormal command volume (last 1h)
// so the user can be alerted about potentially unauthorized access.
// Never throws: any failure resolves to { alert: null } so a broken check
// can never spam the user. No PII beyond the user's own device names.
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

const DEVICES = "manovik_devices";
const COMMANDS = "manovik_device_commands";

const NEW_DEVICE_WINDOW_MS = 24 * 60 * 60 * 1000;
const COMMAND_WINDOW_MS = 60 * 60 * 1000;
const COMMAND_VOLUME_THRESHOLD = 50;
const MAX_NAMES_IN_ALERT = 5;

// Minimal client surface, so tests can inject a stub instead of the real admin client.
type SentinelClient = Pick<SupabaseClient<Database>, "from">;

type DeviceRow = { name: string };

async function fetchDevicesPairedSince(
  client: SentinelClient,
  userId: string,
  sinceIso: string,
): Promise<DeviceRow[] | null> {
  const { data, error } = await client
    .from(DEVICES)
    .select("name")
    .eq("user_id", userId)
    .gte("paired_at", sinceIso);
  if (error) return null;
  return (data ?? []) as DeviceRow[];
}

async function countCommandsSince(
  client: SentinelClient,
  userId: string,
  sinceIso: string,
): Promise<number | null> {
  const { count, error } = await client
    .from(COMMANDS)
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", sinceIso);
  if (error) return null;
  return count ?? 0;
}

export async function runSentinelCheck(
  userId: string,
  client: SentinelClient = supabaseAdmin,
): Promise<{ alert: string | null }> {
  try {
    const newDevices = await fetchDevicesPairedSince(
      client,
      userId,
      new Date(Date.now() - NEW_DEVICE_WINDOW_MS).toISOString(),
    );
    if (newDevices === null) return { alert: null };

    if (newDevices.length > 0) {
      const names = newDevices
        .map((d) => d.name)
        .filter(Boolean)
        .slice(0, MAX_NAMES_IN_ALERT)
        .join(", ");
      return {
        alert: `🔐 Sentinel: ${newDevices.length} new device(s) paired in the last 24h: ${names}. If this wasn't you, unpair them at /devices immediately.`,
      };
    }

    const commandCount = await countCommandsSince(
      client,
      userId,
      new Date(Date.now() - COMMAND_WINDOW_MS).toISOString(),
    );
    if (commandCount === null) return { alert: null };

    if (commandCount > COMMAND_VOLUME_THRESHOLD) {
      return {
        alert: `🔐 Sentinel: unusual device-command volume — ${commandCount} commands queued in the last hour. If this wasn't you, review /devices.`,
      };
    }

    return { alert: null };
  } catch {
    return { alert: null };
  }
}
