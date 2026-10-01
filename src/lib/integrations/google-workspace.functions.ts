import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  unlinkWorkspace,
  workspaceLinkStatus,
} from "./google-workspace.server";

type Ctx = { userId: string };

export const getGoogleWorkspaceStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as Ctx;
    try {
      return await workspaceLinkStatus(userId);
    } catch {
      // Table missing (migration not applied) reads as unlinked.
      return { linked: false, linkedAt: null };
    }
  });

export const unlinkGoogleWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context as Ctx;
    await unlinkWorkspace(userId);
    return { ok: true };
  });
