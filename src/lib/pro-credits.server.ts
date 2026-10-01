import { supabaseAdmin } from "@/integrations/supabase/client.server";

/** Credits granted by a single Pro (one-time) purchase. */
export const PRO_CREDIT_GRANT = 800;

/**
 * Grants the one-time Pro credit bundle for a paid Pro purchase.
 *
 * ATOMICITY: both the client payment-verification path and the Razorpay
 * webhook call this for the same purchase, often within milliseconds of
 * each other. The old check-then-act (SELECT the flag, RPC the grant,
 * UPDATE the flag) let both callers see an unset flag and grant twice —
 * 1600 credits for one ₹699 payment. Now the grant is claimed with a single
 * conditional UPDATE: only the caller whose UPDATE matches a row
 * (plan=pro, status=paid, flag not set) proceeds. Concurrent callers
 * serialize in Postgres; the loser matches zero rows and grants nothing.
 *
 * Belt-and-braces: the ledger reason `pro_purchase:<purchaseId>` is unique
 * per purchase, so even if a previous claim granted the credits and then
 * crashed, a later attempt sees the ledger row and skips the grant.
 *
 * If the topup RPC fails after a successful claim, the claim is released
 * (flag back to false) so a later Razorpay webhook redelivery can retry.
 *
 * Never throws — a failed grant must not break the payment flow.
 */
export async function grantProCreditsOnce(purchaseId: string): Promise<void> {
  try {
    // Read current metadata only to preserve other keys in the merge below.
    // The grant DECISION is made by the conditional UPDATE, not this read.
    const { data: row } = await supabaseAdmin
      .from("purchases")
      .select("id, user_id, metadata")
      .eq("id", purchaseId)
      .maybeSingle();
    if (!row) return;
    const meta = (row.metadata as Record<string, unknown> | null) ?? {};

    // Atomic claim: exactly one caller flips the flag from unset to set.
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("purchases")
      .update({ metadata: { ...meta, pro_credits_granted: true } })
      .eq("id", purchaseId)
      .eq("plan", "pro")
      .eq("status", "paid")
      .or("metadata->>pro_credits_granted.is.null,metadata->>pro_credits_granted.eq.false")
      .select("id, user_id")
      .maybeSingle();
    if (claimErr) {
      console.error("pro credit claim failed", purchaseId, claimErr.message);
      return;
    }
    if (!claimed) return; // lost the race, already granted, or not payable

    // Second line of defense: skip if the ledger already has this grant
    // (a previous claim may have granted then crashed before finishing).
    const { data: prior } = await supabaseAdmin
      .from("ai_balance_ledger")
      .select("id")
      .eq("user_id", claimed.user_id)
      .eq("reason", `pro_purchase:${purchaseId}`)
      .limit(1);
    if (prior && prior.length > 0) return;

    const { error } = await supabaseAdmin.rpc("manovik_topup_credit", {
      _user_id: claimed.user_id,
      _amount: PRO_CREDIT_GRANT,
      _reason: `pro_purchase:${purchaseId}`,
    });
    if (error) {
      // Release the claim so a later webhook redelivery can retry the grant.
      await supabaseAdmin
        .from("purchases")
        .update({ metadata: { ...meta, pro_credits_granted: false } })
        .eq("id", purchaseId);
      console.error("pro credit grant failed", purchaseId, error.message);
    }
  } catch (e) {
    console.error("pro credit grant failed", purchaseId, e);
  }
}
