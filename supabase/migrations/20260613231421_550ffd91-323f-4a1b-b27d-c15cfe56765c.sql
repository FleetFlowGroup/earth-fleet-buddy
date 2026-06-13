
-- Link operators to auth users
ALTER TABLE public.operators ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS operators_user_id_idx ON public.operators(user_id);

-- Helper functions
CREATE OR REPLACE FUNCTION public.current_role(_company_id uuid)
RETURNS public.app_role
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT role FROM public.user_roles
  WHERE user_id = auth.uid() AND company_id = _company_id
  ORDER BY CASE role::text
    WHEN 'admin' THEN 1
    WHEN 'manager' THEN 2
    WHEN 'office_staff' THEN 3
    WHEN 'workshop' THEN 4
    WHEN 'viewer' THEN 5
    WHEN 'operator' THEN 6
    ELSE 99
  END
  LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.current_role(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.current_role(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role(_company_id)::text = 'admin' $$;
REVOKE ALL ON FUNCTION public.is_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_office(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role(_company_id)::text IN ('admin','manager','office_staff') $$;
REVOKE ALL ON FUNCTION public.is_office(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_office(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_workshop(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role(_company_id)::text IN ('admin','manager','workshop') $$;
REVOKE ALL ON FUNCTION public.is_workshop(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_workshop(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_operator(_company_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT public.current_role(_company_id)::text = 'operator' $$;
REVOKE ALL ON FUNCTION public.is_operator(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_operator(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.operator_asset_ids()
RETURNS SETOF uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT a.id FROM public.assets a
  JOIN public.operators o ON o.id = a.assigned_operator_id
  WHERE o.user_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.operator_asset_ids() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.operator_asset_ids() TO authenticated, service_role;

-- PRESTART CHECKS
CREATE TABLE IF NOT EXISTS public.prestart_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  performed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  checklist jsonb NOT NULL DEFAULT '[]'::jsonb,
  notes text,
  status text NOT NULL DEFAULT 'pass' CHECK (status IN ('pass','fail')),
  meter_reading numeric,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestart_checks TO authenticated;
GRANT ALL ON public.prestart_checks TO service_role;
ALTER TABLE public.prestart_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestart_select" ON public.prestart_checks FOR SELECT TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id)
         OR (public.is_operator(company_id) AND asset_id IN (SELECT public.operator_asset_ids())));
CREATE POLICY "prestart_insert" ON public.prestart_checks FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "prestart_update" ON public.prestart_checks FOR UPDATE TO authenticated
  USING (public.is_office(company_id));
CREATE POLICY "prestart_delete" ON public.prestart_checks FOR DELETE TO authenticated
  USING (public.is_admin(company_id));
CREATE TRIGGER prestart_checks_updated BEFORE UPDATE ON public.prestart_checks
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- PRESTART PHOTOS
CREATE TABLE IF NOT EXISTS public.prestart_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  prestart_id uuid NOT NULL REFERENCES public.prestart_checks(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prestart_photos TO authenticated;
GRANT ALL ON public.prestart_photos TO service_role;
ALTER TABLE public.prestart_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "prestart_photos_select" ON public.prestart_photos FOR SELECT TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id)
         OR (public.is_operator(company_id) AND prestart_id IN (SELECT id FROM public.prestart_checks WHERE asset_id IN (SELECT public.operator_asset_ids()))));
CREATE POLICY "prestart_photos_insert" ON public.prestart_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "prestart_photos_delete" ON public.prestart_photos FOR DELETE TO authenticated
  USING (public.is_office(company_id));

-- DEFECT REPORTS
CREATE TABLE IF NOT EXISTS public.defect_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL,
  reported_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high','critical')),
  description text NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','resolved')),
  reported_at timestamptz NOT NULL DEFAULT now(),
  resolved_at timestamptz,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolution_notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defect_reports TO authenticated;
GRANT ALL ON public.defect_reports TO service_role;
ALTER TABLE public.defect_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defect_select" ON public.defect_reports FOR SELECT TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id)
         OR (public.is_operator(company_id) AND asset_id IN (SELECT public.operator_asset_ids())));
CREATE POLICY "defect_insert" ON public.defect_reports FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "defect_update" ON public.defect_reports FOR UPDATE TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id));
CREATE POLICY "defect_delete" ON public.defect_reports FOR DELETE TO authenticated
  USING (public.is_admin(company_id));
CREATE TRIGGER defect_reports_updated BEFORE UPDATE ON public.defect_reports
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- DEFECT PHOTOS
CREATE TABLE IF NOT EXISTS public.defect_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  defect_id uuid NOT NULL REFERENCES public.defect_reports(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.defect_photos TO authenticated;
GRANT ALL ON public.defect_photos TO service_role;
ALTER TABLE public.defect_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "defect_photos_select" ON public.defect_photos FOR SELECT TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id)
         OR (public.is_operator(company_id) AND defect_id IN (SELECT id FROM public.defect_reports WHERE asset_id IN (SELECT public.operator_asset_ids()))));
CREATE POLICY "defect_photos_insert" ON public.defect_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "defect_photos_delete" ON public.defect_photos FOR DELETE TO authenticated
  USING (public.is_office(company_id));

-- SERVICE PHOTOS
CREATE TABLE IF NOT EXISTS public.service_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.service_history(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  uploaded_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_photos TO authenticated;
GRANT ALL ON public.service_photos TO service_role;
ALTER TABLE public.service_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_photos_select" ON public.service_photos FOR SELECT TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id)
         OR (public.is_operator(company_id) AND service_id IN (SELECT id FROM public.service_history WHERE asset_id IN (SELECT public.operator_asset_ids()))));
CREATE POLICY "service_photos_insert" ON public.service_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "service_photos_delete" ON public.service_photos FOR DELETE TO authenticated
  USING (public.is_office(company_id) OR public.is_workshop(company_id));

-- Storage policies for asset-photos bucket
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'asset-photos company members read' AND schemaname = 'storage') THEN
    EXECUTE $p$CREATE POLICY "asset-photos company members read" ON storage.objects FOR SELECT TO authenticated
      USING (bucket_id = 'asset-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid))$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'asset-photos company members write' AND schemaname = 'storage') THEN
    EXECUTE $p$CREATE POLICY "asset-photos company members write" ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'asset-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid))$p$;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'asset-photos company members delete' AND schemaname = 'storage') THEN
    EXECUTE $p$CREATE POLICY "asset-photos company members delete" ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'asset-photos' AND public.is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid))$p$;
  END IF;
END $$;
