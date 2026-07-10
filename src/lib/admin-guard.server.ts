// Shared admin guard for server functions.
// Enforces (1) authenticated session, (2) AAL2 (2FA verified this session),
// (3) `admin` role via public.has_role(). All denials return an identical
// generic 404 to avoid leaking whether the caller is signed-in, is an admin,
// or is missing 2FA. The single log line is server-only.

type Ctx = {
  supabase: {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  };
  userId: string;
  claims?: { aal?: string; email?: string } | null;
};

function deny(reason: string, userId?: string): never {
  // Server-only signal for audit/debug; response body is opaque.
  console.warn(`[admin-guard] denied: ${reason}${userId ? ` user=${userId}` : ""}`);
  throw new Response("Not Found", { status: 404 });
}

export async function assertAdmin(context: unknown): Promise<{ userId: string; email: string | null }> {
  const ctx = context as Ctx | undefined;
  if (!ctx || !ctx.userId) deny("no-context");
  const { supabase, userId, claims } = ctx!;
  if (claims?.aal !== "aal2") deny("aal<2", userId);
  const { data, error } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
  if (error) deny(`rpc-error:${(error as { message?: string }).message ?? "unknown"}`, userId);
  if (!data) deny("not-admin", userId);
  return { userId, email: (claims?.email as string | undefined) ?? null };
}
