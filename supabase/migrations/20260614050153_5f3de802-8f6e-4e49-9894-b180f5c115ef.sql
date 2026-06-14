
-- 1. Subscriptions table (one active row per company; history preserved)
CREATE TABLE public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  paddle_subscription_id text NOT NULL UNIQUE,
  paddle_customer_id text NOT NULL,
  product_id text NOT NULL,         -- human-readable: starter_plan / growth_plan / pro_plan / business_plan
  price_id text NOT NULL,           -- human-readable: starter_monthly / ...
  status text NOT NULL DEFAULT 'active',  -- active | trialing | past_due | paused | canceled
  current_period_start timestamptz,
  current_period_end timestamptz,
  cancel_at_period_end boolean DEFAULT false,
  environment text NOT NULL DEFAULT 'sandbox',  -- sandbox | live
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_subscriptions_company_id ON public.subscriptions(company_id);
CREATE INDEX idx_subscriptions_paddle_id ON public.subscriptions(paddle_subscription_id);

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view own company subscription"
  ON public.subscriptions FOR SELECT
  TO authenticated
  USING (public.is_company_member(auth.uid(), company_id));

CREATE POLICY "Service role manages subscriptions"
  ON public.subscriptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER subscriptions_set_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 2. Asset limit helper. Returns the cap that applies right now for a company.
CREATE OR REPLACE FUNCTION public.company_asset_limit(_company_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_product text;
  sub_status text;
  sub_period_end timestamptz;
  company_created timestamptz;
  env text := COALESCE(current_setting('app.payments_env', true), 'sandbox');
BEGIN
  -- Pick the most relevant subscription row for this company in the current env.
  SELECT product_id, status, current_period_end
    INTO sub_product, sub_status, sub_period_end
  FROM public.subscriptions
  WHERE company_id = _company_id
  ORDER BY
    CASE status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END,
    created_at DESC
  LIMIT 1;

  IF sub_product IS NOT NULL AND sub_status IN ('active','trialing','past_due')
     AND (sub_period_end IS NULL OR sub_period_end > now()) THEN
    RETURN CASE sub_product
      WHEN 'starter_plan'  THEN 10
      WHEN 'growth_plan'   THEN 25
      WHEN 'pro_plan'      THEN 50
      WHEN 'business_plan' THEN 100
      ELSE 0
    END;
  END IF;

  -- Canceled with remaining grace period
  IF sub_product IS NOT NULL AND sub_status = 'canceled'
     AND sub_period_end IS NOT NULL AND sub_period_end > now() THEN
    RETURN CASE sub_product
      WHEN 'starter_plan'  THEN 10
      WHEN 'growth_plan'   THEN 25
      WHEN 'pro_plan'      THEN 50
      WHEN 'business_plan' THEN 100
      ELSE 0
    END;
  END IF;

  -- No active subscription -> 14-day trial from company creation, 10 assets.
  SELECT created_at INTO company_created FROM public.companies WHERE id = _company_id;
  IF company_created IS NOT NULL AND company_created > (now() - interval '14 days') THEN
    RETURN 10;
  END IF;

  RETURN 0;
END;
$$;

GRANT EXECUTE ON FUNCTION public.company_asset_limit(uuid) TO authenticated, service_role;

-- 3. Trial-or-plan flag (used by UI to show banner)
CREATE OR REPLACE FUNCTION public.company_billing_state(_company_id uuid)
RETURNS TABLE(state text, asset_limit integer, trial_ends_at timestamptz, period_end timestamptz, product_id text, status text, cancel_at_period_end boolean)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  sub_row public.subscriptions%ROWTYPE;
  company_created timestamptz;
BEGIN
  SELECT * INTO sub_row FROM public.subscriptions
  WHERE company_id = _company_id
  ORDER BY
    CASE status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END,
    created_at DESC
  LIMIT 1;

  SELECT c.created_at INTO company_created FROM public.companies c WHERE c.id = _company_id;

  IF sub_row.id IS NOT NULL AND sub_row.status IN ('active','trialing','past_due')
     AND (sub_row.current_period_end IS NULL OR sub_row.current_period_end > now()) THEN
    state := 'subscribed';
    product_id := sub_row.product_id;
    status := sub_row.status;
    period_end := sub_row.current_period_end;
    cancel_at_period_end := sub_row.cancel_at_period_end;
    trial_ends_at := NULL;
  ELSIF sub_row.id IS NOT NULL AND sub_row.status = 'canceled'
        AND sub_row.current_period_end > now() THEN
    state := 'canceled_grace';
    product_id := sub_row.product_id;
    status := sub_row.status;
    period_end := sub_row.current_period_end;
    cancel_at_period_end := true;
    trial_ends_at := NULL;
  ELSIF company_created IS NOT NULL AND company_created > (now() - interval '14 days') THEN
    state := 'trial';
    product_id := NULL;
    status := NULL;
    period_end := NULL;
    cancel_at_period_end := false;
    trial_ends_at := company_created + interval '14 days';
  ELSE
    state := 'none';
    product_id := NULL;
    status := NULL;
    period_end := NULL;
    cancel_at_period_end := false;
    trial_ends_at := NULL;
  END IF;

  asset_limit := public.company_asset_limit(_company_id);
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.company_billing_state(uuid) TO authenticated, service_role;

-- 4. Asset insert quota trigger. Hard-stops over-quota inserts.
CREATE OR REPLACE FUNCTION public.enforce_asset_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cap integer;
  used integer;
BEGIN
  cap := public.company_asset_limit(NEW.company_id);
  SELECT count(*) INTO used FROM public.assets WHERE company_id = NEW.company_id;
  IF used >= cap THEN
    RAISE EXCEPTION 'asset_quota_exceeded: company % is at its asset limit (% / %). Upgrade the plan to add more.', NEW.company_id, used, cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_asset_quota_before_insert
  BEFORE INSERT ON public.assets
  FOR EACH ROW EXECUTE FUNCTION public.enforce_asset_quota();
