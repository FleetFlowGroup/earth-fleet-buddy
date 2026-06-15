-- Tighten SELECT policies to authenticated role only (defense in depth)
DROP POLICY IF EXISTS prestart_select ON public.prestart_checks;
CREATE POLICY prestart_select ON public.prestart_checks
  FOR SELECT TO authenticated
  USING (
    public.is_office(company_id)
    OR public.is_workshop(company_id)
    OR (public.is_operator(company_id) AND asset_id IN (SELECT public.operator_asset_ids()))
  );

DROP POLICY IF EXISTS defect_select ON public.defect_reports;
CREATE POLICY defect_select ON public.defect_reports
  FOR SELECT TO authenticated
  USING (
    public.is_office(company_id)
    OR public.is_workshop(company_id)
    OR (public.is_operator(company_id) AND asset_id IN (SELECT public.operator_asset_ids()))
  );
