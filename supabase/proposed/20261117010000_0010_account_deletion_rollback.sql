-- ROLLBACK for 0010. NOT APPLIED. Do not run unless 0010 was applied manually
-- and must be removed. Restores the demo write guards to their previous bodies.
BEGIN;

DROP FUNCTION IF EXISTS public.delete_own_account(text, text);
DROP FUNCTION IF EXISTS public.preview_own_account_deletion();
DROP FUNCTION IF EXISTS public._null_auth_user_references(uuid);
DROP FUNCTION IF EXISTS public.account_company_billing(uuid);

CREATE OR REPLACE FUNCTION public.block_demo_company_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_id uuid;
  v_is_demo boolean;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  v_company_id := COALESCE(
    (CASE WHEN TG_OP <> 'DELETE' THEN NEW.company_id END),
    (CASE WHEN TG_OP <> 'INSERT' THEN OLD.company_id END)
  );
  IF v_company_id IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT (abn = 'DEMO-SUMMIT') INTO v_is_demo
  FROM public.companies WHERE id = v_company_id;

  IF COALESCE(v_is_demo, false) THEN
    RAISE EXCEPTION 'demo_read_only: The demo account is read-only. Sign up to manage your own fleet.'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE OR REPLACE FUNCTION public.block_demo_company_self_writes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN COALESCE(NEW, OLD);
  END IF;
  IF (TG_OP <> 'INSERT' AND OLD.abn = 'DEMO-SUMMIT')
     OR (TG_OP <> 'DELETE' AND NEW.abn = 'DEMO-SUMMIT') THEN
    RAISE EXCEPTION 'demo_read_only: The demo company settings cannot be changed.'
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

COMMIT;
