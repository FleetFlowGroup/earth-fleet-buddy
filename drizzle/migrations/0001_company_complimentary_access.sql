CREATE TABLE public.company_complimentary_access (
 company_id uuid PRIMARY KEY REFERENCES public.companies(id) ON DELETE CASCADE,
 product_id text NOT NULL CHECK (product_id IN ('starter_plan','growth_plan','pro_plan','business_plan')),
 granted_at timestamptz NOT NULL DEFAULT now(),
 revoked_at timestamptz
);
GRANT SELECT ON public.company_complimentary_access TO authenticated;
GRANT ALL ON public.company_complimentary_access TO service_role;
ALTER TABLE public.company_complimentary_access ENABLE ROW LEVEL SECURITY;
CREATE POLICY complimentary_member_read ON public.company_complimentary_access FOR SELECT TO authenticated USING (public.is_company_member(auth.uid(), company_id) OR public.is_platform_admin());
CREATE POLICY complimentary_service_manage ON public.company_complimentary_access FOR ALL TO service_role USING (true) WITH CHECK (true);
COMMENT ON TABLE public.company_complimentary_access IS 'Owner-granted non-paying company access until revoked; separate from Paddle subscriptions and revenue.';
CREATE OR REPLACE FUNCTION public.company_asset_limit(_company_id uuid, _env text DEFAULT 'live'::text)
RETURNS integer LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
 sub_product text;
 sub_status text;
 sub_period_end timestamptz;
 company_created timestamptz;
 is_demo boolean;
BEGIN
 SELECT abn = 'DEMO-SUMMIT' INTO is_demo FROM public.companies WHERE id = _company_id;
 IF is_demo THEN RETURN 999999; END IF;
 SELECT ca.product_id INTO sub_product FROM public.company_complimentary_access ca WHERE ca.company_id = _company_id AND ca.revoked_at IS NULL;
 IF sub_product IS NOT NULL THEN
  RETURN CASE sub_product WHEN 'starter_plan' THEN 25 WHEN 'growth_plan' THEN 75 WHEN 'pro_plan' THEN 200 WHEN 'business_plan' THEN 999999 ELSE 0 END;
 END IF;
 SELECT product_id, status, current_period_end INTO sub_product, sub_status, sub_period_end
 FROM public.subscriptions WHERE company_id = _company_id AND environment = _env
 ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END, created_at DESC LIMIT 1;
 IF sub_product IS NOT NULL AND sub_status IN ('active','trialing','past_due') AND (sub_period_end IS NULL OR sub_period_end > now()) THEN
  RETURN CASE sub_product WHEN 'starter_plan' THEN 25 WHEN 'growth_plan' THEN 75 WHEN 'pro_plan' THEN 200 WHEN 'business_plan' THEN 999999 ELSE 0 END;
 END IF;
 IF sub_product IS NOT NULL AND sub_status = 'canceled' AND sub_period_end IS NOT NULL AND sub_period_end > now() THEN
  RETURN CASE sub_product WHEN 'starter_plan' THEN 25 WHEN 'growth_plan' THEN 75 WHEN 'pro_plan' THEN 200 WHEN 'business_plan' THEN 999999 ELSE 0 END;
 END IF;
 SELECT created_at INTO company_created FROM public.companies WHERE id = _company_id;
 IF company_created IS NOT NULL AND company_created > (now() - interval '14 days') THEN RETURN 25; END IF;
 RETURN 0;
END;
$function$;
CREATE OR REPLACE FUNCTION public.company_billing_state(_company_id uuid, _env text DEFAULT 'live'::text)
RETURNS TABLE(state text, asset_limit integer, trial_ends_at timestamptz, period_end timestamptz, product_id text, status text, cancel_at_period_end boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public' AS $function$
DECLARE
 sub_row public.subscriptions%ROWTYPE;
 is_demo boolean;
 free_product text;
BEGIN
 SELECT abn = 'DEMO-SUMMIT' INTO is_demo FROM public.companies WHERE id = _company_id;
 IF is_demo THEN
  state := 'subscribed'; product_id := 'business_plan'; status := 'active'; period_end := now() + interval '10 years'; cancel_at_period_end := false; trial_ends_at := NULL; asset_limit := 999999;
  RETURN NEXT; RETURN;
 END IF;
 SELECT ca.product_id INTO free_product FROM public.company_complimentary_access ca WHERE ca.company_id = _company_id AND ca.revoked_at IS NULL;
 IF free_product IS NOT NULL THEN
  state := 'subscribed'; product_id := free_product; status := 'complimentary'; period_end := NULL; cancel_at_period_end := false; trial_ends_at := NULL; asset_limit := public.company_asset_limit(_company_id, _env);
  RETURN NEXT; RETURN;
 END IF;
 SELECT s.* INTO sub_row FROM public.subscriptions s WHERE s.company_id = _company_id AND s.environment = _env
 ORDER BY CASE s.status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END, s.created_at DESC LIMIT 1;
 IF sub_row.id IS NOT NULL AND sub_row.status IN ('active','trialing','past_due') AND (sub_row.current_period_end IS NULL OR sub_row.current_period_end > now()) THEN
  state := 'subscribed'; product_id := sub_row.product_id; status := sub_row.status; period_end := sub_row.current_period_end; cancel_at_period_end := sub_row.cancel_at_period_end; trial_ends_at := NULL;
 ELSIF sub_row.id IS NOT NULL AND sub_row.status = 'canceled' AND sub_row.current_period_end > now() THEN
  state := 'canceled_grace'; product_id := sub_row.product_id; status := sub_row.status; period_end := sub_row.current_period_end; cancel_at_period_end := true; trial_ends_at := NULL;
 ELSE
  state := 'none'; product_id := NULL; status := NULL; period_end := NULL; cancel_at_period_end := false; trial_ends_at := NULL;
 END IF;
 asset_limit := public.company_asset_limit(_company_id, _env);
 RETURN NEXT;
END;
$function$;