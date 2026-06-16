
-- Generic guard: blocks writes when the row belongs to the demo company.
-- Bypassed for the service role (used by the demo seeder and admin client).
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

-- Guard for the companies table itself (no company_id column).
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

-- Assets: block add + delete on the demo company (updates still allowed for exploration).
DROP TRIGGER IF EXISTS trg_block_demo_assets_ins ON public.assets;
CREATE TRIGGER trg_block_demo_assets_ins
  BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_writes();

DROP TRIGGER IF EXISTS trg_block_demo_assets_del ON public.assets;
CREATE TRIGGER trg_block_demo_assets_del
  BEFORE DELETE ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_writes();

-- Company settings (name, ABN, etc.)
DROP TRIGGER IF EXISTS trg_block_demo_company_self ON public.companies;
CREATE TRIGGER trg_block_demo_company_self
  BEFORE UPDATE OR DELETE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_self_writes();

-- Prestart checklist template
DROP TRIGGER IF EXISTS trg_block_demo_prestart_template ON public.prestart_template_items;
CREATE TRIGGER trg_block_demo_prestart_template
  BEFORE INSERT OR UPDATE OR DELETE ON public.prestart_template_items
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_writes();

-- Team / roles / invites (security & access management)
DROP TRIGGER IF EXISTS trg_block_demo_user_roles ON public.user_roles;
CREATE TRIGGER trg_block_demo_user_roles
  BEFORE INSERT OR UPDATE OR DELETE ON public.user_roles
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_writes();

DROP TRIGGER IF EXISTS trg_block_demo_invites ON public.company_invites;
CREATE TRIGGER trg_block_demo_invites
  BEFORE INSERT OR UPDATE OR DELETE ON public.company_invites
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_writes();

-- Subscriptions / billing
DROP TRIGGER IF EXISTS trg_block_demo_subscriptions ON public.subscriptions;
CREATE TRIGGER trg_block_demo_subscriptions
  BEFORE INSERT OR UPDATE OR DELETE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.block_demo_company_writes();
