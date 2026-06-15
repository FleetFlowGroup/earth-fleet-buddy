
-- 1. Tighten audit_log: only admins can read (IPs/user agents are PII)
DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log
  FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND public.is_admin(company_id));

-- 2. Tighten operators_select: only office roles (admin/manager/office_staff) + self
DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select ON public.operators
  FOR SELECT TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND (public.is_office(company_id) OR user_id = auth.uid())
  );

-- 3. Tighten reminder_log: restrict to office roles only (hide recipient emails)
DROP POLICY IF EXISTS "Members read reminders" ON public.reminder_log;
CREATE POLICY "Office reads reminders" ON public.reminder_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.compliance_records cr
      WHERE cr.id = reminder_log.compliance_id
        AND public.is_office(cr.company_id)
    )
    OR EXISTS (
      SELECT 1 FROM public.operator_licences ol
      WHERE ol.id = reminder_log.operator_licence_id
        AND public.is_office(ol.company_id)
    )
  );

-- 4. Storage: remove permissive bucket-wide INSERT; align editor-upload with can_edit_company
DROP POLICY IF EXISTS "asset-photos company members write" ON storage.objects;
DROP POLICY IF EXISTS "Editors upload asset photos" ON storage.objects;
CREATE POLICY "Editors upload asset photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'asset-photos'
    AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );
