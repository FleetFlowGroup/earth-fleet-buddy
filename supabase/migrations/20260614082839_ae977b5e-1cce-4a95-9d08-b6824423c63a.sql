
-- 1. Audit fields
ALTER TABLE public.prestart_checks
  ADD COLUMN IF NOT EXISTS submitter_ip text,
  ADD COLUMN IF NOT EXISTS submitter_user_agent text;

ALTER TABLE public.defect_reports
  ADD COLUMN IF NOT EXISTS submitter_ip text,
  ADD COLUMN IF NOT EXISTS submitter_user_agent text;

-- 2. Broaden operator SELECT to any asset in their company
DROP POLICY IF EXISTS "prestart_select" ON public.prestart_checks;
CREATE POLICY "prestart_select" ON public.prestart_checks
  FOR SELECT TO authenticated
  USING (
    is_office(company_id) OR is_workshop(company_id)
    OR (is_operator(company_id) AND is_company_member(auth.uid(), company_id))
  );

DROP POLICY IF EXISTS "defect_select" ON public.defect_reports;
CREATE POLICY "defect_select" ON public.defect_reports
  FOR SELECT TO authenticated
  USING (
    is_office(company_id) OR is_workshop(company_id)
    OR (is_operator(company_id) AND is_company_member(auth.uid(), company_id))
  );

-- 3. Allow operators to insert meter readings for their company
DROP POLICY IF EXISTS "Operators insert meter readings" ON public.meter_readings;
CREATE POLICY "Operators insert meter readings" ON public.meter_readings
  FOR INSERT TO authenticated
  WITH CHECK (is_company_member(auth.uid(), company_id));

-- 4. Secure helper for operator meter updates (operators cannot UPDATE assets directly)
CREATE OR REPLACE FUNCTION public.record_operator_meter(
  _asset_id uuid,
  _new_value numeric
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  a public.assets%ROWTYPE;
  mode text;
  prev numeric;
BEGIN
  SELECT * INTO a FROM public.assets WHERE id = _asset_id;
  IF a.id IS NULL THEN RAISE EXCEPTION 'asset_not_found'; END IF;
  IF NOT public.is_company_member(auth.uid(), a.company_id) THEN
    RAISE EXCEPTION 'not_authorised';
  END IF;
  -- decide mode based on existing helper convention (km vs hours)
  IF a.type::text IN ('vehicle','truck','prime_mover','trailer','ute','car') THEN
    mode := 'km';
    prev := a.odometer;
  ELSE
    mode := 'hours';
    prev := a.engine_hours;
  END IF;
  IF prev IS NOT NULL AND _new_value < prev THEN
    RAISE EXCEPTION 'meter_below_previous';
  END IF;

  INSERT INTO public.meter_readings (company_id, asset_id, meter_type, previous_value, new_value, difference, recorded_by)
  VALUES (a.company_id, _asset_id, mode, prev, _new_value,
          CASE WHEN prev IS NULL THEN NULL ELSE _new_value - prev END, auth.uid());

  IF mode = 'km' THEN
    UPDATE public.assets SET odometer = round(_new_value)::int WHERE id = _asset_id;
  ELSE
    UPDATE public.assets SET engine_hours = _new_value WHERE id = _asset_id;
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.record_operator_meter(uuid, numeric) TO authenticated;
