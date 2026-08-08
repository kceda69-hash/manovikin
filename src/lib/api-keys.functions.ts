import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string };

const SCOPES = ["ask", "code", "memory"] as const;

export const listApiKeys = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;
    const { data, error } = await supabase
      .from("manovik_api_keys")
      .select("id, label, key_prefix, scopes, revoked_at, expires_at, last_used_at, use_count, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { keys: data ?? [] };
  });

/** Issue a key. The plaintext value is returned exactly once. */
export const createApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        label: z.string().trim().min(1).max(80),
        scopes: z.array(z.enum(SCOPES)).min(1).default(["ask"]),
        expiresInDays: z.number().int().min(1).max(365).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { randomBytes, createHash } = await import("node:crypto");

    const { count } = await supabase
      .from("manovik_api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .is("revoked_at", null);
    if ((count ?? 0) >= 20) throw new Error("Active key limit reached (20). Revoke one first.");

    const secret = randomBytes(24).toString("base64url");
    const plaintext = `mnvk_${secret}`;
    const key_hash = createHash("sha256").update(plaintext).digest("hex");

    const { error } = await supabase.from("manovik_api_keys").insert({
      user_id: userId,
      label: data.label,
      key_prefix: plaintext.slice(0, 12),
      key_hash,
      scopes: data.scopes,
      expires_at: data.expiresInDays
        ? new Date(Date.now() + data.expiresInDays * 86_400_000).toISOString()
        : null,
    });
    if (error) throw new Error(error.message);

    return { key: plaintext };
  });

export const revokeApiKey = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { error } = await supabase
      .from("manovik_api_keys")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", data.id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
