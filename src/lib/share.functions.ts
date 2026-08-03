import { createServerFn } from "@tanstack/react-start";
import { createPublicSupabase } from "@/lib/share.server";

/** Public read of a project shared via link/public visibility. No auth required. */
export const getSharedProject = createServerFn({ method: "POST" })
  .inputValidator((d: { token: string }) => {
    const token = (d?.token ?? "").trim();
    if (!/^[a-zA-Z0-9_-]{8,80}$/.test(token)) throw new Error("Invalid share link");
    return { token };
  })
  .handler(async ({ data }) => {
    const supabase = createPublicSupabase();
    const { data: project } = await supabase
      .from("manovik_projects")
      .select("id, name, description, framework, entry_path, visibility, updated_at")
      .eq("share_token", data.token)
      .in("visibility", ["link", "public"])
      .maybeSingle();
    if (!project) return { project: null, files: [] };
    const { data: files } = await supabase
      .from("manovik_project_files")
      .select("path, content, language")
      .eq("project_id", project.id)
      .order("path");
    return { project, files: files ?? [] };
  });
