import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  MAX_FILES_PER_PROJECT,
  MAX_FILE_BYTES,
  languageForPath,
  normalizePath,
  previewDocument,
  runBuild,
  starterFiles,
} from "@/lib/projects.server";

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context as any;
    const { data, error } = await supabase
      .from("manovik_projects")
      .select("id, name, description, framework, visibility, share_token, workspace_id, updated_at, created_at")
      .eq("archived", false)
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) throw new Error(error.message);
    return { projects: data ?? [] };
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { name: string; description?: string; framework?: string; workspaceId?: string | null }) => {
    const name = (d?.name ?? "").trim();
    if (!name || name.length > 80) throw new Error("Project name must be 1–80 characters");
    const framework = d?.framework ?? "react";
    if (!["react", "node", "python"].includes(framework)) throw new Error("Unsupported framework");
    return {
      name,
      description: (d?.description ?? "").slice(0, 500),
      framework,
      workspaceId: d?.workspaceId ?? null,
    };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const { data: project, error } = await supabase
      .from("manovik_projects")
      .insert({
        owner_id: userId,
        name: data.name,
        description: data.description || null,
        framework: data.framework,
        workspace_id: data.workspaceId,
        entry_path: data.framework === "python" ? "main.py" : data.framework === "node" ? "index.js" : "src/App.tsx",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const files = starterFiles(data.framework).map((f) => ({
      project_id: project.id,
      path: f.path,
      content: f.content,
      language: f.language,
      size_bytes: f.content.length,
    }));
    const { error: fileError } = await supabase.from("manovik_project_files").insert(files);
    if (fileError) throw new Error(fileError.message);
    return { id: project.id as string };
  });

export const getProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => {
    if (!d?.id) throw new Error("Project id is required");
    return { id: d.id };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const { data: project, error } = await supabase
      .from("manovik_projects")
      .select("*")
      .eq("id", data.id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!project) throw new Error("Project not found");

    const [{ data: files }, { data: versions }, { data: builds }] = await Promise.all([
      supabase
        .from("manovik_project_files")
        .select("id, path, content, language, size_bytes, updated_at")
        .eq("project_id", data.id)
        .order("path"),
      supabase
        .from("manovik_project_versions")
        .select("id, version, label, created_at")
        .eq("project_id", data.id)
        .order("version", { ascending: false })
        .limit(25),
      supabase
        .from("manovik_builds")
        .select("id, command, status, exit_code, duration_ms, created_at")
        .eq("project_id", data.id)
        .order("created_at", { ascending: false })
        .limit(15),
    ]);

    return {
      project,
      files: files ?? [],
      versions: versions ?? [],
      builds: builds ?? [],
      canWrite: project.owner_id === userId || !!project.workspace_id,
    };
  });

export const saveFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; path: string; content: string }) => {
    if (!d?.projectId) throw new Error("Project id is required");
    const path = normalizePath(d.path);
    const content = typeof d.content === "string" ? d.content : "";
    if (content.length > MAX_FILE_BYTES) throw new Error("File exceeds 200 kB limit");
    return { projectId: d.projectId, path, content };
  })
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { count } = await supabase
      .from("manovik_project_files")
      .select("id", { count: "exact", head: true })
      .eq("project_id", data.projectId);
    if ((count ?? 0) >= MAX_FILES_PER_PROJECT) {
      const { data: existing } = await supabase
        .from("manovik_project_files")
        .select("id")
        .eq("project_id", data.projectId)
        .eq("path", data.path)
        .maybeSingle();
      if (!existing) throw new Error(`Project file limit (${MAX_FILES_PER_PROJECT}) reached`);
    }
    const { error } = await supabase.from("manovik_project_files").upsert(
      {
        project_id: data.projectId,
        path: data.path,
        content: data.content,
        language: languageForPath(data.path),
        size_bytes: data.content.length,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "project_id,path" },
    );
    if (error) throw new Error(error.message);
    await supabase
      .from("manovik_projects")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", data.projectId);
    return { ok: true };
  });

export const deleteFile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; path: string }) => ({
    projectId: d.projectId,
    path: normalizePath(d.path),
  }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { error } = await supabase
      .from("manovik_project_files")
      .delete()
      .eq("project_id", data.projectId)
      .eq("path", data.path);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: {
    id: string;
    name?: string;
    description?: string;
    visibility?: string;
    entryPath?: string;
    workspaceId?: string | null;
    archived?: boolean;
  }) => {
    if (!d?.id) throw new Error("Project id is required");
    if (d.visibility && !["private", "link", "public"].includes(d.visibility)) {
      throw new Error("Invalid visibility");
    }
    return d;
  })
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name.trim().slice(0, 80);
    if (data.description !== undefined) patch.description = data.description.slice(0, 500);
    if (data.visibility !== undefined) patch.visibility = data.visibility;
    if (data.entryPath !== undefined) patch.entry_path = normalizePath(data.entryPath);
    if (data.workspaceId !== undefined) patch.workspace_id = data.workspaceId;
    if (data.archived !== undefined) patch.archived = data.archived;
    const { error } = await supabase.from("manovik_projects").update(patch).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { id: string }) => ({ id: d.id }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { error } = await supabase.from("manovik_projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const saveVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; label?: string }) => ({
    projectId: d.projectId,
    label: (d.label ?? "").slice(0, 120),
  }))
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const { data: files } = await supabase
      .from("manovik_project_files")
      .select("path, content, language")
      .eq("project_id", data.projectId);
    const { data: last } = await supabase
      .from("manovik_project_versions")
      .select("version")
      .eq("project_id", data.projectId)
      .order("version", { ascending: false })
      .limit(1)
      .maybeSingle();
    const version = (last?.version ?? 0) + 1;
    const { error } = await supabase.from("manovik_project_versions").insert({
      project_id: data.projectId,
      version,
      label: data.label || `Snapshot ${version}`,
      snapshot: files ?? [],
      created_by: userId,
    });
    if (error) throw new Error(error.message);
    return { version };
  });

export const restoreVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; versionId: string }) => d)
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { data: version, error } = await supabase
      .from("manovik_project_versions")
      .select("snapshot, version")
      .eq("id", data.versionId)
      .eq("project_id", data.projectId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!version) throw new Error("Version not found");
    const snapshot = (version.snapshot ?? []) as { path: string; content: string; language?: string }[];

    await supabase.from("manovik_project_files").delete().eq("project_id", data.projectId);
    if (snapshot.length) {
      const { error: insertError } = await supabase.from("manovik_project_files").insert(
        snapshot.map((f) => ({
          project_id: data.projectId,
          path: f.path,
          content: f.content,
          language: f.language ?? languageForPath(f.path),
          size_bytes: f.content.length,
        })),
      );
      if (insertError) throw new Error(insertError.message);
    }
    return { restored: version.version as number };
  });

export const runProjectBuild = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string; command?: string }) => {
    const command = d?.command ?? "build";
    if (!["build", "test", "typecheck", "dev"].includes(command)) throw new Error("Unsupported command");
    return { projectId: d.projectId, command };
  })
  .handler(async ({ context, data }) => {
    const { supabase, userId } = context as any;
    const { data: project } = await supabase
      .from("manovik_projects")
      .select("entry_path")
      .eq("id", data.projectId)
      .maybeSingle();
    const { data: files } = await supabase
      .from("manovik_project_files")
      .select("path, content")
      .eq("project_id", data.projectId);

    const { data: build, error } = await supabase
      .from("manovik_builds")
      .insert({
        project_id: data.projectId,
        user_id: userId,
        command: data.command,
        status: "running",
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const result = runBuild(files ?? [], data.command, project?.entry_path ?? "");
    await supabase
      .from("manovik_builds")
      .update({
        status: result.status,
        exit_code: result.exitCode,
        logs: result.logs,
        duration_ms: result.durationMs,
        metadata: result.stats,
        finished_at: new Date().toISOString(),
      })
      .eq("id", build.id);

    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("manovik_usage_events").insert({
        user_id: userId,
        project_id: data.projectId,
        kind: "build",
        credits: 0,
        metadata: { command: data.command, status: result.status, ...result.stats },
      });
    } catch {
      /* metering must never fail a build */
    }

    return { buildId: build.id as string, ...result };
  });

export const getBuildLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { buildId: string }) => ({ buildId: d.buildId }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { data: build, error } = await supabase
      .from("manovik_builds")
      .select("id, command, status, exit_code, logs, duration_ms, created_at")
      .eq("id", data.buildId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return { build };
  });

export const getPreviewHtml = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: { projectId: string }) => ({ projectId: d.projectId }))
  .handler(async ({ context, data }) => {
    const { supabase } = context as any;
    const { data: project } = await supabase
      .from("manovik_projects")
      .select("entry_path")
      .eq("id", data.projectId)
      .maybeSingle();
    const { data: files } = await supabase
      .from("manovik_project_files")
      .select("path, content")
      .eq("project_id", data.projectId);
    return { html: previewDocument(files ?? [], project?.entry_path ?? "") };
  });
