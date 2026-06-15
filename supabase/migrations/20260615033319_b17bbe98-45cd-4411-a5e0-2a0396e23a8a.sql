GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_licences TO authenticated;
GRANT ALL ON public.operator_licences TO service_role;

DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select ON public.operators
FOR SELECT
TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    public.is_office(company_id)
    OR user_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM auth.users u
      WHERE u.id = auth.uid()
        AND operators.email IS NOT NULL
        AND u.email IS NOT NULL
        AND lower(operators.email) = lower(u.email::text)
    )
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
      LEFT JOIN auth.users u ON u.id = auth.uid()
      WHERE o.id = operator_licences.operator_id
        AND (
          o.user_id = auth.uid()
          OR (
            o.email IS NOT NULL
            AND u.email IS NOT NULL
            AND lower(o.email) = lower(u.email::text)
          )
        )
    )
  )
);