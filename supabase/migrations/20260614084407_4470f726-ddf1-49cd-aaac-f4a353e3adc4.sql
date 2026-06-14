
-- 1. Extend prestart_checks with GPS + admin notes
ALTER TABLE public.prestart_checks
  ADD COLUMN IF NOT EXISTS gps_lat numeric,
  ADD COLUMN IF NOT EXISTS gps_lng numeric,
  ADD COLUMN IF NOT EXISTS gps_accuracy numeric,
  ADD COLUMN IF NOT EXISTS admin_notes text;

-- 2. Audit log table
CREATE TABLE IF NOT EXISTS public.audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid REFERENCES public.companies(id) ON DELETE CASCADE,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip text,
  user_agent text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS audit_log_company_idx ON public.audit_log(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_user_idx ON public.audit_log(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_entity_idx ON public.audit_log(entity_type, entity_id);

GRANT SELECT ON public.audit_log TO authenticated;
GRANT ALL ON public.audit_log TO service_role;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS audit_log_select ON public.audit_log;
CREATE POLICY audit_log_select ON public.audit_log FOR SELECT TO authenticated
  USING (company_id IS NOT NULL AND public.is_office(company_id));

-- No direct INSERT/UPDATE/DELETE for clients; writes go through log_audit().

-- 3. log_audit helper (SECURITY DEFINER so any authenticated user can record their own actions)
CREATE OR REPLACE FUNCTION public.log_audit(
  _company_id uuid,
  _action text,
  _entity_type text DEFAULT NULL,
  _entity_id uuid DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb,
  _user_agent text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RETURN NULL; END IF;
  -- Enforce company membership when a company is provided
  IF _company_id IS NOT NULL AND NOT public.is_company_member(uid, _company_id) THEN
    RETURN NULL;
  END IF;
  INSERT INTO public.audit_log (company_id, user_id, action, entity_type, entity_id, metadata, user_agent)
  VALUES (_company_id, uid, _action, _entity_type, _entity_id, COALESCE(_metadata, '{}'::jsonb), left(_user_agent, 500))
  RETURNING id INTO new_id;
  RETURN new_id;
END;
$$;
