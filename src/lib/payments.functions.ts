import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const PLANS = {
  pro: { amount: 49900, currency: "INR", name: "MANOVIK Pro (monthly)" },
  sovereign: { amount: 199900, currency: "INR", name: "MANOVIK Sovereign (lifetime)" },
} as const;

type PlanId = keyof typeof PLANS;

export const createRazorpayOrder = createServerFn({ method: "POST" })
  .inputValidator((data: { plan: PlanId }) =>
    z.object({ plan: z.enum(["pro", "sovereign"]) }).parse(data),
  )
  .handler(async ({ data }) => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
      return { ok: false as const, error: "Payments not configured" };
    }
    const plan = PLANS[data.plan];
    const auth = btoa(`${keyId}:${keySecret}`);
    const res = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        amount: plan.amount,
        currency: plan.currency,
        receipt: `mnv_${data.plan}_${Date.now()}`,
        notes: { plan: data.plan },
      }),
    });
    if (!res.ok) {
      const text = await res.text();
      console.error("Razorpay order failed", res.status, text);
      return { ok: false as const, error: "Could not create order" };
    }
    const order = (await res.json()) as { id: string; amount: number; currency: string };
    return {
      ok: true as const,
      keyId,
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      name: plan.name,
      plan: data.plan,
    };
  });

export const verifyRazorpayPayment = createServerFn({ method: "POST" })
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
  .handler(async ({ data }) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return { ok: false as const, error: "Not configured" };
    const enc = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      enc.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    );
    const sig = await crypto.subtle.sign(
      "HMAC",
      key,
      enc.encode(`${data.razorpay_order_id}|${data.razorpay_payment_id}`),
    );
    const hex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    return { ok: hex === data.razorpay_signature };
  });
