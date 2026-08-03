import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { summarizeUsage } from "@/lib/usage.server";

export const getUsageSummary = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { days?: number } | undefined) => {
    const days = Math.min(Math.max(Number(d?.days ?? 30), 1), 90);
    return { days };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const since = new Date(Date.now() - data.days * 86_400_000).toISOString();

    const [{ data: events }, { data: subscription }, { data: balance }] = await Promise.all([
      supabase
        .from("manovik_usage_events")
        .select("kind, model, credits, input_tokens, output_tokens, created_at")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(1000),
      supabase.from("manovik_subscriptions").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("ai_balance").select("credits, updated_at").eq("user_id", userId).maybeSingle(),
    ]);

    return {
      days: data.days,
      balance: balance?.credits ?? null,
      subscription: subscription ?? null,
      ...summarizeUsage(events ?? []),
    };
  });

export const ensureSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: existing } = await supabaseAdmin
      .from("manovik_subscriptions")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    if (existing) return { subscription: existing };
    const { data, error } = await supabaseAdmin
      .from("manovik_subscriptions")
      .insert({ user_id: userId })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return { subscription: data };
  });
