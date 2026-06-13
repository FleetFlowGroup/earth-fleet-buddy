
-- 1. Extend asset_type enum with detailed types
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'truck';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'prime_mover';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'ute';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'car';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'excavator';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'loader';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'skid_steer';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'dozer';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'grader';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'roller';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'water_cart';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'dump_truck';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'generator';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'compressor';
ALTER TYPE asset_type ADD VALUE IF NOT EXISTS 'attachment';

-- 2. Extend compliance_type enum
ALTER TYPE compliance_type ADD VALUE IF NOT EXISTS 'plant_inspection';
ALTER TYPE compliance_type ADD VALUE IF NOT EXISTS 'safety_inspection';
ALTER TYPE compliance_type ADD VALUE IF NOT EXISTS 'operator_licence';
ALTER TYPE compliance_type ADD VALUE IF NOT EXISTS 'fire_extinguisher';
ALTER TYPE compliance_type ADD VALUE IF NOT EXISTS 'warranty';

-- 3. Asset status enum
DO $$ BEGIN
  CREATE TYPE asset_status AS ENUM ('active','workshop','broken_down','sold','disposed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 4. Extend assets table
ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS asset_number TEXT,
  ADD COLUMN IF NOT EXISTS serial_number TEXT,
  ADD COLUMN IF NOT EXISTS purchase_date DATE,
  ADD COLUMN IF NOT EXISTS purchase_price NUMERIC(12,2),
  ADD COLUMN IF NOT EXISTS location TEXT,
  ADD COLUMN IF NOT EXISTS operator_name TEXT,
  ADD COLUMN IF NOT EXISTS status asset_status NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS engine_hours NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS service_interval_hours INTEGER,
  ADD COLUMN IF NOT EXISTS last_service_hours NUMERIC(10,1),
  ADD COLUMN IF NOT EXISTS custom_type TEXT;

-- 5. Meter readings history (immutable log)
CREATE TABLE IF NOT EXISTS public.meter_readings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  meter_type TEXT NOT NULL CHECK (meter_type IN ('km','hours')),
  previous_value NUMERIC(10,1),
  new_value NUMERIC(10,1) NOT NULL,
  difference NUMERIC(10,1),
  recorded_by UUID REFERENCES auth.users(id),
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.meter_readings TO authenticated;
GRANT ALL ON public.meter_readings TO service_role;
ALTER TABLE public.meter_readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read meter readings" ON public.meter_readings
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert meter readings" ON public.meter_readings
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE INDEX IF NOT EXISTS meter_readings_asset_idx ON public.meter_readings(asset_id, recorded_at DESC);

-- 6. Service history (immutable)
CREATE TABLE IF NOT EXISTS public.service_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets(id) ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  service_date DATE NOT NULL,
  workshop TEXT,
  technician TEXT,
  cost NUMERIC(12,2),
  odometer_at INTEGER,
  hours_at NUMERIC(10,1),
  parts_replaced TEXT,
  notes TEXT,
  invoice_path TEXT,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.service_history TO authenticated;
GRANT ALL ON public.service_history TO service_role;
ALTER TABLE public.service_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Members read service history" ON public.service_history
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert service history" ON public.service_history
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE INDEX IF NOT EXISTS service_history_asset_idx ON public.service_history(asset_id, service_date DESC);

-- 7. Document categories
ALTER TABLE public.documents
  ADD COLUMN IF NOT EXISTS category TEXT;
