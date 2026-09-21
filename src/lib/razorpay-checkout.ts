import { createRazorpayOrder, verifyRazorpayPayment } from "@/lib/payments.functions";
import { supabase } from "@/integrations/supabase/client";

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, unknown>) => { open: () => void };
  }
}

let scriptPromise: Promise<boolean> | null = null;
function loadScript(): Promise<boolean> {
  if (typeof window === "undefined") return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve) => {
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.onload = () => resolve(true);
    s.onerror = () => {
      scriptPromise = null;
      resolve(false);
    };
    document.body.appendChild(s);
  });
  return scriptPromise;
}

export type CheckoutPlan = "pro" | "sovereign";

export async function startCheckout(
  plan: CheckoutPlan,
  callbacks: {
    onSuccess?: (paymentId: string) => void;
    onError?: (msg: string) => void;
    onDismiss?: () => void;
    prefill?: { name?: string; email?: string };
  } = {},
) {
  const ok = await loadScript();
  if (!ok) return callbacks.onError?.("Could not load Razorpay. Check your internet.");

  // Pre-check auth to avoid an unhandled 401 Response from the server fn
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    if (typeof window !== "undefined") {
      window.location.href = `/login?next=${encodeURIComponent("/billing")}`;
    }
    return;
  }

  let order: Awaited<ReturnType<typeof createRazorpayOrder>>;
  try {
    order = await createRazorpayOrder({ data: { plan } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Payment service unavailable";
    callbacks.onError?.(msg);
    return;
  }
  if (!order.ok) return callbacks.onError?.(order.error ?? "Payment unavailable");

  const rzp = new window.Razorpay!({
    key: order.keyId,
    amount: order.amount,
    currency: order.currency,
    name: "MANOVIK AI",
    description: order.name,
    order_id: order.orderId,
    prefill: {
      ...(callbacks.prefill ?? {}),
      email: callbacks.prefill?.email ?? order.prefillEmail ?? undefined,
    },
    theme: { color: "#06b6d4" },
    modal: { ondismiss: () => callbacks.onDismiss?.() },
    handler: async (resp: {
      razorpay_order_id: string;
      razorpay_payment_id: string;
      razorpay_signature: string;
    }) => {
      const v = await verifyRazorpayPayment({ data: resp });
      if (v.ok) callbacks.onSuccess?.(resp.razorpay_payment_id);
      else callbacks.onError?.(v.error ?? "Payment verification failed");
    },
  });
  rzp.open();
}
