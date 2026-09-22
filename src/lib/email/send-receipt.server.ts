// Server-only helper: render the payment-receipt template and enqueue it
// for the email dispatcher. Idempotent — safe to call from both the
// verifyRazorpayPayment server function and the Razorpay webhook.
import * as React from "react";
import { render } from "@react-email/components";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { TEMPLATES } from "@/lib/email-templates/registry";

const SITE_NAME = "MANOVIK AI";
const SENDER_DOMAIN = "notify.manovik.in";
const FROM_DOMAIN = "manovik.in";
const APP_ORIGIN = process.env.APP_ORIGIN || "https://manovik.in";

const PLAN_LABEL: Record<string, string> = {
  pro: "MANOVIK Pro (one-time)",
  sovereign: "MANOVIK Sovereign (lifetime)",
};

function fmtINR(amountPaise: number, currency: string) {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amountPaise / 100);
  } catch {
    return `${currency} ${(amountPaise / 100).toFixed(2)}`;
  }
}

function genToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return Array.from(b)
    .map((x) => x.toString(16).padStart(2, "0"))
    .join("");
}

export async function sendReceiptEmailForPurchase(purchaseId: string) {
  const { data: purchase, error } = await supabaseAdmin
    .from("purchases")
    .select("*")
    .eq("id", purchaseId)
    .maybeSingle();
  if (error || !purchase) return { ok: false, reason: "purchase_not_found" };
  if (purchase.status !== "paid") return { ok: false, reason: "not_paid" };
  if (!purchase.email) return { ok: false, reason: "no_email" };

  const recipient = purchase.email.toLowerCase();
  const idemKey = `receipt-${purchase.id}`;

  // Idempotency: skip if we already enqueued/sent a receipt for this purchase
  const { data: existing } = await supabaseAdmin
    .from("email_send_log")
    .select("id")
    .eq("template_name", "payment-receipt")
    .eq("recipient_email", recipient)
    .contains("metadata", { idempotency_key: idemKey })
    .maybeSingle();
  if (existing) return { ok: true, skipped: true };

  // Skip if recipient is on the suppression list
  const { data: suppressed } = await supabaseAdmin
    .from("suppressed_emails")
    .select("id")
    .eq("email", recipient)
    .maybeSingle();
  if (suppressed) return { ok: false, reason: "suppressed" };

  // Unsubscribe token (one per address)
  let unsubscribeToken: string | undefined;
  const { data: existingToken } = await supabaseAdmin
    .from("email_unsubscribe_tokens")
    .select("token, used_at")
    .eq("email", recipient)
    .maybeSingle();
  if (existingToken && !existingToken.used_at) {
    unsubscribeToken = existingToken.token;
  } else if (!existingToken) {
    unsubscribeToken = genToken();
    await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .upsert(
        { token: unsubscribeToken, email: recipient },
        { onConflict: "email", ignoreDuplicates: true },
      );
    const { data: stored } = await supabaseAdmin
      .from("email_unsubscribe_tokens")
      .select("token")
      .eq("email", recipient)
      .maybeSingle();
    unsubscribeToken = stored?.token ?? unsubscribeToken;
  } else {
    return { ok: false, reason: "unsubscribed" };
  }

  const entry = TEMPLATES["payment-receipt"];
  if (!entry) return { ok: false, reason: "template_missing" };

  const data: Record<string, unknown> = {
    name: purchase.name ?? undefined,
    planLabel: PLAN_LABEL[purchase.plan] ?? purchase.plan,
    amountFormatted: fmtINR(purchase.amount, purchase.currency),
    paymentId: purchase.razorpay_payment_id ?? "—",
    orderId: purchase.razorpay_order_id ?? "—",
    receiptNo: purchase.receipt_no ?? purchase.id,
    date: new Date(purchase.created_at).toLocaleString(),
    receiptUrl: `${APP_ORIGIN}/receipt/${purchase.id}`,
  };

  const element = React.createElement(entry.component, data);
  const html = await render(element);
  const text = await render(element, { plainText: true });
  const subject = typeof entry.subject === "function" ? entry.subject(data) : entry.subject;
  const messageId = crypto.randomUUID();

  await supabaseAdmin.from("email_send_log").insert({
    message_id: messageId,
    template_name: "payment-receipt",
    recipient_email: recipient,
    status: "pending",
    metadata: { idempotency_key: idemKey, purchase_id: purchase.id },
  });

  const { error: enqErr } = await supabaseAdmin.rpc("enqueue_email", {
    queue_name: "transactional_emails",
    payload: {
      message_id: messageId,
      to: recipient,
      from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`,
      sender_domain: SENDER_DOMAIN,
      subject,
      html,
      text,
      purpose: "transactional",
      label: "payment-receipt",
      idempotency_key: idemKey,
      unsubscribe_token: unsubscribeToken,
      queued_at: new Date().toISOString(),
    },
  });

  if (enqErr) {
    await supabaseAdmin.from("email_send_log").insert({
      message_id: messageId,
      template_name: "payment-receipt",
      recipient_email: recipient,
      status: "failed",
      error_message: "enqueue_failed",
      metadata: { idempotency_key: idemKey, purchase_id: purchase.id },
    });
    return { ok: false, reason: "enqueue_failed" };
  }
  return { ok: true, queued: true };
}
