import { createServerFn } from "@tanstack/react-start";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Database } from "@/integrations/supabase/types";

export type AuditEntry = {
  id: string;
  thread_id: string | null;
  event_type: string;
  summary: string | null;
  ip: string | null;
  user_agent: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export const listAuditLogs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as unknown as { supabase: SupabaseClient<Database> };
    const { data, error } = await supabase
      .from("audit_logs")
      .select("id,thread_id,event_type,summary,ip,user_agent,metadata,created_at")
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) {
      console.error("[listAuditLogs]", error);
      throw new Error("Failed to load audit logs");
    }
    return { logsJson: JSON.stringify((data ?? []) as AuditEntry[]) };
  });

export function parseAuditLogs(json: string): AuditEntry[] {
  try {
    return JSON.parse(json) as AuditEntry[];
  } catch {
    return [];
  }
}
