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

export const getManovikDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId, claims } = context as any;
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [balanceRes, ledgerRes, monthLedgerRes, threadsRes, messagesRes, purchasesRes, auditRes, adminRes] =
      await Promise.all([
        supabase
          .from("ai_balance")
          .select("credits, updated_at")
          .eq("user_id", userId)
          .maybeSingle(),
        supabase
          .from("ai_balance_ledger")
          .select("delta, reason, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(8),
        supabase
          .from("ai_balance_ledger")
          .select("delta, reason, created_at")
          .eq("user_id", userId)
          .gte("created_at", monthStart.toISOString()),
        supabase.from("threads").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase.from("messages").select("id", { count: "exact", head: true }).eq("user_id", userId),
        supabase
          .from("purchases")
          .select("plan, status, created_at, metadata")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("audit_logs")
          .select("event_type, summary, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(5),
        supabase.rpc("has_role", { _user_id: userId, _role: "admin" }),
      ]);

    const allLedger = (monthLedgerRes.data ?? []) as Array<{ delta: number }>;
    const monthUsed = allLedger
      .filter((row) => row.delta < 0)
      .reduce((sum, row) => sum + Math.abs(row.delta), 0);
    const recentLedger = (ledgerRes.data ?? []) as Array<{ delta: number; reason: string; created_at: string }>;
    const totalUsed = recentLedger
      .filter((row) => row.delta < 0)
      .reduce((sum, row) => sum + Math.abs(row.delta), 0);
    const paid = ((purchasesRes.data ?? []) as Array<{ plan: string; status: string; created_at: string; metadata?: Record<string, unknown> | null }>).filter(
      (row) => row.status === "paid",
    );
    const plan = paid.find((row) => row.plan === "sovereign")
      ? "Sovereign"
      : paid.find((row) => row.plan === "pro")
        ? "Pro"
        : "Free";

    return {
      user: {
        email: (claims?.email as string | undefined) ?? null,
        isAdmin: !!adminRes.data,
      },
      balance: {
        credits: balanceRes.data?.credits ?? 0,
        updatedAt: balanceRes.data?.updated_at ?? null,
        monthUsed,
        recentUsed: totalUsed,
      },
      usage: {
        threads: threadsRes.count ?? 0,
        messages: messagesRes.count ?? 0,
      },
      plan,
      recentLedger,
      recentAudit: auditRes.data ?? [],
    };
  });
