import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

const PLANS = {
  pro: { amount: 49900, currency: "INR", name: "MANOVIK Pro (monthly)" },
  sovereign: { amount: 199900, currency: "INR", name: "MANOVIK Sovereign (lifetime)" },
} as const;

type PlanId = keyof typeof PLANS;

async function hmacSha256Hex(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;
  let res = 0;
  for (let i = 0; i < a.length; i++) res |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return res === 0;
}

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { plan: PlanId }) =>
    z.object({ plan: z.enum(["pro", "sovereign"]) }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) return { ok: false as const, error: "Payments not configured" };

    const plan = PLANS[data.plan];
    const userId = context.userId;
    const email = (context.claims?.email as string | undefined) ?? null;

    // Throttle: max 5 pending orders per user per 10 min
    const since = new Date(Date.now() - 10 * 60_000).toISOString();
    const { count } = await supabaseAdmin
      .from("purchases")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since);
    if ((count ?? 0) > 8) {
      return { ok: false as const, error: "Too many attempts. Try again shortly." };
    }

    const auth = btoa(`${keyId}:${keySecret}`);
    const receipt = `mnv_${data.plan}_${Date.now()}`;
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        receipt,
        notes: { plan: data.plan, user_id: userId },
      }),
    });
    if (!res.ok) {
      console.error("Razorpay order failed", res.status, await res.text());
      return { ok: false as const, error: "Could not create order" };
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };

    await supabaseAdmin.from("purchases").insert({
      user_id: userId,
      plan: data.plan,
      amount: plan.amount,
      currency: plan.currency,
      status: "created",
      razorpay_order_id: order.id,
      receipt_no: receipt,
      email,
    });

    return {
      ok: true as const,
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: plan.name,
      plan: data.plan,
      prefillEmail: email,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: {
    razorpay_order_id: string;
    razorpay_payment_id: string;
    razorpay_signature: string;
  }) =>
    z
      .object({
        razorpay_order_id: z.string().min(1).max(128),
        razorpay_payment_id: z.string().min(1).max(128),
        razorpay_signature: z.string().min(1).max(256),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return { ok: false as const, error: "Not configured" };

    const hex = await hmacSha256Hex(
      secret,
      `${data.razorpay_order_id}|${data.razorpay_payment_id}`,
    );
    if (!timingSafeEqualHex(hex, data.razorpay_signature)) {
      await supabaseAdmin
        .from("purchases")
        .update({ status: "failed", metadata: { reason: "bad_signature" } })
        .eq("razorpay_order_id", data.razorpay_order_id)
        .eq("user_id", context.userId);
      return { ok: false as const, error: "Signature mismatch" };
    }

    await supabaseAdmin
      .from("purchases")
      .update({
        status: "paid",
        razorpay_payment_id: data.razorpay_payment_id,
      })
      .eq("razorpay_order_id", data.razorpay_order_id)
      .eq("user_id", context.userId);

    return { ok: true as const };
  });

export const listMyPurchases = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await supabaseAdmin
      .from("purchases")
      .select("id, plan, amount, currency, status, razorpay_payment_id, razorpay_order_id, receipt_no, email, created_at")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) return { purchases: [] as never[], error: error.message };
    return { purchases: data ?? [], error: null };
  });

export const getMyPurchase = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await supabaseAdmin
      .from("purchases")
      .select("*")
      .eq("id", data.id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error || !row) return { purchase: null, error: error?.message ?? "Not found" };
    return { purchase: row, error: null };
  });
