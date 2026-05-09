import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UIMessage } from "ai";

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return { threads: data ?? [] };
  });

export const createThread = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("threads")
      .insert({ user_id: userId, title: "New conversation" })
      .select("id,title,updated_at")
      .single();
    if (error) throw new Error(error.message);
    return { thread: data };
  });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("threads").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .inputValidator((d: { threadId: string }) => d)
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("message,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const messages = (rows ?? []).map((r) => r.message);
    return { messages: messages as unknown as UIMessage[] };
  });
