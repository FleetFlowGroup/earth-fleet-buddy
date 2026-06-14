
CREATE OR REPLACE FUNCTION public.company_billing_state(_company_id uuid, _env text DEFAULT 'live'::text)
 RETURNS TABLE(state text, asset_limit integer, trial_ends_at timestamp with time zone, period_end timestamp with time zone, product_id text, status text, cancel_at_period_end boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sub_row public.subscriptions%ROWTYPE;
  company_created timestamptz;
BEGIN
  SELECT s.* INTO sub_row FROM public.subscriptions s
  WHERE s.company_id = _company_id AND s.environment = _env
  ORDER BY
    CASE s.status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END,
    s.created_at DESC
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

  asset_limit := public.company_asset_limit(_company_id, _env);
  RETURN NEXT;
END;
$function$;
