
-- Add per-company configurable prestart checklist items + asset attention flag

-- 1) Asset attention flag
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS requires_attention boolean NOT NULL DEFAULT false;

-- 2) Configurable checklist items table
CREATE TABLE IF NOT EXISTS public.prestart_template_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  section text NOT NULL,
  label text NOT NULL,
  sort_order integer NOT NULL DEFAULT 0,
  active boolean NOT NULL DEFAULT true,
  is_critical boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestart_template_items TO authenticated;
GRANT ALL ON public.prestart_template_items TO service_role;

ALTER TABLE public.prestart_template_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "psti_select" ON public.prestart_template_items
  FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "psti_insert" ON public.prestart_template_items
  FOR INSERT TO authenticated
  WITH CHECK (public.is_office(company_id));
CREATE POLICY "psti_update" ON public.prestart_template_items
  FOR UPDATE TO authenticated
  USING (public.is_office(company_id));
CREATE POLICY "psti_delete" ON public.prestart_template_items
  FOR DELETE TO authenticated
  USING (public.is_admin(company_id));

CREATE INDEX IF NOT EXISTS prestart_template_items_company_idx
  ON public.prestart_template_items(company_id, section, sort_order);

CREATE TRIGGER prestart_template_items_updated
  BEFORE UPDATE ON public.prestart_template_items
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) Seed function (defaults) for a single company
CREATE OR REPLACE FUNCTION public.seed_prestart_template(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  existing integer;
BEGIN
  SELECT count(*) INTO existing FROM public.prestart_template_items WHERE company_id = _company_id;
  IF existing > 0 THEN RETURN; END IF;

  INSERT INTO public.prestart_template_items (company_id, section, label, sort_order, is_critical) VALUES
    (_company_id, 'Engine',           'Engine oil level',         10, false),
    (_company_id, 'Engine',           'Coolant level',            20, false),
    (_company_id, 'Engine',           'Fuel level',               30, false),
    (_company_id, 'Engine',           'Hydraulic oil level',      40, false),
    (_company_id, 'Engine',           'Transmission oil (if applicable)', 50, false),
    (_company_id, 'Safety',           'Horn working',             60, true),
    (_company_id, 'Safety',           'Reverse alarm working',    70, true),
    (_company_id, 'Safety',           'Lights operational',       80, false),
    (_company_id, 'Safety',           'Beacon operational',       90, false),
    (_company_id, 'Safety',           'Fire extinguisher present',100, true),
    (_company_id, 'Safety',           'Seatbelt functioning',     110, true),
    (_company_id, 'Machine Condition','Tyres or tracks condition',120, false),
    (_company_id, 'Machine Condition','Hydraulic hoses inspected',130, false),
    (_company_id, 'Machine Condition','Visible leaks',            140, false),
    (_company_id, 'Machine Condition','Bucket/attachments secure',150, true),
    (_company_id, 'Machine Condition','Glass and mirrors clean',  160, false),
    (_company_id, 'Machine Condition','Steps and handrails secure',170, false),
    (_company_id, 'Cabin',            'Gauges operational',       180, false),
    (_company_id, 'Cabin',            'Air conditioning working', 190, false),
    (_company_id, 'Cabin',            'Controls functioning correctly', 200, true),
    (_company_id, 'Cabin',            'Windscreen wipers working',210, false),
    (_company_id, 'General',          'No visible defects',       220, false),
    (_company_id, 'General',          'Machine safe to operate',  230, true);
END;
$$;

-- 4) Backfill defaults for existing companies
DO $$
DECLARE c record;
BEGIN
  FOR c IN SELECT id FROM public.companies LOOP
    PERFORM public.seed_prestart_template(c.id);
  END LOOP;
END $$;

-- 5) Auto-seed on new company
CREATE OR REPLACE FUNCTION public.seed_prestart_template_after_company()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.seed_prestart_template(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS seed_prestart_template_trg ON public.companies;
CREATE TRIGGER seed_prestart_template_trg
  AFTER INSERT ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.seed_prestart_template_after_company();

-- 6) Add signature_path to prestart_checks
ALTER TABLE public.prestart_checks
  ADD COLUMN IF NOT EXISTS signature_path text;

-- 7) Add prestart_id link on defect_reports (for traceability)
ALTER TABLE public.defect_reports
  ADD COLUMN IF NOT EXISTS prestart_id uuid REFERENCES public.prestart_checks(id) ON DELETE SET NULL;

-- 8) When a fail prestart is inserted, mark asset requires_attention
CREATE OR REPLACE FUNCTION public.prestart_after_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'fail' THEN
    UPDATE public.assets SET requires_attention = true WHERE id = NEW.asset_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS prestart_after_insert_trg ON public.prestart_checks;
CREATE TRIGGER prestart_after_insert_trg
  AFTER INSERT ON public.prestart_checks
  FOR EACH ROW EXECUTE FUNCTION public.prestart_after_insert();

-- 9) When defect is resolved and no other open defects exist, clear flag
CREATE OR REPLACE FUNCTION public.defect_clear_attention()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  remaining integer;
BEGIN
  IF NEW.status = 'resolved' AND (OLD.status IS DISTINCT FROM 'resolved') THEN
    SELECT count(*) INTO remaining
      FROM public.defect_reports
      WHERE asset_id = NEW.asset_id AND status <> 'resolved' AND id <> NEW.id;
    IF remaining = 0 THEN
      UPDATE public.assets SET requires_attention = false WHERE id = NEW.asset_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS defect_clear_attention_trg ON public.defect_reports;
CREATE TRIGGER defect_clear_attention_trg
  AFTER UPDATE ON public.defect_reports
  FOR EACH ROW EXECUTE FUNCTION public.defect_clear_attention();
