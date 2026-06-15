-- Tighten SELECT policies so operators/viewers can't enumerate teammates' PII

DROP POLICY IF EXISTS operators_select ON public.operators;
CREATE POLICY operators_select ON public.operators
FOR SELECT
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    public.current_role(company_id)::text NOT IN ('operator','viewer')
    OR user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS operator_licences_select ON public.operator_licences;
CREATE POLICY operator_licences_select ON public.operator_licences
FOR SELECT
USING (
  public.is_company_member(auth.uid(), company_id)
  AND (
    public.current_role(company_id)::text NOT IN ('operator','viewer')
    OR operator_id IN (SELECT id FROM public.operators WHERE user_id = auth.uid())
  )
);