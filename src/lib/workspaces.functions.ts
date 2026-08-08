import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Ctx = { supabase: any; userId: string; claims?: { email?: string } | null };

const ROLES = ["admin", "editor", "viewer"] as const;

function slugify(name: string) {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40) || "team"
  );
}

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: memberships, error } = await supabase
      .from("manovik_workspace_members")
      .select("workspace_id, role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    const ids = (memberships ?? []).map((m: { workspace_id: string }) => m.workspace_id);
    if (ids.length === 0) return { workspaces: [] };

    const { data: rows } = await supabase
      .from("manovik_workspaces")
      .select("id, name, slug, owner_id, created_at")
      .in("id", ids);

    return {
      workspaces: (rows ?? []).map((w: { id: string }) => ({
        ...w,
        role: (memberships ?? []).find((m: { workspace_id: string }) => m.workspace_id === w.id)?.role ?? "viewer",
      })),
    };
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ name: z.string().trim().min(2).max(60) }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 6)}`;
    const { data: ws, error } = await supabase
      .from("manovik_workspaces")
      .insert({ name: data.name, slug, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await supabase
      .from("manovik_workspace_members")
      .insert({ workspace_id: ws.id, user_id: userId, role: "owner" });
    return { id: ws.id as string };
  });

export const listWorkspaceDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ workspaceId: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context as Ctx;
    const { data: members, error } = await supabase
      .from("manovik_workspace_members")
      .select("id, user_id, role, created_at")
      .eq("workspace_id", data.workspaceId);
    if (error) throw new Error(error.message);

    const { data: invites } = await supabase
      .from("manovik_workspace_invites")
      .select("id, email, role, accepted_at, expires_at, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false });

    return { members: members ?? [], invites: invites ?? [] };
  });

export const inviteToWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z
      .object({
        workspaceId: z.string().uuid(),
        email: z.string().trim().email().max(200),
        role: z.enum(ROLES).default("editor"),
      })
      .parse(d),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as Ctx;
    const { data: canWrite } = await supabase.rpc("can_write_workspace", {
      _workspace_id: data.workspaceId,
      _user_id: userId,
    });
    if (!canWrite) throw new Error("You do not have permission to invite members.");

    const { randomBytes } = await import("node:crypto");
    const { error } = await supabase.from("manovik_workspace_invites").insert({
      workspace_id: data.workspaceId,
      email: data.email.toLowerCase(),
      role: data.role,
      token: randomBytes(24).toString("base64url"),
      invited_by: userId,
      expires_at: new Date(Date.now() + 14 * 86_400_000).toISOString(),
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/** Accept every pending invite addressed to the signed-in user's email. */
export const acceptMyInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, claims } = context as Ctx;
    const email = (claims?.email ?? "").toLowerCase();
    if (!email) return { joined: 0 };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invites } = await supabaseAdmin
      .from("manovik_workspace_invites")
      .select("id, workspace_id, role, expires_at, accepted_at")
      .eq("email", email)
      .is("accepted_at", null);

    let joined = 0;
    for (const inv of invites ?? []) {
      if (new Date(inv.expires_at) < new Date()) continue;
      await supabaseAdmin
        .from("manovik_workspace_members")
        .upsert(
          { workspace_id: inv.workspace_id, user_id: userId, role: inv.role },
          { onConflict: "workspace_id,user_id" },
        );
      await supabaseAdmin
        .from("manovik_workspace_invites")
        .update({ accepted_at: new Date().toISOString() })
        .eq("id", inv.id);
      joined += 1;
    }
    return { joined };
  });
