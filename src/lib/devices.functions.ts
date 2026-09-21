import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

type Ctx = { supabase: SupabaseClient<Database>; userId: string };

export type ManovikDevice = {
  id: string;
  name: string;
  platform: string;
  pair_code: string | null;
  pair_code_expires_at: string | null;
  paired_at: string | null;
  last_seen_at: string | null;
};

export type DeviceCommand = {
  id: string;
  device_id: string;
  kind: string;
  command: string;
  status: string;
  result: string | null;
  created_at: string;
  completed_at: string | null;
};

const DEVICES = "manovik_devices";
const COMMANDS = "manovik_device_commands";

function makePairCode() {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}

export const listDevices = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;
    const { data, error } = await supabase
      .from(DEVICES)
      .select("id,name,platform,pair_code,pair_code_expires_at,paired_at,last_seen_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as ManovikDevice[];
  });

export const createDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        name: z.string().trim().min(1).max(60),
        platform: z.string().trim().max(30).default("unknown"),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const pair_code = makePairCode();
    const { data: row, error } = await supabase
      .from(DEVICES)
      .insert({
        user_id: userId,
        name: data.name,
        platform: data.platform,
        pair_code,
        pair_code_expires_at: new Date(Date.now() + 30 * 60_000).toISOString(),
      })
      .select("id,name,platform,pair_code,pair_code_expires_at,paired_at,last_seen_at")
      .single();
    if (error) throw new Error(error.message);
    return row as ManovikDevice;
  });

export const deleteDevice = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { error } = await supabase.from(DEVICES).delete().eq("id", data.id).eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const sendDeviceCommand = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z
      .object({
        deviceId: z.string().uuid(),
        kind: z.enum(["shell", "open", "notify", "say", "script"]).default("shell"),
        command: z.string().trim().min(1).max(4000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: device } = await supabase
      .from(DEVICES)
      .select("id,paired_at")
      .eq("id", data.deviceId)
      .eq("user_id", userId)
      .maybeSingle();
    if (!device) throw new Error("Device not found");
    if (!device.paired_at) throw new Error("Device is not paired yet");
    const { data: row, error } = await supabase
      .from(COMMANDS)
      .insert({
        device_id: data.deviceId,
        user_id: userId,
        kind: data.kind,
        command: data.command,
      })
      .select("id,device_id,kind,command,status,result,created_at,completed_at")
      .single();
    if (error) throw new Error(error.message);
    return row as DeviceCommand;
  });

export const listDeviceCommands = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ deviceId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: rows, error } = await supabase
      .from(COMMANDS)
      .select("id,device_id,kind,command,status,result,created_at,completed_at")
      .eq("user_id", userId)
      .eq("device_id", data.deviceId)
      .order("created_at", { ascending: false })
      .limit(25);
    if (error) throw new Error(error.message);
    return (rows ?? []) as DeviceCommand[];
  });
