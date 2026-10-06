// Server-only delivery for the proactive engine.
// After a scheduled routine runs, MANO writes the outcome into the user's
// "MANO Briefings" chat thread so the result is seen — this closes the loop
// between "acts before asked" and "tells you what it did".

export const BRIEFING_THREAD_TITLE = "⚡ MANO Briefings";

export type BriefingAction = {
  label: string;
  kind: string;
  command: string;
  risk: string;
  why: string;
};

export type BriefingInput = {
  name: string;
  objective: string;
  status: "success" | "failed";
  answer: string;
  actions: BriefingAction[];
  error?: string;
  durationMs: number;
};

/** Pure builder: the briefing message text. Kept separate for unit tests. */
export function buildBriefingText(input: BriefingInput): string {
  const when = new Date().toLocaleString("en-IN", { timeZone: "Asia/Calcutta" });
  const lines: string[] = [];
  lines.push(`## ⚡ MANO briefing — ${input.name}`);
  lines.push(`*${when} IST · ${input.status === "success" ? "completed" : "failed"} in ${Math.round(input.durationMs / 1000)}s*`);
  lines.push("");
  lines.push(`**Routine:** ${input.objective}`);
  lines.push("");
  if (input.status === "success") {
    lines.push(input.answer.trim().slice(0, 6000) || "_No summary produced._");
  } else {
    lines.push(`_This run failed:_ ${input.error ?? "unknown error"}`);
  }
  if (input.actions.length > 0) {
    lines.push("");
    lines.push("**Proposed actions** — say the word (e.g. \"do 1 and 3\") and I'll run them:");
    input.actions.slice(0, 12).forEach((a, i) => {
      lines.push(`${i + 1}. **${a.label}** (${a.kind}, risk: ${a.risk}) — ${a.why}`);
      // FIX (agent-safety audit): the approver must see the actual payload.
      // A bare label let "do 1" approve arbitrary shell without ever showing
      // the command. Truncated for readability; the full string is stored.
      const cmd = a.command.length > 160 ? `${a.command.slice(0, 160)}…` : a.command;
      lines.push(`   \`${cmd}\``);
    });
  }
  lines.push("");
  lines.push("_Manage this routine anytime at /agents, or just tell me here._");
  return lines.join("\n");
}

async function findOrCreateBriefingThread(
  supabaseAdmin: {
    from: (t: string) => any;
  },
  userId: string,
): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from("threads")
    .select("id")
    .eq("user_id", userId)
    .eq("title", BRIEFING_THREAD_TITLE)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.id) return existing.id as string;

  const { data: created, error } = await supabaseAdmin
    .from("threads")
    .insert({ user_id: userId, title: BRIEFING_THREAD_TITLE })
    .select("id")
    .single();
  if (error || !created) throw new Error(error?.message ?? "Could not create briefing thread");
  return created.id as string;
}

/**
 * Write a routine's outcome into the user's briefing thread.
 * Never throws — delivery must not break the run record.
 */
export async function deliverScheduleBriefing(
  userId: string,
  input: BriefingInput,
): Promise<{ ok: boolean; threadId?: string; error?: string }> {
  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const threadId = await findOrCreateBriefingThread(supabaseAdmin, userId);
    const message = {
      id: `briefing-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      role: "assistant",
      parts: [{ type: "text", text: buildBriefingText(input) }],
    };
    const { error } = await supabaseAdmin.from("messages").insert({
      thread_id: threadId,
      user_id: userId,
      role: "assistant",
      message,
    });
    if (error) throw new Error(error.message);
    await supabaseAdmin
      .from("threads")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", threadId);
    return { ok: true, threadId };
  } catch (err) {
    console.error("[briefing] delivery failed:", (err as Error)?.message ?? err);
    return { ok: false, error: String((err as Error)?.message ?? err) };
  }
}
