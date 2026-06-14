
-- Subscriptions: restrict to service_role only
DROP POLICY IF EXISTS "Service role manages subscriptions" ON public.subscriptions;
CREATE POLICY "Service role manages subscriptions" ON public.subscriptions
  FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Contact enquiries: require basic fields rather than blanket true
DROP POLICY IF EXISTS "Anyone can submit a contact enquiry" ON public.contact_enquiries;
CREATE POLICY "Anyone can submit a contact enquiry" ON public.contact_enquiries
  FOR INSERT TO anon, authenticated
  WITH CHECK (
    full_name IS NOT NULL AND length(trim(full_name)) > 0
    AND email IS NOT NULL AND length(trim(email)) > 0
    AND message IS NOT NULL AND length(trim(message)) > 0
  );

-- Revoke anon EXECUTE on admin-only invite management funcs
REVOKE EXECUTE ON FUNCTION public.mark_invite_email_sent(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.remove_member(uuid, uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.resend_company_invite(uuid) FROM anon, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, app_role) FROM anon, PUBLIC;
GRANT EXECUTE ON FUNCTION public.mark_invite_email_sent(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.resend_company_invite(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, app_role) TO authenticated;
