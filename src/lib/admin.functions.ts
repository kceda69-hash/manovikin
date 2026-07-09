import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Helpers -------------------------------------------------------------

async function assertAdmin(context: any, requireAal2 = true) {
  const { supabase, userId, claims } = context;
  // Require AAL2 (verified 2FA in current session) for all admin actions
  if (requireAal2 && claims?.aal !== "aal2") {
    throw new Response("Forbidden: 2FA required", { status: 403 });
  }
  const { data: isAdmin, error } = await supabase.rpc("has_role", {
    _user_id: userId,
    _role: "admin",
  });
  if (error || !isAdmin) {
    throw new Response("Forbidden: admin only", { status: 403 });
  }
  return { supabase, userId, claims };
}

async function audit(userId: string, event: string, summary: string, metadata: Record<string, unknown> = {}) {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("audit_logs").insert({
      user_id: userId,
      event_type: `admin.${event}`,
      summary,
      metadata,
    });
  } catch (e) {
    console.error("audit log failed", e);
  }
}

// Whoami (used by header + admin gate) --------------------------------

export const adminWhoami = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const { data: isAdmin } = await supabase.rpc("has_role", {
      _user_id: userId,
      _role: "admin",
    });
    return {
      userId,
      email: (claims?.email as string | undefined) ?? null,
      isAdmin: !!isAdmin,
      aal: (claims?.aal as string | undefined) ?? "aal1",
    };
  });

// User search ---------------------------------------------------------

export const adminSearchUsers = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { query: string }) =>
    z.object({ query: z.string().trim().max(200) }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const q = data.query.toLowerCase();
    // listUsers is paginated; scan up to 1000 users
    const { data: page, error } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (error) throw new Response(error.message, { status: 500 });
    const users = (page?.users ?? [])
      .filter((u) =>
        !q ||
        (u.email ?? "").toLowerCase().includes(q) ||
        u.id.toLowerCase().includes(q),
      )
      .slice(0, 100)
      .map((u) => ({
        id: u.id,
        email: u.email,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
        confirmed: !!u.email_confirmed_at,
        factors: (u.factors ?? []).length,
      }));
    return { users };
  });

// User detail ---------------------------------------------------------

export const adminGetUserDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string }) =>
    z.object({ userId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const [{ data: userRes }, { data: purchases }, { data: balance }, { data: ledger }, { data: roles }] =
      await Promise.all([
        supabaseAdmin.auth.admin.getUserById(data.userId),
        supabaseAdmin
          .from("purchases")
          .select("*")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("ai_balance")
          .select("credits, updated_at")
          .eq("user_id", data.userId)
          .maybeSingle(),
        supabaseAdmin
          .from("ai_balance_ledger")
          .select("delta, reason, created_at")
          .eq("user_id", data.userId)
          .order("created_at", { ascending: false })
          .limit(50),
        supabaseAdmin
          .from("user_roles")
          .select("role, created_at")
          .eq("user_id", data.userId),
      ]);

    return {
      user: userRes?.user
        ? {
            id: userRes.user.id,
            email: userRes.user.email,
            created_at: userRes.user.created_at,
            last_sign_in_at: userRes.user.last_sign_in_at,
            confirmed: !!userRes.user.email_confirmed_at,
            factors: userRes.user.factors ?? [],
          }
        : null,
      purchases: purchases ?? [],
      credits: balance?.credits ?? 0,
      ledger: ledger ?? [],
      roles: (roles ?? []).map((r) => r.role),
    };
  });

// Cancel subscription -------------------------------------------------

export const adminCancelSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { purchaseId: string }) =>
    z.object({ purchaseId: z.string().uuid() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: row } = await supabaseAdmin
      .from("purchases")
      .select("id, user_id, metadata, plan, status")
      .eq("id", data.purchaseId)
      .maybeSingle();
    if (!row) throw new Response("Purchase not found", { status: 404 });

    const meta = { ...(row.metadata as Record<string, unknown> | null ?? {}), auto_renew: false, cancelled_by_admin: userId, cancelled_at: new Date().toISOString() };
    await supabaseAdmin.from("purchases").update({ metadata: meta }).eq("id", row.id);

    await audit(userId, "cancel_subscription", `Cancelled ${row.plan} for user ${row.user_id}`, {
      purchase_id: row.id,
      target_user_id: row.user_id,
    });
    return { ok: true as const };
  });

// Refund payment ------------------------------------------------------

export const adminRefundPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { purchaseId: string; amount?: number }) =>
    z
      .object({
        purchaseId: z.string().uuid(),
        amount: z.number().int().positive().optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId } = await assertAdmin(context);
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) throw new Response("Payments not configured", { status: 500 });

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: row } = await supabaseAdmin
      .from("purchases")
      .select("id, user_id, amount, currency, razorpay_payment_id, status, plan")
      .eq("id", data.purchaseId)
      .maybeSingle();
    if (!row) throw new Response("Purchase not found", { status: 404 });
    if (!row.razorpay_payment_id) throw new Response("No payment id on record", { status: 400 });
    if (row.status !== "paid") throw new Response(`Cannot refund status=${row.status}`, { status: 400 });

    const auth = btoa(`${keyId}:${keySecret}`);
    const body: Record<string, unknown> = {};
    if (data.amount) body.amount = data.amount;

    const res = await fetch(`https://api.razorpay.com/v1/payments/${row.razorpay_payment_id}/refund`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Razorpay refund failed", res.status, text);
      throw new Response(`Refund failed: ${text}`, { status: 502 });
    }
    const refund = (await res.json()) as { id: string; amount: number; status: string };

    await supabaseAdmin
      .from("purchases")
      .update({
        status: "refunded",
        metadata: {
          refund_id: refund.id,
          refund_amount: refund.amount,
          refund_status: refund.status,
          refunded_by_admin: userId,
          refunded_at: new Date().toISOString(),
        },
      })
      .eq("id", row.id);

    await audit(userId, "refund_payment", `Refunded ${refund.amount / 100} ${row.currency} on ${row.plan}`, {
      purchase_id: row.id,
      target_user_id: row.user_id,
      refund_id: refund.id,
    });
    return { ok: true as const, refund };
  });

// Adjust credits ------------------------------------------------------

export const adminAdjustCredits = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; delta: number; reason: string }) =>
    z
      .object({
        userId: z.string().uuid(),
        delta: z.number().int().refine((n) => n !== 0 && Math.abs(n) <= 1_000_000, "delta must be non-zero and <= 1,000,000"),
        reason: z.string().trim().min(1).max(200),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId: adminId } = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const reason = `admin:${adminId}:${data.reason}`;
    if (data.delta > 0) {
      const { data: r, error } = await supabaseAdmin.rpc("manovik_topup_credit", {
        _user_id: data.userId,
        _amount: data.delta,
        _reason: reason,
      });
      if (error) throw new Response(error.message, { status: 500 });
      await audit(adminId, "credit_topup", `+${data.delta} credits`, { target_user_id: data.userId, delta: data.delta, reason: data.reason });
      return { ok: true as const, remaining: r };
    }
    const { data: r, error } = await supabaseAdmin.rpc("manovik_spend_credit", {
      _user_id: data.userId,
      _amount: Math.abs(data.delta),
      _reason: reason,
    });
    if (error) throw new Response(error.message, { status: 500 });
    if (r === -1) throw new Response("Insufficient credits", { status: 400 });
    await audit(adminId, "credit_spend", `${data.delta} credits`, { target_user_id: data.userId, delta: data.delta, reason: data.reason });
    return { ok: true as const, remaining: r };
  });

// Grant / revoke role -------------------------------------------------

const ROLE = z.enum(["admin", "moderator", "user"]);

export const adminGrantRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "moderator" | "user" }) =>
    z.object({ userId: z.string().uuid(), role: ROLE }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId: adminId } = await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: data.userId, role: data.role });
    if (error && !`${error.message}`.includes("duplicate")) {
      throw new Response(error.message, { status: 500 });
    }
    await audit(adminId, "grant_role", `Granted ${data.role} to ${data.userId}`, {
      target_user_id: data.userId,
      role: data.role,
    });
    return { ok: true as const };
  });

export const adminRevokeRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { userId: string; role: "admin" | "moderator" | "user" }) =>
    z.object({ userId: z.string().uuid(), role: ROLE }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { userId: adminId } = await assertAdmin(context);
    if (data.userId === adminId && data.role === "admin") {
      throw new Response("Cannot revoke your own admin role", { status: 400 });
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("user_roles")
      .delete()
      .eq("user_id", data.userId)
      .eq("role", data.role);
    if (error) throw new Response(error.message, { status: 500 });
    await audit(adminId, "revoke_role", `Revoked ${data.role} from ${data.userId}`, {
      target_user_id: data.userId,
      role: data.role,
    });
    return { ok: true as const };
  });

// Audit log listing ---------------------------------------------------

export const adminListAuditLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { limit?: number }) =>
    z.object({ limit: z.number().int().min(1).max(500).optional() }).parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows } = await supabaseAdmin
      .from("audit_logs")
      .select("id, user_id, event_type, summary, metadata, created_at")
      .like("event_type", "admin.%")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    return { logs: rows ?? [] };
  });

// Recent purchases ----------------------------------------------------

export const adminListPurchases = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { status?: string; plan?: string; limit?: number }) =>
    z
      .object({
        status: z.string().max(32).optional(),
        plan: z.string().max(32).optional(),
        limit: z.number().int().min(1).max(500).optional(),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    await assertAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    let q = supabaseAdmin
      .from("purchases")
      .select("id, user_id, plan, amount, currency, status, razorpay_payment_id, receipt_no, email, created_at")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 100);
    if (data.status) q = q.eq("status", data.status);
    if (data.plan) q = q.eq("plan", data.plan);
    const { data: rows, error } = await q;
    if (error) throw new Response(error.message, { status: 500 });
    return { purchases: rows ?? [] };
  });
