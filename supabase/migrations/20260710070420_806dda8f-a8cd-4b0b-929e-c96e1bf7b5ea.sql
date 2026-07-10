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