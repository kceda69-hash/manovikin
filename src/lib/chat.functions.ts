import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { UIMessage } from "ai";

function fail(tag: string, error: unknown): never {
  console.error(`[${tag}]`, error);
  // If this is an auth error (expired/invalid JWT, 401/403 from PostgREST),
  // throw a distinguishable error so the client can redirect to login instead
  // of showing a generic "Request failed" panel.
  const err = error as { code?: string; message?: string; status?: number } | null;
  const msg = (err?.message ?? "").toLowerCase();
  const code = (err?.code ?? "").toLowerCase();
  const isAuthError =
    err?.status === 401 ||
    err?.status === 403 ||
    code === "401" ||
    code === "403" ||
    msg.includes("jwt") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid token") ||
    msg.includes("expired");
  if (isAuthError) {
    throw new Error("AUTH_FAILED");
  }
  throw new Error("Request failed");
}

export const listThreads = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("threads")
      .select("id,title,updated_at")
      .order("updated_at", { ascending: false });
    if (error) fail("listThreads", error);
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
    if (error) fail("createThread", error);
    return { thread: data };
  });

export const deleteThreadInput = z.object({ id: z.string().uuid() });
export const getThreadMessagesInput = z.object({ threadId: z.string().uuid() });

export const deleteThread = createServerFn({ method: "POST" })
  .inputValidator((d: { id: string }) => deleteThreadInput.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase.from("threads").delete().eq("id", data.id);
    if (error) fail("deleteThread", error);
    return { ok: true };
  });

export const getThreadMessages = createServerFn({ method: "POST" })
  .inputValidator((d: { threadId: string }) => getThreadMessagesInput.parse(d))
  .middleware([requireSupabaseAuth])
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows, error } = await supabase
      .from("messages")
      .select("message,created_at")
      .eq("thread_id", data.threadId)
      .order("created_at", { ascending: true });
    if (error) fail("getThreadMessages", error);
    return { messagesJson: JSON.stringify((rows ?? []).map((r) => r.message)) };
  });

export function parseMessages(json: string): UIMessage[] {
  try {
    return JSON.parse(json) as UIMessage[];
  } catch {
    return [];
  }
}
