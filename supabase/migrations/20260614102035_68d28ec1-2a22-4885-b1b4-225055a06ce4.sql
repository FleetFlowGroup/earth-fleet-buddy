
-- 1. Restrict operator read on prestart_checks
DROP POLICY IF EXISTS prestart_select ON public.prestart_checks;
CREATE POLICY prestart_select ON public.prestart_checks
  FOR SELECT
  USING (
    is_office(company_id)
    OR is_workshop(company_id)
    OR (
      is_operator(company_id)
      AND is_company_member(auth.uid(), company_id)
      AND (
        performed_by = auth.uid()
        OR asset_id IN (SELECT public.operator_asset_ids())
      )
    )
  );

-- 2. Restrict operator read on defect_reports
DROP POLICY IF EXISTS defect_select ON public.defect_reports;
CREATE POLICY defect_select ON public.defect_reports
  FOR SELECT
  USING (
    is_office(company_id)
    OR is_workshop(company_id)
    OR (
      is_operator(company_id)
      AND is_company_member(auth.uid(), company_id)
      AND (
        reported_by = auth.uid()
        OR asset_id IN (SELECT public.operator_asset_ids())
      )
    )
  );

-- 3. Explicit deny for direct writes on user_roles by authenticated users.
-- Writes happen through SECURITY DEFINER RPCs (run as postgres, bypass RLS).
DROP POLICY IF EXISTS "no direct insert on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "no direct update on user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "no direct delete on user_roles" ON public.user_roles;
CREATE POLICY "no direct insert on user_roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (false);
CREATE POLICY "no direct update on user_roles" ON public.user_roles
  FOR UPDATE TO authenticated USING (false) WITH CHECK (false);
CREATE POLICY "no direct delete on user_roles" ON public.user_roles
  FOR DELETE TO authenticated USING (false);

-- 4. Revoke EXECUTE from anon on SECURITY DEFINER funcs that require auth anyway.
REVOKE EXECUTE ON FUNCTION public.accept_company_invite(text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_company_invite(app_role, text) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.create_company_invite(app_role, text, text, text) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_invite(app_role, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.create_company_invite(app_role, text, text, text) TO authenticated;

-- 5. Set search_path on email-queue helpers
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
