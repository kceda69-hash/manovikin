import { createFileRoute } from "@tanstack/react-router";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function verifySig(secret: string, body: string, headerSig: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(body));
  const hex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  if (hex.length !== headerSig.length) return false;
  let r = 0;
  for (let i = 0; i < hex.length; i++) r |= hex.charCodeAt(i) ^ headerSig.charCodeAt(i);
  return r === 0;
}

export const Route = createFileRoute("/api/razorpay-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) return new Response("Webhook not configured", { status: 503 });
        const sig = request.headers.get("x-razorpay-signature") ?? "";
        const body = await request.text();
        if (!sig || !(await verifySig(secret, body, sig))) {
          return new Response("Invalid signature", { status: 401 });
        }
        let evt: { event?: string; payload?: { payment?: { entity?: { order_id?: string; id?: string; email?: string; status?: string } } } };
        try { evt = JSON.parse(body); } catch { return new Response("Bad JSON", { status: 400 }); }
        const entity = evt.payload?.payment?.entity;
        if (!entity?.order_id) return new Response("ok");

        const status =
          evt.event === "payment.captured" || entity.status === "captured" ? "paid" :
          evt.event === "payment.failed" ? "failed" : "pending";

        await supabaseAdmin
          .from("purchases")
          .update({
            status,
            razorpay_payment_id: entity.id ?? null,
            metadata: { webhook_event: evt.event ?? null },
          })
          .eq("razorpay_order_id", entity.order_id);

        return new Response("ok");
      },
    },
  },
});
