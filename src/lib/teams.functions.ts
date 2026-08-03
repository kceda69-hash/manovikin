import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { slugify } from "@/lib/teams.server";

export const listWorkspaces = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as any;
    const { data: workspaces, error } = await supabase
      .from("manovik_workspaces")
      .select("id, name, slug, owner_id, created_at")
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    const ids = (workspaces ?? []).map((w: any) => w.id);
    let members: any[] = [];
    if (ids.length) {
      const { data } = await supabase
        .from("manovik_workspace_members")
        .select("id, workspace_id, user_id, role, created_at")
        .in("workspace_id", ids);
      members = data ?? [];
    }
    return {
      workspaces: (workspaces ?? []).map((w: any) => ({
        ...w,
        isOwner: w.owner_id === userId,
        members: members.filter((m) => m.workspace_id === w.id),
      })),
    };
  });

export const createWorkspace = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string }) => {
    const name = (d?.name ?? "").trim();
    if (!name || name.length > 60) throw new Error("Team name must be 1–60 characters");
    return { name };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const slug = `${slugify(data.name)}-${Math.random().toString(36).slice(2, 7)}`;
    const { data: workspace, error } = await supabase
      .from("manovik_workspaces")
      .insert({ name: data.name, slug, owner_id: userId })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    await supabase
      .from("manovik_workspace_members")
      .insert({ workspace_id: workspace.id, user_id: userId, role: "owner" });
    return { id: workspace.id as string };
  });

export const inviteMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string; email: string; role?: string }) => {
    const email = (d?.email ?? "").trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
      throw new Error("Enter a valid email address");
    }
    const role = d?.role ?? "editor";
    if (!["admin", "editor", "viewer"].includes(role)) throw new Error("Invalid role");
    return { workspaceId: d.workspaceId, email, role };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const { data: invite, error } = await supabase
      .from("manovik_workspace_invites")
      .insert({
        workspace_id: data.workspaceId,
        email: data.email,
        role: data.role,
        invited_by: userId,
      })
      .select("token")
      .single();
    if (error) throw new Error(error.message);
    return { token: invite.token as string };
  });

export const listInvites = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { workspaceId: string }) => ({ workspaceId: d.workspaceId }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { data: invites } = await supabase
      .from("manovik_workspace_invites")
      .select("id, email, role, token, accepted_at, expires_at, created_at")
      .eq("workspace_id", data.workspaceId)
      .order("created_at", { ascending: false })
      .limit(50);
    return { invites: invites ?? [] };
  });

export const revokeInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { inviteId: string }) => ({ inviteId: d.inviteId }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("manovik_workspace_invites").delete().eq("id", data.inviteId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const acceptInvite = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { token: string }) => {
    const token = (d?.token ?? "").trim();
    if (!/^[a-f0-9]{16,96}$/.test(token)) throw new Error("Invalid invite link");
    return { token };
  })
  .handler(async ({ context, data }) => {
    const { userId, claims } = context as any;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: invite } = await supabaseAdmin
      .from("manovik_workspace_invites")
      .select("id, workspace_id, email, role, accepted_at, expires_at")
      .eq("token", data.token)
      .maybeSingle();
    if (!invite) throw new Error("Invite not found");
    if (invite.accepted_at) throw new Error("Invite already used");
    if (new Date(invite.expires_at as string) < new Date()) throw new Error("Invite has expired");

    const email = String(claims?.email ?? "").toLowerCase();
    if (email && email !== String(invite.email).toLowerCase()) {
      throw new Error("This invite was sent to a different email address");
    }

    await supabaseAdmin
      .from("manovik_workspace_members")
      .upsert(
        { workspace_id: invite.workspace_id, user_id: userId, role: invite.role },
        { onConflict: "workspace_id,user_id" },
      );
    await supabaseAdmin
      .from("manovik_workspace_invites")
      .update({ accepted_at: new Date().toISOString() })
      .eq("id", invite.id);
    return { workspaceId: invite.workspace_id as string };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string; role: string }) => {
    if (!["admin", "editor", "viewer"].includes(d?.role)) throw new Error("Invalid role");
    return { memberId: d.memberId, role: d.role };
  })
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("manovik_workspace_members")
      .update({ role: data.role })
      .eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { memberId: string }) => ({ memberId: d.memberId }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("manovik_workspace_members").delete().eq("id", data.memberId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
