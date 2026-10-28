CREATE OR REPLACE FUNCTION public.ensure_operator_membership_link() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles%ROWTYPE; candidate uuid; matches integer;
BEGIN
  IF NEW.role::text <> 'operator' THEN RETURN NEW; END IF;
  SELECT * INTO p FROM public.profiles WHERE id = NEW.user_id;
  IF p.id IS NULL THEN RAISE EXCEPTION 'operator_profile_missing'; END IF;
  IF EXISTS (SELECT 1 FROM public.operators WHERE user_id = NEW.user_id AND company_id = NEW.company_id) THEN RETURN NEW; END IF;
  SELECT count(*), (array_agg(id))[1] INTO matches, candidate FROM public.operators WHERE company_id = NEW.company_id AND user_id IS NULL AND lower(email) = lower(p.email);
  IF matches = 1 THEN
    UPDATE public.operators SET user_id = NEW.user_id, updated_at = now() WHERE id = candidate AND user_id IS NULL;
  ELSE
    INSERT INTO public.operators (company_id, user_id, full_name, email) VALUES (NEW.company_id, NEW.user_id, COALESCE(NULLIF(trim(p.full_name), ''), p.email), p.email);
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_operator_membership_link() FROM PUBLIC, anon, authenticated;
CREATE TRIGGER user_roles_operator_link AFTER INSERT OR UPDATE OF role, company_id ON public.user_roles FOR EACH ROW EXECUTE FUNCTION public.ensure_operator_membership_link();
ALTER POLICY prestart_insert ON public.prestart_checks TO authenticated WITH CHECK (
  performed_by = auth.uid() AND public.is_company_member(auth.uid(), company_id)
  AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND a.company_id = prestart_checks.company_id)
  AND (operator_id IS NULL OR EXISTS (SELECT 1 FROM public.operators o WHERE o.id = operator_id AND o.company_id = prestart_checks.company_id AND o.user_id = auth.uid()))
);
CREATE POLICY prestart_submitter_read ON public.prestart_checks FOR SELECT TO authenticated USING (performed_by = auth.uid() AND public.is_company_member(auth.uid(), company_id));
ALTER POLICY defect_insert ON public.defect_reports TO authenticated WITH CHECK (
  reported_by = auth.uid() AND public.is_company_member(auth.uid(), company_id)
  AND EXISTS (SELECT 1 FROM public.assets a WHERE a.id = asset_id AND a.company_id = defect_reports.company_id)
  AND (operator_id IS NULL OR EXISTS (SELECT 1 FROM public.operators o WHERE o.id = operator_id AND o.company_id = defect_reports.company_id AND o.user_id = auth.uid()))
  AND (prestart_id IS NULL OR EXISTS (SELECT 1 FROM public.prestart_checks p WHERE p.id = prestart_id AND p.company_id = defect_reports.company_id AND p.asset_id = defect_reports.asset_id))
);
CREATE POLICY defect_submitter_read ON public.defect_reports FOR SELECT TO authenticated USING (reported_by = auth.uid() AND public.is_company_member(auth.uid(), company_id));