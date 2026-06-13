
-- Operators
CREATE TABLE public.operators (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  employee_id TEXT,
  phone TEXT,
  email TEXT,
  position TEXT,
  depot TEXT,
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','inactive')),
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX operators_company_idx ON public.operators(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operators TO authenticated;
GRANT ALL ON public.operators TO service_role;

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operators_select" ON public.operators FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "operators_insert" ON public.operators FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "operators_update" ON public.operators FOR UPDATE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id))
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "operators_delete" ON public.operators FOR DELETE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id));

CREATE TRIGGER operators_set_updated_at BEFORE UPDATE ON public.operators
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Operator licences
CREATE TABLE public.operator_licences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  licence_type TEXT NOT NULL,
  licence_name TEXT,
  licence_number TEXT,
  issue_date DATE,
  expiry_date DATE,
  certificate_path TEXT,
  notes TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX operator_licences_company_idx ON public.operator_licences(company_id);
CREATE INDEX operator_licences_operator_idx ON public.operator_licences(operator_id);
CREATE INDEX operator_licences_expiry_idx ON public.operator_licences(expiry_date);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.operator_licences TO authenticated;
GRANT ALL ON public.operator_licences TO service_role;

ALTER TABLE public.operator_licences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "operator_licences_select" ON public.operator_licences FOR SELECT TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "operator_licences_insert" ON public.operator_licences FOR INSERT TO authenticated
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "operator_licences_update" ON public.operator_licences FOR UPDATE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id))
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "operator_licences_delete" ON public.operator_licences FOR DELETE TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id));

CREATE TRIGGER operator_licences_set_updated_at BEFORE UPDATE ON public.operator_licences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
