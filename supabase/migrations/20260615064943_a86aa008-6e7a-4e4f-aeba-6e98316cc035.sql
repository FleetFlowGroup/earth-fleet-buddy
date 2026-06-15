
-- 1. Add company_id to reminder_log for direct scoping
ALTER TABLE public.reminder_log ADD COLUMN IF NOT EXISTS company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE;

-- Backfill from related tables
UPDATE public.reminder_log r SET company_id = cr.company_id
  FROM public.compliance_records cr
  WHERE r.company_id IS NULL AND r.compliance_id = cr.id;

UPDATE public.reminder_log r SET company_id = ol.company_id
  FROM public.operator_licences ol
  WHERE r.company_id IS NULL AND r.operator_licence_id = ol.id;

UPDATE public.reminder_log r SET company_id = a.company_id
  FROM public.assets a
  WHERE r.company_id IS NULL AND r.asset_id = a.id;

-- Drop any orphans that couldn't be scoped
DELETE FROM public.reminder_log WHERE company_id IS NULL;

ALTER TABLE public.reminder_log ALTER COLUMN company_id SET NOT NULL;

CREATE INDEX IF NOT EXISTS reminder_log_company_id_idx ON public.reminder_log (company_id);

-- Replace SELECT policy with direct company scoping
DROP POLICY IF EXISTS "Office reads reminders" ON public.reminder_log;
CREATE POLICY "Office reads reminders" ON public.reminder_log
  FOR SELECT TO authenticated
  USING (public.is_office(company_id));

-- 2. Add UPDATE storage policies mirroring INSERT
DROP POLICY IF EXISTS "Editors update asset photos" ON storage.objects;
CREATE POLICY "Editors update asset photos" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'asset-photos' AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'asset-photos' AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid));

DROP POLICY IF EXISTS "Editors update company docs" ON storage.objects;
CREATE POLICY "Editors update company docs" ON storage.objects
  FOR UPDATE TO authenticated
  USING (bucket_id = 'compliance-docs' AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid))
  WITH CHECK (bucket_id = 'compliance-docs' AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid));
