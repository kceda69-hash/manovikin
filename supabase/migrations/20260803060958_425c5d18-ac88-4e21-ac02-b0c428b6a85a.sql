-- ============ ENUMS ============
DO $$ BEGIN CREATE TYPE public.workspace_role AS ENUM ('owner','admin','editor','viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.project_visibility AS ENUM ('private','link','public'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.build_status AS ENUM ('queued','running','success','failed','cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ WORKSPACES ============
CREATE TABLE IF NOT EXISTS public.manovik_workspaces (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_workspaces TO authenticated;
GRANT ALL ON public.manovik_workspaces TO service_role;
ALTER TABLE public.manovik_workspaces ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.manovik_workspace_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.manovik_workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_workspace_members TO authenticated;
GRANT ALL ON public.manovik_workspace_members TO service_role;
ALTER TABLE public.manovik_workspace_members ENABLE ROW LEVEL SECURITY;

-- security definer helpers (avoid recursive RLS)
CREATE OR REPLACE FUNCTION public.is_workspace_member(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.manovik_workspace_members m
                 WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.workspace_role_of(_workspace_id uuid, _user_id uuid)
RETURNS public.workspace_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT m.role FROM public.manovik_workspace_members m
  WHERE m.workspace_id = _workspace_id AND m.user_id = _user_id LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.can_write_workspace(_workspace_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.workspace_role_of(_workspace_id, _user_id) IN ('owner','admin','editor')
$$;

CREATE POLICY "workspaces readable by members" ON public.manovik_workspaces
  FOR SELECT TO authenticated USING (owner_id = auth.uid() OR public.is_workspace_member(id, auth.uid()));
CREATE POLICY "workspaces insert own" ON public.manovik_workspaces
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces update by owner" ON public.manovik_workspaces
  FOR UPDATE TO authenticated USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE POLICY "workspaces delete by owner" ON public.manovik_workspaces
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE POLICY "members readable by members" ON public.manovik_workspace_members
  FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.is_workspace_member(workspace_id, auth.uid()));
CREATE POLICY "members managed by admins" ON public.manovik_workspace_members
  FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
         OR EXISTS (SELECT 1 FROM public.manovik_workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin')
         OR EXISTS (SELECT 1 FROM public.manovik_workspaces w WHERE w.id = workspace_id AND w.owner_id = auth.uid()));

CREATE TABLE IF NOT EXISTS public.manovik_workspace_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.manovik_workspaces(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.workspace_role NOT NULL DEFAULT 'editor',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'hex'),
  invited_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  accepted_at timestamptz,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_workspace_invites TO authenticated;
GRANT ALL ON public.manovik_workspace_invites TO service_role;
ALTER TABLE public.manovik_workspace_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "invites managed by admins" ON public.manovik_workspace_invites
  FOR ALL TO authenticated
  USING (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'))
  WITH CHECK (public.workspace_role_of(workspace_id, auth.uid()) IN ('owner','admin'));

-- ============ PROJECTS ============
CREATE TABLE IF NOT EXISTS public.manovik_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.manovik_workspaces(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  framework text NOT NULL DEFAULT 'react',
  visibility public.project_visibility NOT NULL DEFAULT 'private',
  share_token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  entry_path text NOT NULL DEFAULT 'src/App.tsx',
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_projects TO authenticated;
GRANT SELECT ON public.manovik_projects TO anon;
GRANT ALL ON public.manovik_projects TO service_role;
ALTER TABLE public.manovik_projects ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_read_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manovik_projects p
    WHERE p.id = _project_id
      AND (p.owner_id = _user_id
           OR p.visibility IN ('link','public')
           OR (p.workspace_id IS NOT NULL AND public.is_workspace_member(p.workspace_id, _user_id)))
  )
$$;

CREATE OR REPLACE FUNCTION public.can_write_project(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.manovik_projects p
    WHERE p.id = _project_id
      AND (p.owner_id = _user_id
           OR (p.workspace_id IS NOT NULL AND public.can_write_workspace(p.workspace_id, _user_id)))
  )
$$;

CREATE POLICY "projects select" ON public.manovik_projects
  FOR SELECT USING (
    owner_id = auth.uid()
    OR visibility IN ('link','public')
    OR (workspace_id IS NOT NULL AND public.is_workspace_member(workspace_id, auth.uid()))
  );
CREATE POLICY "projects insert own" ON public.manovik_projects
  FOR INSERT TO authenticated WITH CHECK (owner_id = auth.uid());
CREATE POLICY "projects update" ON public.manovik_projects
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid())))
  WITH CHECK (owner_id = auth.uid() OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid())));
