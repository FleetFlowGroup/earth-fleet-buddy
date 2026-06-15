
-- 1. contact_enquiries: forbid client-supplied IP / user-agent on INSERT.
-- Server-side route uses service_role, which bypasses RLS, so it keeps working.
DROP POLICY IF EXISTS "Anyone can submit a contact enquiry" ON public.contact_enquiries;
CREATE POLICY "Anyone can submit a contact enquiry"
  ON public.contact_enquiries
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL AND length(trim(full_name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
    AND message IS NOT NULL AND length(trim(message)) > 0
    AND submitter_ip IS NULL
    AND submitter_user_agent IS NULL
  );

-- 2. email_send_log: allow platform admins to read for auditing.
CREATE POLICY "Platform admins can read email send log"
  ON public.email_send_log
  FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

-- 3. email_unsubscribe_tokens: re-target policies from public to service_role only.
DROP POLICY IF EXISTS "Service role can insert tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can read tokens" ON public.email_unsubscribe_tokens;
DROP POLICY IF EXISTS "Service role can mark tokens as used" ON public.email_unsubscribe_tokens;

CREATE POLICY "Service role manages unsubscribe tokens"
  ON public.email_unsubscribe_tokens
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 4. suppressed_emails: re-target policies from public to service_role only.
DROP POLICY IF EXISTS "Service role can insert suppressed emails" ON public.suppressed_emails;
DROP POLICY IF EXISTS "Service role can read suppressed emails" ON public.suppressed_emails;

CREATE POLICY "Service role manages suppressed emails"
  ON public.suppressed_emails
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- 5. Remove operator email-fallback escalation paths.
--    Account linking (handle_new_user trigger + accept_company_invite RPC)
--    already binds operators.user_id on signup, so user_id-only matching is safe.

-- operators_select: drop email fallback
DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select
  ON public.operators
  FOR SELECT
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND (
      is_office(company_id)
      OR user_id = auth.uid()
    )
  );

-- operator_licences_select: drop email fallback
DROP POLICY IF EXISTS operator_licences_select ON public.operator_licences;
CREATE POLICY operator_licences_select
  ON public.operator_licences
  FOR SELECT
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND (
      ("current_role"(company_id))::text <> ALL (ARRAY['operator'::text, 'viewer'::text])
      OR EXISTS (
        SELECT 1 FROM public.operators o
        WHERE o.id = operator_licences.operator_id
          AND o.user_id = auth.uid()
      )
    )
  );

-- operator_licences_self_insert: drop email fallback
DROP POLICY IF EXISTS operator_licences_self_insert ON public.operator_licences;
CREATE POLICY operator_licences_self_insert
  ON public.operator_licences
  FOR INSERT
  TO authenticated
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND EXISTS (
      SELECT 1 FROM public.operators o
      WHERE o.id = operator_licences.operator_id
        AND o.company_id = operator_licences.company_id
        AND o.user_id = auth.uid()
    )
  );

-- operator_licences_self_update: drop email fallback
DROP POLICY IF EXISTS operator_licences_self_update ON public.operator_licences;
CREATE POLICY operator_licences_self_update
  ON public.operator_licences
  FOR UPDATE
  TO authenticated
  USING (
    is_company_member(auth.uid(), company_id)
    AND EXISTS (
      SELECT 1 FROM public.operators o
      WHERE o.id = operator_licences.operator_id
        AND o.user_id = auth.uid()
    )
  )
  WITH CHECK (
    is_company_member(auth.uid(), company_id)
    AND EXISTS (
      SELECT 1 FROM public.operators o
      WHERE o.id = operator_licences.operator_id
        AND o.user_id = auth.uid()
    )
  );

-- ticket_assignments_operator_select: drop email fallback
DROP POLICY IF EXISTS ticket_assignments_operator_select ON public.ticket_assignments;
CREATE POLICY ticket_assignments_operator_select
  ON public.ticket_assignments
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.operators o
      WHERE o.id = ticket_assignments.operator_id
        AND o.user_id = auth.uid()
    )
  );
