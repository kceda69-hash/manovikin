-- Migration: 20260710053920_79a7e97b-d6da-4194-99bc-59ace60b7239.sql

-- Revoke EXECUTE from PUBLIC/anon/authenticated on SECURITY DEFINER functions
-- that should never be invoked directly via the Data API. service_role and the
-- functions' own owner still retain access (revokes below do not affect owner).

DO $$
DECLARE
  fn text;
  fns text[] := ARRAY[
    'public.handle_new_user()',
    'public.move_to_dlq(text, text, bigint, jsonb)',
    'public.get_security_scan_token()',
    'public.manovik_spend_credit(uuid, integer, text)',
    'public.delete_email(text, bigint)',
    'public.manovik_topup_credit(uuid, integer, text)',
    'public.email_queue_wake()',
    'public.enqueue_email(text, jsonb)',
    'public.read_email_batch(text, integer, integer)',
    'public.email_queue_dispatch()',
    'public.grant_owner_admin_on_verify()',
    'public.magic_link_check_and_record(text, text)'
  ];
BEGIN
  FOREACH fn IN ARRAY fns LOOP
    -- Skip functions that were never created (e.g. provisioned out-of-band on
    -- older projects). REVOKE on a missing function raises 42883 and aborts.
    IF to_regprocedure(fn) IS NULL THEN
      RAISE NOTICE 'Skipping missing function %', fn;
      CONTINUE;
    END IF;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM anon', fn);
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM authenticated', fn);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', fn);
  END LOOP;
END $$;

-- has_role is called inside RLS policies evaluated as the requesting user, so
-- authenticated users must retain EXECUTE. Remove PUBLIC/anon exposure.
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

-- touch_updated_at is SECURITY INVOKER (trigger); still tighten exposure.
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM anon;
REVOKE ALL ON FUNCTION public.touch_updated_at() FROM authenticated;

-- Migration: 20260710070420_806dda8f-a8cd-4b0b-929e-c96e1bf7b5ea.sql
-- Switch public.has_role to SECURITY INVOKER so it is no longer a
-- SECURITY DEFINER function executable by signed-in users. authenticated
-- already has SELECT on public.user_roles, so RLS policies calling
-- has_role() continue to work under the caller's role.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$function$;
-- Migration: 20260711035849_647ff3e3-c456-4e8c-af25-eb75bce0287f.sql
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'manovik-security-self-scan') THEN
    PERFORM cron.unschedule('manovik-security-self-scan');
  END IF;
END $$;

SELECT cron.schedule(
  'manovik-security-self-scan',
  '*/15 * * * *',
  $cron$
  SELECT net.http_post(
    url := 'https://project--9e140ba8-6acc-42f5-8e24-1a6609f849b5.lovable.app/api/public/hooks/security-scan',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || public.get_security_scan_token()
    ),
    body := '{}'::jsonb
  );
  $cron$
);

CREATE OR REPLACE FUNCTION public.security_scan_new_findings(_run_id uuid)
RETURNS TABLE (check_name text, status text, details jsonb)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  WITH prev AS (
    SELECT run_id
    FROM public.security_self_checks
    WHERE run_id <> _run_id
      AND ran_at <= (
        SELECT max(ran_at) FROM public.security_self_checks WHERE run_id = _run_id
      )
    ORDER BY ran_at DESC
    LIMIT 1
  ),
  prev_fails AS (
    SELECT s.check_name
    FROM public.security_self_checks s
    JOIN prev p ON p.run_id = s.run_id
    WHERE s.status IN ('fail','warn')
  ),
  curr_fails AS (
    SELECT check_name, status, details
    FROM public.security_self_checks
    WHERE run_id = _run_id
      AND status IN ('fail','warn')
  )
  SELECT c.check_name, c.status, c.details
  FROM curr_fails c
  WHERE NOT EXISTS (SELECT 1 FROM prev_fails p WHERE p.check_name = c.check_name);
$$;