CREATE POLICY "projects delete own" ON public.manovik_projects
  FOR DELETE TO authenticated USING (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.manovik_project_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.manovik_projects(id) ON DELETE CASCADE,
  path text NOT NULL,
  content text NOT NULL DEFAULT '',
  language text,
  size_bytes integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, path)
);
CREATE INDEX IF NOT EXISTS manovik_project_files_project_idx ON public.manovik_project_files(project_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_project_files TO authenticated;
GRANT SELECT ON public.manovik_project_files TO anon;
GRANT ALL ON public.manovik_project_files TO service_role;
ALTER TABLE public.manovik_project_files ENABLE ROW LEVEL SECURITY;
CREATE POLICY "files select" ON public.manovik_project_files
  FOR SELECT USING (public.can_read_project(project_id, auth.uid()));
CREATE POLICY "files write" ON public.manovik_project_files
  FOR ALL TO authenticated
  USING (public.can_write_project(project_id, auth.uid()))
  WITH CHECK (public.can_write_project(project_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.manovik_project_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.manovik_projects(id) ON DELETE CASCADE,
  version integer NOT NULL,
  label text,
  snapshot jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, version)
);
GRANT SELECT, INSERT, DELETE ON public.manovik_project_versions TO authenticated;
GRANT ALL ON public.manovik_project_versions TO service_role;
ALTER TABLE public.manovik_project_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "versions select" ON public.manovik_project_versions
  FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
CREATE POLICY "versions insert" ON public.manovik_project_versions
  FOR INSERT TO authenticated WITH CHECK (public.can_write_project(project_id, auth.uid()));
CREATE POLICY "versions delete" ON public.manovik_project_versions
  FOR DELETE TO authenticated USING (public.can_write_project(project_id, auth.uid()));

-- ============ BUILDS / RUNS ============
CREATE TABLE IF NOT EXISTS public.manovik_builds (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.manovik_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  command text NOT NULL DEFAULT 'build',
  status public.build_status NOT NULL DEFAULT 'queued',
  exit_code integer,
  logs text NOT NULL DEFAULT '',
  duration_ms integer,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz
);
CREATE INDEX IF NOT EXISTS manovik_builds_project_idx ON public.manovik_builds(project_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.manovik_builds TO authenticated;
GRANT ALL ON public.manovik_builds TO service_role;
ALTER TABLE public.manovik_builds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "builds select" ON public.manovik_builds
  FOR SELECT TO authenticated USING (public.can_read_project(project_id, auth.uid()));
CREATE POLICY "builds insert" ON public.manovik_builds
  FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid() AND public.can_write_project(project_id, auth.uid()));
CREATE POLICY "builds update" ON public.manovik_builds
  FOR UPDATE TO authenticated USING (public.can_write_project(project_id, auth.uid()))
  WITH CHECK (public.can_write_project(project_id, auth.uid()));

-- ============ USAGE + SUBSCRIPTIONS ============
CREATE TABLE IF NOT EXISTS public.manovik_usage_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.manovik_projects(id) ON DELETE SET NULL,
  kind text NOT NULL,
  model text,
  input_tokens integer NOT NULL DEFAULT 0,
  output_tokens integer NOT NULL DEFAULT 0,
  credits integer NOT NULL DEFAULT 0,
  cost_micros integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS manovik_usage_events_user_idx ON public.manovik_usage_events(user_id, created_at DESC);
GRANT SELECT ON public.manovik_usage_events TO authenticated;
GRANT ALL ON public.manovik_usage_events TO service_role;
ALTER TABLE public.manovik_usage_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "usage own select" ON public.manovik_usage_events
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.manovik_subscriptions (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  plan text NOT NULL DEFAULT 'free',
  status text NOT NULL DEFAULT 'active',
  monthly_credit_limit integer NOT NULL DEFAULT 100,
  period_start timestamptz NOT NULL DEFAULT date_trunc('month', now()),
  renews_at timestamptz,
  cancelled_at timestamptz,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_subscriptions TO authenticated;
GRANT ALL ON public.manovik_subscriptions TO service_role;
ALTER TABLE public.manovik_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "subscription own select" ON public.manovik_subscriptions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

-- ============ updated_at triggers ============
CREATE TRIGGER trg_manovik_workspaces_updated BEFORE UPDATE ON public.manovik_workspaces
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_manovik_projects_updated BEFORE UPDATE ON public.manovik_projects
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_manovik_project_files_updated BEFORE UPDATE ON public.manovik_project_files
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE TRIGGER trg_manovik_subscriptions_updated BEFORE UPDATE ON public.manovik_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();