
-- 1) meter_readings: allow editors to update/delete
CREATE POLICY "Editors update meter readings" ON public.meter_readings
  FOR UPDATE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id))
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));

CREATE POLICY "Editors delete meter readings" ON public.meter_readings
  FOR DELETE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id));

-- 2) service_history: allow editors to update/delete
CREATE POLICY "Editors update service history" ON public.service_history
  FOR UPDATE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id))
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));

CREATE POLICY "Editors delete service history" ON public.service_history
  FOR DELETE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id));

-- 3) reminder_log: extend SELECT to cover operator licence reminders
DROP POLICY IF EXISTS "Members read reminders" ON public.reminder_log;
CREATE POLICY "Members read reminders" ON public.reminder_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.compliance_records cr
      WHERE cr.id = reminder_log.compliance_id
        AND public.is_company_member(auth.uid(), cr.company_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.operator_licences ol
      WHERE ol.id = reminder_log.operator_licence_id
        AND public.is_company_member(auth.uid(), ol.company_id)
    )
  );

-- 4) Email queue helpers — set a fixed search_path
ALTER FUNCTION public.enqueue_email(text, jsonb) SET search_path = public;
ALTER FUNCTION public.delete_email(text, bigint) SET search_path = public;
ALTER FUNCTION public.read_email_batch(text, integer, integer) SET search_path = public;
ALTER FUNCTION public.move_to_dlq(text, text, bigint, jsonb) SET search_path = public;

-- 5) Lock down SECURITY DEFINER function EXECUTE grants.
--    Default grant gives PUBLIC (incl. anon) EXECUTE on functions.
--    Revoke from PUBLIC for every SECURITY DEFINER function in public, then re-grant narrowly.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef = true
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', r.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', r.sig);
  END LOOP;
END $$;

-- Re-grant EXECUTE to authenticated for functions intentionally called from user sessions.
GRANT EXECUTE ON FUNCTION public.create_company_with_admin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_operator_meter(uuid, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.log_audit(uuid, text, text, uuid, jsonb, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_billing_state(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, uuid, public.app_role) TO authenticated;