REVOKE ALL ON FUNCTION public.security_scan_new_findings(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.security_scan_new_findings(uuid) TO service_role;
-- Migration: 20260716042521_7647274f-3f57-40e4-806a-5e8caca7bf08.sql
GRANT INSERT ON public.manovik_brain_updates TO authenticated;
CREATE POLICY "admins insert brain updates" ON public.manovik_brain_updates
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
-- Migration: 20260717120219_6f04468e-1613-4013-b1ec-953f2f47c871.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;

INSERT INTO public.user_roles (user_id, role)
SELECT id, 'admin'::public.app_role
FROM auth.users
WHERE lower(email) = lower('kchaudharyofficial26@gmail.com')
ON CONFLICT (user_id, role) DO NOTHING;
-- Migration: 20260717120249_fb3d34e2-9d9e-4519-82a2-44445d2c3a42.sql
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO service_role;
-- Migration: 20260720160849_3ca61185-8b67-4139-99ca-c05da07c4da0.sql
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS ui_prefs jsonb NOT NULL DEFAULT '{}'::jsonb;
-- Migration: 20260727072124_1540b431-1a13-4f90-8df9-9dedac9adaae.sql
CREATE TABLE IF NOT EXISTS public.manovik_devices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  platform TEXT NOT NULL DEFAULT 'unknown',
  pair_code TEXT UNIQUE,
  pair_code_expires_at TIMESTAMPTZ,
  token_hash TEXT,
  paired_at TIMESTAMPTZ,
  last_seen_at TIMESTAMPTZ,
  capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_devices TO authenticated;
GRANT ALL ON public.manovik_devices TO service_role;
ALTER TABLE public.manovik_devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own devices" ON public.manovik_devices FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE IF NOT EXISTS public.manovik_device_commands (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.manovik_devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'shell',
  command TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  result TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_device_commands TO authenticated;
GRANT ALL ON public.manovik_device_commands TO service_role;
ALTER TABLE public.manovik_device_commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own device commands" ON public.manovik_device_commands FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS manovik_device_commands_device_idx ON public.manovik_device_commands(device_id, status, created_at);
-- Migration: 20260803060958_425c5d18-ac88-4e21-ac02-b0c428b6a85a.sql
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
-- Migration: 20260803061055_5574a526-8ddb-4b27-97f0-3c6072afd6d1.sql
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_write_project(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_write_project(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) TO anon, authenticated, service_role;
-- Migration: 20260805053428_d1146af2-a015-41aa-a130-654b46f2cee3.sql
-- 1) Workspace injection: require membership when attaching a project to a workspace
DROP POLICY IF EXISTS "projects insert own" ON public.manovik_projects;
CREATE POLICY "projects insert own"
  ON public.manovik_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    owner_id = auth.uid()
    AND (
      workspace_id IS NULL
      OR public.can_write_workspace(workspace_id, auth.uid())
    )
  );

DROP POLICY IF EXISTS "projects update" ON public.manovik_projects;
CREATE POLICY "projects update"
  ON public.manovik_projects
  FOR UPDATE
  TO authenticated
  USING (
    owner_id = auth.uid()
    OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid()))
  )
  WITH CHECK (
    (
      owner_id = auth.uid()
      OR (workspace_id IS NOT NULL AND public.can_write_workspace(workspace_id, auth.uid()))
    )
    AND (
      workspace_id IS NULL
      OR public.can_write_workspace(workspace_id, auth.uid())
    )
  );

