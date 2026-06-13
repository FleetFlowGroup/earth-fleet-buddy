
-- Phase 2: asset enrichment, photos, expenses
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS current_value numeric(12,2),
  ADD COLUMN IF NOT EXISTS assigned_operator_id uuid REFERENCES public.operators(id) ON DELETE SET NULL;

-- asset_photos
CREATE TABLE IF NOT EXISTS public.asset_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  storage_path text NOT NULL,
  caption text,
  is_primary boolean NOT NULL DEFAULT false,
  uploaded_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_photos_asset ON public.asset_photos(asset_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_photos TO authenticated;
GRANT ALL ON public.asset_photos TO service_role;
ALTER TABLE public.asset_photos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read asset_photos" ON public.asset_photos FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert asset_photos" ON public.asset_photos FOR INSERT TO authenticated WITH CHECK (can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors update asset_photos" ON public.asset_photos FOR UPDATE TO authenticated USING (can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors delete asset_photos" ON public.asset_photos FOR DELETE TO authenticated USING (can_edit_company(auth.uid(), company_id));

-- asset_expenses
CREATE TABLE IF NOT EXISTS public.asset_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  asset_id uuid NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  vendor text,
  invoice_ref text,
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_asset_expenses_asset ON public.asset_expenses(asset_id);
CREATE INDEX IF NOT EXISTS idx_asset_expenses_date ON public.asset_expenses(expense_date);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_expenses TO authenticated;
GRANT ALL ON public.asset_expenses TO service_role;
ALTER TABLE public.asset_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read asset_expenses" ON public.asset_expenses FOR SELECT TO authenticated USING (is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert asset_expenses" ON public.asset_expenses FOR INSERT TO authenticated WITH CHECK (can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors update asset_expenses" ON public.asset_expenses FOR UPDATE TO authenticated USING (can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors delete asset_expenses" ON public.asset_expenses FOR DELETE TO authenticated USING (can_edit_company(auth.uid(), company_id));
CREATE TRIGGER set_updated_at_asset_expenses BEFORE UPDATE ON public.asset_expenses FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage policies for asset-photos bucket (bucket created via tool)
CREATE POLICY "Members read asset photos" ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'asset-photos' AND EXISTS (
    SELECT 1 FROM public.asset_photos p WHERE p.storage_path = name AND is_company_member(auth.uid(), p.company_id)
  ));
CREATE POLICY "Editors upload asset photos" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'asset-photos' AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));
CREATE POLICY "Editors delete asset photos" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'asset-photos' AND (storage.foldername(name))[1] IN (
    SELECT company_id::text FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin','manager')
  ));
