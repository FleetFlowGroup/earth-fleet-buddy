
-- Enums
CREATE TYPE public.app_role AS ENUM ('admin', 'manager', 'viewer');
CREATE TYPE public.asset_type AS ENUM ('vehicle', 'machinery', 'trailer', 'other');
CREATE TYPE public.compliance_type AS ENUM ('registration', 'insurance', 'service', 'inspection', 'permit', 'other');

-- Companies
CREATE TABLE public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  abn TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users
);

-- Profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  company_id UUID REFERENCES public.companies ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Roles (separate table, per company)
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, company_id, role)
);

-- Assets
CREATE TABLE public.assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  name TEXT NOT NULL,
  type public.asset_type NOT NULL DEFAULT 'vehicle',
  registration TEXT,
  vin_serial TEXT,
  make TEXT,
  model TEXT,
  year INT,
  odometer INT,
  service_interval_km INT,
  service_interval_days INT,
  last_service_date DATE,
  last_service_odometer INT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_by UUID REFERENCES auth.users
);
CREATE INDEX idx_assets_company ON public.assets(company_id);

-- Compliance dates
CREATE TABLE public.compliance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID NOT NULL REFERENCES public.assets ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  type public.compliance_type NOT NULL,
  label TEXT,
  expiry_date DATE NOT NULL,
  reference TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_compliance_company ON public.compliance_records(company_id);
CREATE INDEX idx_compliance_asset ON public.compliance_records(asset_id);
CREATE INDEX idx_compliance_expiry ON public.compliance_records(expiry_date);

-- Documents
CREATE TABLE public.documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  asset_id UUID REFERENCES public.assets ON DELETE CASCADE,
  company_id UUID NOT NULL REFERENCES public.companies ON DELETE CASCADE,
  name TEXT NOT NULL,
  storage_path TEXT NOT NULL,
  mime_type TEXT,
  size_bytes BIGINT,
  uploaded_by UUID REFERENCES auth.users,
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_documents_asset ON public.documents(asset_id);
CREATE INDEX idx_documents_company ON public.documents(company_id);

-- Notification log
CREATE TABLE public.reminder_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  compliance_id UUID NOT NULL REFERENCES public.compliance_records ON DELETE CASCADE,
  days_before INT NOT NULL,
  recipient_email TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'sent',
  UNIQUE (compliance_id, days_before, recipient_email)
);

-- GRANTS
GRANT SELECT, INSERT, UPDATE, DELETE ON public.companies TO authenticated;
GRANT ALL ON public.companies TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assets TO authenticated;
GRANT ALL ON public.assets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.compliance_records TO authenticated;
GRANT ALL ON public.compliance_records TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.documents TO authenticated;
GRANT ALL ON public.documents TO service_role;
GRANT SELECT ON public.reminder_log TO authenticated;
GRANT ALL ON public.reminder_log TO service_role;

-- Enable RLS
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reminder_log ENABLE ROW LEVEL SECURITY;

-- Security definer helpers
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _company_id UUID, _role public.app_role)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id AND role = _role
  );
$$;

CREATE OR REPLACE FUNCTION public.is_company_member(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
  );
$$;

CREATE OR REPLACE FUNCTION public.can_edit_company(_user_id UUID, _company_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
    AND role IN ('admin','manager')
  );
$$;

-- Policies: profiles
CREATE POLICY "Users read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "Users read company profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    company_id IS NOT NULL AND public.is_company_member(auth.uid(), company_id)
  );
CREATE POLICY "Users update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (id = auth.uid());

-- Policies: companies
CREATE POLICY "Members read company" ON public.companies
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), id));
CREATE POLICY "Anyone can create a company" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid());
CREATE POLICY "Admins update company" ON public.companies
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), id, 'admin'));

-- Policies: user_roles
CREATE POLICY "Users read own roles" ON public.user_roles
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Admins read all company roles" ON public.user_roles
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), company_id, 'admin'));

-- Policies: assets
CREATE POLICY "Members read assets" ON public.assets
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert assets" ON public.assets
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors update assets" ON public.assets
  FOR UPDATE TO authenticated USING (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors delete assets" ON public.assets
  FOR DELETE TO authenticated USING (public.can_edit_company(auth.uid(), company_id));

-- Policies: compliance
CREATE POLICY "Members read compliance" ON public.compliance_records
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert compliance" ON public.compliance_records
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors update compliance" ON public.compliance_records
  FOR UPDATE TO authenticated USING (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors delete compliance" ON public.compliance_records
  FOR DELETE TO authenticated USING (public.can_edit_company(auth.uid(), company_id));

-- Policies: documents
CREATE POLICY "Members read documents" ON public.documents
  FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id));
CREATE POLICY "Editors insert documents" ON public.documents
  FOR INSERT TO authenticated WITH CHECK (public.can_edit_company(auth.uid(), company_id));
CREATE POLICY "Editors delete documents" ON public.documents
  FOR DELETE TO authenticated USING (public.can_edit_company(auth.uid(), company_id));

-- Policies: reminder_log
CREATE POLICY "Members read reminders" ON public.reminder_log
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.compliance_records cr
      WHERE cr.id = compliance_id AND public.is_company_member(auth.uid(), cr.company_id)
    )
  );

-- updated_at triggers
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE TRIGGER set_updated_at_profiles BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_assets BEFORE UPDATE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER set_updated_at_compliance BEFORE UPDATE ON public.compliance_records
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: create company and assign admin role atomically
CREATE OR REPLACE FUNCTION public.create_company_with_admin(_name TEXT, _abn TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  new_company_id UUID;
  uid UUID := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  INSERT INTO public.companies (name, abn, created_by)
  VALUES (_name, _abn, uid)
  RETURNING id INTO new_company_id;

  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (uid, new_company_id, 'admin');

  UPDATE public.profiles SET company_id = new_company_id WHERE id = uid;
  RETURN new_company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_with_admin(TEXT, TEXT) TO authenticated;
