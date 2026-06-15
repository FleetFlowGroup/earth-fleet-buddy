
CREATE OR REPLACE FUNCTION public.current_user_email()
RETURNS text
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(email::text) FROM auth.users WHERE id = auth.uid()
$$;

GRANT EXECUTE ON FUNCTION public.current_user_email() TO authenticated;

DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select ON public.operators
FOR SELECT
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    public.is_office(company_id)
    OR user_id = auth.uid()
    OR (email IS NOT NULL AND lower(email) = public.current_user_email())
  )
);

DROP POLICY IF EXISTS operator_licences_select ON public.operator_licences;
CREATE POLICY operator_licences_select ON public.operator_licences
FOR SELECT
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    public.current_role(company_id)::text <> ALL (ARRAY['operator','viewer'])
    OR EXISTS (
      SELECT 1
      FROM public.operators o
      WHERE o.id = operator_licences.operator_id
        AND (
          o.user_id = auth.uid()
          OR (o.email IS NOT NULL AND lower(o.email) = public.current_user_email())
        )
    )
  )
);
