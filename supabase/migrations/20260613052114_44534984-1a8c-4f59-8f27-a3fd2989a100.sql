
-- Revoke broad EXECUTE on helper definer functions; keep create_company_with_admin callable
REVOKE EXECUTE ON FUNCTION public.has_role(UUID, UUID, public.app_role) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.is_company_member(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.can_edit_company(UUID, UUID) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Storage RLS for compliance-docs bucket; path layout: <company_id>/<asset_id>/<file>
CREATE POLICY "Members can read company docs"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Editors can upload company docs"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-docs'
  AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

CREATE POLICY "Editors can delete company docs"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
);