-- 2) SECURITY DEFINER functions must not be directly callable from the Data API.
--    These helpers exist only to support RLS policy evaluation and internal jobs.
REVOKE EXECUTE ON FUNCTION public.can_read_project(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_write_project(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.can_write_workspace(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.is_workspace_member(uuid, uuid) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.workspace_role_of(uuid, uuid) FROM anon, authenticated, public;

REVOKE EXECUTE ON FUNCTION public.delete_email(text, bigint) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.enqueue_email(text, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.read_email_batch(text, integer, integer) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.move_to_dlq(text, text, bigint, jsonb) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.email_queue_dispatch() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.get_security_scan_token() FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.magic_link_check_and_record(text, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.manovik_spend_credit(uuid, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.manovik_topup_credit(uuid, integer, text) FROM anon, authenticated, public;
REVOKE EXECUTE ON FUNCTION public.security_scan_new_findings(uuid) FROM anon, authenticated, public;
-- Migration: 20260806095357_f110d164-c4a4-49ed-8ee3-c71d35e3e478.sql
CREATE TABLE public.seo_monitor_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  captured_at timestamptz NOT NULL DEFAULT now(),
  site_url text NOT NULL,
  sitemap_errors integer NOT NULL DEFAULT 0,
  sitemap_warnings integer NOT NULL DEFAULT 0,
  indexed_urls integer,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  avg_position numeric,
  ok boolean NOT NULL DEFAULT true,
  raw jsonb NOT NULL DEFAULT '{}'::jsonb
);

GRANT SELECT ON public.seo_monitor_snapshots TO authenticated;
GRANT ALL ON public.seo_monitor_snapshots TO service_role;
ALTER TABLE public.seo_monitor_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo snapshots"
  ON public.seo_monitor_snapshots FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_monitor_snapshots_captured_at_idx
  ON public.seo_monitor_snapshots (captured_at DESC);

CREATE TABLE public.seo_monitor_alerts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  kind text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  details jsonb NOT NULL DEFAULT '{}'::jsonb,
  snapshot_id uuid REFERENCES public.seo_monitor_snapshots(id) ON DELETE SET NULL,
  acknowledged_at timestamptz,
  acknowledged_by uuid,
  notified_at timestamptz
);

GRANT SELECT, UPDATE ON public.seo_monitor_alerts TO authenticated;
GRANT ALL ON public.seo_monitor_alerts TO service_role;
ALTER TABLE public.seo_monitor_alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can view seo alerts"
  ON public.seo_monitor_alerts FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can acknowledge seo alerts"
  ON public.seo_monitor_alerts FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE INDEX seo_monitor_alerts_open_idx
  ON public.seo_monitor_alerts (created_at DESC) WHERE acknowledged_at IS NULL;
-- Migration: 20260806095848_889a1b96-4311-4722-aec7-f579064bf034.sql
CREATE OR REPLACE FUNCTION public.get_seo_monitor_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'seo_monitor_token' LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.get_seo_monitor_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_seo_monitor_token() TO service_role;
-- Migration: 20260808092945_be643744-5ed3-4d04-84e9-a7c3ce80f018.sql
CREATE EXTENSION IF NOT EXISTS vector;

-- ============ KNOWLEDGE MEMORY ============
CREATE TABLE public.manovik_memory_docs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workspace_id uuid REFERENCES public.manovik_workspaces(id) ON DELETE SET NULL,
  title text NOT NULL,
  source text NOT NULL DEFAULT 'paste',
  status text NOT NULL DEFAULT 'ready',
  chars integer NOT NULL DEFAULT 0,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_memory_docs TO authenticated;
GRANT ALL ON public.manovik_memory_docs TO service_role;
ALTER TABLE public.manovik_memory_docs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory docs owner all" ON public.manovik_memory_docs
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_manovik_memory_docs_updated BEFORE UPDATE ON public.manovik_memory_docs
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_memory_docs_user ON public.manovik_memory_docs(user_id, created_at DESC);

CREATE TABLE public.manovik_memory_chunks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  doc_id uuid NOT NULL REFERENCES public.manovik_memory_docs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content text NOT NULL,
  embedding vector(1536),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_memory_chunks TO authenticated;
GRANT ALL ON public.manovik_memory_chunks TO service_role;
ALTER TABLE public.manovik_memory_chunks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "memory chunks owner all" ON public.manovik_memory_chunks
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_memory_chunks_doc ON public.manovik_memory_chunks(doc_id, chunk_index);
CREATE INDEX idx_memory_chunks_embedding ON public.manovik_memory_chunks
  USING hnsw (embedding vector_cosine_ops);

CREATE OR REPLACE FUNCTION public.manovik_match_memory(
  _user_id uuid,
  query_embedding vector(1536),
  match_count integer DEFAULT 6
)
RETURNS TABLE (id uuid, doc_id uuid, title text, content text, similarity double precision)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT c.id, c.doc_id, d.title, c.content,
         1 - (c.embedding <=> query_embedding) AS similarity
  FROM public.manovik_memory_chunks c
  JOIN public.manovik_memory_docs d ON d.id = c.doc_id
  WHERE c.user_id = _user_id AND c.embedding IS NOT NULL
  ORDER BY c.embedding <=> query_embedding
  LIMIT LEAST(GREATEST(match_count, 1), 24)
$$;
REVOKE ALL ON FUNCTION public.manovik_match_memory(uuid, vector, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.manovik_match_memory(uuid, vector, integer) TO service_role;

-- ============ SCHEDULED AGENTS ============
CREATE TABLE public.manovik_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  objective text NOT NULL,
  mode text NOT NULL DEFAULT 'research',
  cadence text NOT NULL DEFAULT 'daily',
  enabled boolean NOT NULL DEFAULT true,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_run_at timestamptz,
  run_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_schedules TO authenticated;
GRANT ALL ON public.manovik_schedules TO service_role;
ALTER TABLE public.manovik_schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedules owner all" ON public.manovik_schedules
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_manovik_schedules_updated BEFORE UPDATE ON public.manovik_schedules
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX idx_schedules_due ON public.manovik_schedules(enabled, next_run_at);

CREATE TABLE public.manovik_schedule_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.manovik_schedules(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'running',
  result text,
  error text,
  duration_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.manovik_schedule_runs TO authenticated;
GRANT ALL ON public.manovik_schedule_runs TO service_role;
ALTER TABLE public.manovik_schedule_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "schedule runs owner read" ON public.manovik_schedule_runs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_schedule_runs_sched ON public.manovik_schedule_runs(schedule_id, created_at DESC);

-- ============ API KEYS ============
CREATE TABLE public.manovik_api_keys (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  label text NOT NULL,
  key_prefix text NOT NULL,
  key_hash text NOT NULL UNIQUE,
  scopes text[] NOT NULL DEFAULT ARRAY['ask']::text[],
  revoked_at timestamptz,
  expires_at timestamptz,
  last_used_at timestamptz,
  use_count integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_api_keys TO authenticated;
GRANT ALL ON public.manovik_api_keys TO service_role;
ALTER TABLE public.manovik_api_keys ENABLE ROW LEVEL SECURITY;
CREATE POLICY "api keys owner all" ON public.manovik_api_keys
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_api_keys_user ON public.manovik_api_keys(user_id, created_at DESC);
-- Migration: 20260808093026_10ec7c17-b325-435b-bcfe-3f15dec0d1d3.sql
REVOKE ALL ON FUNCTION public.manovik_match_memory(uuid, vector, integer) FROM authenticated;
-- Migration: 20260808093538_1e62321a-f05a-4a02-ba60-2d02a82acc6f.sql
SELECT vault.create_secret(encode(gen_random_bytes(32), 'hex'), 'schedules_run_token', 'Token for the scheduled agents cron hook')
WHERE NOT EXISTS (SELECT 1 FROM vault.secrets WHERE name = 'schedules_run_token');

CREATE OR REPLACE FUNCTION public.get_schedules_run_token()
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path TO 'public', 'vault'
AS $$
  SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'schedules_run_token' LIMIT 1
$$;
REVOKE ALL ON FUNCTION public.get_schedules_run_token() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_schedules_run_token() TO service_role;
-- Migration: 20260811152503_d4cbd0cf-0e9a-449a-8b24-d251c755da96.sql
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TABLE public.manovik_force_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  objective text NOT NULL,
  mode text NOT NULL DEFAULT 'build',
  status text NOT NULL DEFAULT 'running',
  answer text,
  score numeric,
  proof jsonb NOT NULL DEFAULT '{}'::jsonb,
  actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  error text,
  parent_run_id uuid REFERENCES public.manovik_force_runs(id) ON DELETE SET NULL,
  fork_from_step integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_runs TO authenticated;
GRANT ALL ON public.manovik_force_runs TO service_role;
ALTER TABLE public.manovik_force_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force runs"
  ON public.manovik_force_runs FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_force_agents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_force_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role text NOT NULL,
  model text NOT NULL,
  output text NOT NULL DEFAULT '',
  critique text,
  score numeric,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_agents TO authenticated;
GRANT ALL ON public.manovik_force_agents TO service_role;
ALTER TABLE public.manovik_force_agents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force agents"
  ON public.manovik_force_agents FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.manovik_force_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_force_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  idx integer NOT NULL,
  phase text NOT NULL,
  label text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.manovik_force_steps TO authenticated;
GRANT ALL ON public.manovik_force_steps TO service_role;
ALTER TABLE public.manovik_force_steps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage their own force steps"
  ON public.manovik_force_steps FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_force_runs_user_created ON public.manovik_force_runs (user_id, created_at DESC);
CREATE INDEX idx_force_agents_run ON public.manovik_force_agents (run_id);
CREATE INDEX idx_force_steps_run_idx ON public.manovik_force_steps (run_id, idx);

CREATE TRIGGER update_manovik_force_runs_updated_at
  BEFORE UPDATE ON public.manovik_force_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
-- Migration: 20260921073000_enable_rls_agi_tables.sql
-- Fix critical finding: AGI mission/lesson/doctrine tables had no row-level security.
--
-- manovik_agi_runs, manovik_agi_steps, manovik_agi_lessons and manovik_agi_doctrine
-- are queried by user-scoped server functions (see src/lib/mano/agi.functions.ts and
-- src/lib/mano/training.server.ts) but, unlike every other user table in the app, no
-- migration ever enabled RLS on them. This migration:
--   1. Creates the tables IF NOT EXISTS (they were originally created via the
--      dashboard, so this is a no-op in production but makes fresh self-hosted
--      databases work), and
--   2. Enables RLS and adds owner-only policies matching the convention used by
--      the other user tables (e.g. audit_logs): a user can only touch rows whose
--      user_id equals auth.uid().
--
-- Safe to apply on production: server functions query with the service-role key
-- (which bypasses RLS) and always scope by user_id; the policies only restrict
-- direct anon/authenticated-key access to a user's own rows.

-- ---------------------------------------------------------------------------
-- Tables (created only if missing)
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.manovik_agi_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  goal text NOT NULL,
  status text NOT NULL DEFAULT 'running',
  answer text,
  steps_used integer NOT NULL DEFAULT 0,
  score double precision,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_steps (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid NOT NULL REFERENCES public.manovik_agi_runs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  idx integer NOT NULL,
  thought text,
  tool text,
  tool_input text,
  observation text,
  ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_lessons (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  topic text NOT NULL,
  lesson text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.manovik_agi_doctrine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  doctrine text NOT NULL,
  active boolean NOT NULL DEFAULT false,
  runs_used integer NOT NULL DEFAULT 0,
  lessons_used integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_agi_runs_user_created
  ON public.manovik_agi_runs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agi_steps_run
  ON public.manovik_agi_steps(run_id, idx);
CREATE INDEX IF NOT EXISTS idx_agi_lessons_user_created
  ON public.manovik_agi_lessons(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_agi_doctrine_user_active
  ON public.manovik_agi_doctrine(user_id, active, created_at DESC);

-- ---------------------------------------------------------------------------
-- Row-level security: owner-only access, same convention as other user tables
-- ---------------------------------------------------------------------------

ALTER TABLE public.manovik_agi_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_lessons ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.manovik_agi_doctrine ENABLE ROW LEVEL SECURITY;

-- manovik_agi_runs
DROP POLICY IF EXISTS "own agi_runs select" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs select" ON public.manovik_agi_runs
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs insert" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs insert" ON public.manovik_agi_runs
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs update" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs update" ON public.manovik_agi_runs
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_runs delete" ON public.manovik_agi_runs;
CREATE POLICY "own agi_runs delete" ON public.manovik_agi_runs
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_steps
DROP POLICY IF EXISTS "own agi_steps select" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps select" ON public.manovik_agi_steps
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps insert" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps insert" ON public.manovik_agi_steps
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps update" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps update" ON public.manovik_agi_steps
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_steps delete" ON public.manovik_agi_steps;
CREATE POLICY "own agi_steps delete" ON public.manovik_agi_steps
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_lessons
DROP POLICY IF EXISTS "own agi_lessons select" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons select" ON public.manovik_agi_lessons
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons insert" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons insert" ON public.manovik_agi_lessons
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons update" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons update" ON public.manovik_agi_lessons
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_lessons delete" ON public.manovik_agi_lessons;
CREATE POLICY "own agi_lessons delete" ON public.manovik_agi_lessons
  FOR DELETE USING (auth.uid() = user_id);

-- manovik_agi_doctrine
DROP POLICY IF EXISTS "own agi_doctrine select" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine select" ON public.manovik_agi_doctrine
  FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine insert" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine insert" ON public.manovik_agi_doctrine
  FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine update" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine update" ON public.manovik_agi_doctrine
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "own agi_doctrine delete" ON public.manovik_agi_doctrine;
CREATE POLICY "own agi_doctrine delete" ON public.manovik_agi_doctrine
  FOR DELETE USING (auth.uid() = user_id);

