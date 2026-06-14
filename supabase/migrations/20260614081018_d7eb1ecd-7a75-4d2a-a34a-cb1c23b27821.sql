
-- Platform admin helper (single super-admin by email)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT lower(coalesce(auth.jwt() ->> 'email', '')) = 'fleetflow.group@gmail.com';
$$;

-- Enquiry status enum
DO $$ BEGIN
  CREATE TYPE public.contact_enquiry_status AS ENUM ('new','in_progress','completed');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE public.contact_enquiries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  company_name text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL,
  employee_count text NOT NULL,
  machine_count text NOT NULL,
  state text NOT NULL,
  industry text NOT NULL,
  current_system text NOT NULL,
  heard_about text NOT NULL,
  enquiry_type text NOT NULL,
  message text NOT NULL,
  survey_biggest_challenge text,
  survey_time_saving_feature text,
  survey_current_system text,
  survey_wants_demo boolean,
  survey_wants_contact boolean,
  status public.contact_enquiry_status NOT NULL DEFAULT 'new',
  admin_notes text,
  submitter_ip text,
  submitter_user_agent text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT INSERT ON public.contact_enquiries TO anon, authenticated;
GRANT SELECT, UPDATE, DELETE ON public.contact_enquiries TO authenticated;
GRANT ALL ON public.contact_enquiries TO service_role;

ALTER TABLE public.contact_enquiries ENABLE ROW LEVEL SECURITY;

-- Anyone can submit
CREATE POLICY "Anyone can submit a contact enquiry"
  ON public.contact_enquiries FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only the platform admin can read
CREATE POLICY "Platform admin can read enquiries"
  ON public.contact_enquiries FOR SELECT
  TO authenticated
  USING (public.is_platform_admin());

-- Only the platform admin can update (status / notes)
CREATE POLICY "Platform admin can update enquiries"
  ON public.contact_enquiries FOR UPDATE
  TO authenticated
  USING (public.is_platform_admin())
  WITH CHECK (public.is_platform_admin());

-- Only the platform admin can delete
CREATE POLICY "Platform admin can delete enquiries"
  ON public.contact_enquiries FOR DELETE
  TO authenticated
  USING (public.is_platform_admin());

CREATE TRIGGER trg_contact_enquiries_updated_at
BEFORE UPDATE ON public.contact_enquiries
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX contact_enquiries_status_created_idx
  ON public.contact_enquiries (status, created_at DESC);
CREATE INDEX contact_enquiries_email_idx
  ON public.contact_enquiries (lower(email));

-- Rate-limit helper for the public submit route (per-IP, sliding window)
CREATE OR REPLACE FUNCTION public.contact_enquiry_rate_check(_ip text, _window_minutes int, _max int)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT count(*)
    FROM public.contact_enquiries
    WHERE submitter_ip = _ip
      AND created_at > now() - make_interval(mins => _window_minutes)
  ), 0) < _max;
$$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.contact_enquiry_rate_check(text, int, int) TO anon, authenticated, service_role;
