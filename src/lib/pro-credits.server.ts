import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Credits granted by a single Pro (one-time) purchase. */
export const PRO_CREDIT_GRANT = 800;

/**
 * Grants the one-time Pro credit bundle for a paid Pro purchase.
 * Idempotent: a `pro_credits_granted` flag on the purchase row prevents
 * double-grants when both the client verify path and the webhook fire.
 * Never throws — a failed grant must not break the payment flow.
 */
export async function grantProCreditsOnce(purchaseId: string): Promise<void> {
  try {
    const { data: row } = await supabaseAdmin
      .from("purchases")
      .select("id, user_id, plan, status, metadata")
      .eq("id", purchaseId)
      .maybeSingle();
    if (!row || row.plan !== "pro" || row.status !== "paid") return;
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};
    if (meta.pro_credits_granted) return;

    const { error } = await supabaseAdmin.rpc("manovik_topup_credit", {
      _user_id: row.user_id,
      _amount: PRO_CREDIT_GRANT,
      _reason: `pro_purchase:${purchaseId}`,
    });
    if (error) {
      console.error("pro credit grant failed", purchaseId, error.message);
      return;
    }
    await supabaseAdmin
      .from("purchases")
      .update({ metadata: { ...meta, pro_credits_granted: true } })
      .eq("id", purchaseId);
  } catch (e) {
    console.error("pro credit grant failed", purchaseId, e);
  }
}
