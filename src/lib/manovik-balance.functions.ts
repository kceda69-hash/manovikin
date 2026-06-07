import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getManovikBalance = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data } = await supabase
      .from("ai_balance")
      .select("credits, updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    const { data: ledger } = await supabase
      .from("ai_balance_ledger")
      .select("delta, reason, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);
    return {
      credits: data?.credits ?? 0,
      updatedAt: data?.updated_at ?? null,
      ledger: ledger ?? [],
    };
  });
