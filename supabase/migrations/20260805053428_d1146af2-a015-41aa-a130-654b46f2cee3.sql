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