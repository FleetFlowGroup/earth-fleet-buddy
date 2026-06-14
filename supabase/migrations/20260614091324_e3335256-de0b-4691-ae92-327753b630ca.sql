-- Restore EXECUTE for authenticated on RLS helper functions that policies depend on.
GRANT EXECUTE ON FUNCTION public.is_company_member(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_edit_company(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_role(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_office(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_workshop(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_operator(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.operator_asset_ids() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.company_asset_limit(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.contact_enquiry_rate_check(text, integer, integer) TO anon, authenticated;