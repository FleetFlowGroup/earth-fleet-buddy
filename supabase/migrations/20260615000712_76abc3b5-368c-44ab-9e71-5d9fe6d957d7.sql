DROP POLICY IF EXISTS "Users read company profiles" ON public.profiles;

CREATE POLICY "Staff read company profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  company_id IS NOT NULL
  AND public.is_company_member(auth.uid(), company_id)
  AND public.current_role(company_id)::text IN ('admin','manager','supervisor','office_staff','super_admin')
);