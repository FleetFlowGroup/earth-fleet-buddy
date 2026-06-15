
CREATE TABLE public.app_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('contact','feedback','bug','improvement')),
  subject text NOT NULL CHECK (length(subject) BETWEEN 1 AND 200),
  message text NOT NULL CHECK (length(message) BETWEEN 1 AND 4000),
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','in_progress','resolved')),
  admin_notes text,
  contact_email text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.app_feedback TO authenticated;
GRANT ALL ON public.app_feedback TO service_role;

ALTER TABLE public.app_feedback ENABLE ROW LEVEL SECURITY;

-- Company members can see feedback from their own company
CREATE POLICY "Company members can view their company feedback"
  ON public.app_feedback FOR SELECT
  TO authenticated
  USING (
    public.is_company_member(auth.uid(), company_id)
    OR public.is_platform_admin()
  );

-- Authenticated users can submit feedback for a company they belong to (as themselves)
CREATE POLICY "Members can submit feedback for their company"
  ON public.app_feedback FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = user_id
    AND public.is_company_member(auth.uid(), company_id)
  );

-- Submitters can update their own (e.g. add detail) while still 'new'; platform admins can update anything
CREATE POLICY "Submitters and platform admins can update"
  ON public.app_feedback FOR UPDATE
  TO authenticated
  USING (
    (auth.uid() = user_id AND status = 'new')
    OR public.is_platform_admin()
  )
  WITH CHECK (
    (auth.uid() = user_id AND status = 'new')
    OR public.is_platform_admin()
  );

CREATE TRIGGER app_feedback_set_updated_at
  BEFORE UPDATE ON public.app_feedback
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE INDEX idx_app_feedback_company_created ON public.app_feedback (company_id, created_at DESC);
