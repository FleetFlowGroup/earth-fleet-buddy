CREATE OR REPLACE FUNCTION public.company_asset_limit(_company_id uuid, _env text DEFAULT 'live'::text)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sub_product text;
  sub_status text;
  sub_period_end timestamptz;
  company_created timestamptz;
  is_demo boolean;
BEGIN
  SELECT abn = 'DEMO-SUMMIT' INTO is_demo FROM public.companies WHERE id = _company_id;
  IF is_demo THEN
    RETURN 999999;
  END IF;

  SELECT product_id, status, current_period_end
    INTO sub_product, sub_status, sub_period_end
  FROM public.subscriptions
  WHERE company_id = _company_id AND environment = _env
  ORDER BY
    CASE status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END,
    created_at DESC
  LIMIT 1;

  IF sub_product IS NOT NULL AND sub_status IN ('active','trialing','past_due')
     AND (sub_period_end IS NULL OR sub_period_end > now()) THEN
    RETURN CASE sub_product
      WHEN 'starter_plan'  THEN 25
      WHEN 'growth_plan'   THEN 75
      WHEN 'pro_plan'      THEN 200
      WHEN 'business_plan' THEN 999999
      ELSE 0
    END;
  END IF;

  IF sub_product IS NOT NULL AND sub_status = 'canceled'
     AND sub_period_end IS NOT NULL AND sub_period_end > now() THEN
    RETURN CASE sub_product
      WHEN 'starter_plan'  THEN 25
      WHEN 'growth_plan'   THEN 75
      WHEN 'pro_plan'      THEN 200
      WHEN 'business_plan' THEN 999999
      ELSE 0
    END;
  END IF;

  SELECT created_at INTO company_created FROM public.companies WHERE id = _company_id;
  IF company_created IS NOT NULL AND company_created > (now() - interval '14 days') THEN
    RETURN 25;
  END IF;

  RETURN 0;
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_billing_state(_company_id uuid, _env text DEFAULT 'live'::text)
RETURNS TABLE(state text, asset_limit integer, trial_ends_at timestamptz, period_end timestamptz, product_id text, status text, cancel_at_period_end boolean)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  sub_row public.subscriptions%ROWTYPE;
  is_demo boolean;
BEGIN
  SELECT abn = 'DEMO-SUMMIT' INTO is_demo FROM public.companies WHERE id = _company_id;
  IF is_demo THEN
    state := 'subscribed';
    product_id := 'business_plan';
    status := 'active';
    period_end := now() + interval '10 years';
    cancel_at_period_end := false;
    trial_ends_at := NULL;
    asset_limit := 999999;
    RETURN NEXT;
    RETURN;
  END IF;

  SELECT s.* INTO sub_row FROM public.subscriptions s
  WHERE s.company_id = _company_id AND s.environment = _env
  ORDER BY
    CASE s.status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END,
    s.created_at DESC
  LIMIT 1;

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

CREATE OR REPLACE FUNCTION public.platform_owner_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_now timestamptz := now();
  v_30d timestamptz := now() - interval '30 days';
  v_visits_30d bigint;
  v_unique_visitors_30d bigint;
  v_demo_visits_30d bigint;
  v_trials bigint;
  v_paid bigint;
  v_canceled bigint;
  v_past_due bigint;
  v_mrr numeric;
  v_total_customers bigint;
  v_active_users_24h bigint;
  v_inactive_customers jsonb;
  v_failed_payments jsonb;
  v_new_enquiries jsonb;
  v_growth jsonb;
  v_media_count bigint;
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'not authorized';
  END IF;

  SELECT count(*), count(DISTINCT visitor_id) INTO v_visits_30d, v_unique_visitors_30d
    FROM public.platform_visitors WHERE created_at >= v_30d;

  SELECT count(*) INTO v_demo_visits_30d
    FROM public.platform_visitors
    WHERE created_at >= v_30d AND (path ILIKE '%/demo%' OR path ILIKE '%/pricing%' OR path ILIKE '%/contact%');

  SELECT count(*) FILTER (WHERE status = 'trialing'),
         count(*) FILTER (WHERE status = 'active'),
         count(*) FILTER (WHERE status = 'canceled'),
         count(*) FILTER (WHERE status = 'past_due')
    INTO v_trials, v_paid, v_canceled, v_past_due
    FROM public.subscriptions WHERE environment = 'live';

  SELECT COALESCE(SUM(
    CASE product_id
      WHEN 'starter_plan'  THEN 49
      WHEN 'growth_plan'   THEN 99
      WHEN 'pro_plan'      THEN 199
      WHEN 'business_plan' THEN 299
      ELSE 0
    END), 0)
  INTO v_mrr
  FROM public.subscriptions
  WHERE environment = 'live' AND status IN ('active','trialing','past_due');

  SELECT count(DISTINCT company_id) INTO v_total_customers
    FROM public.subscriptions
    WHERE environment = 'live' AND status IN ('active','trialing','past_due');

  SELECT count(DISTINCT user_id) INTO v_active_users_24h
    FROM public.audit_log
    WHERE created_at >= v_now - interval '24 hours' AND user_id IS NOT NULL;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_inactive_customers
  FROM (
    SELECT c.id, c.name,
      (SELECT max(al.created_at) FROM public.audit_log al
        WHERE al.company_id = c.id AND al.action = 'auth.signin') AS last_login,
      s.status AS sub_status, s.product_id
    FROM public.companies c
    LEFT JOIN LATERAL (
      SELECT status, product_id FROM public.subscriptions
      WHERE company_id = c.id AND environment = 'live'
      ORDER BY created_at DESC LIMIT 1
    ) s ON TRUE
    WHERE c.abn IS DISTINCT FROM 'DEMO-SUMMIT'
      AND (
        (SELECT max(al.created_at) FROM public.audit_log al
          WHERE al.company_id = c.id AND al.action = 'auth.signin') < v_now - interval '14 days'
        OR
        NOT EXISTS (SELECT 1 FROM public.audit_log al
          WHERE al.company_id = c.id AND al.action = 'auth.signin')
      )
    ORDER BY last_login NULLS FIRST
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_failed_payments
  FROM (
    SELECT s.id, s.company_id, c.name AS company_name, s.status, s.product_id, s.current_period_end, s.updated_at
    FROM public.subscriptions s
    LEFT JOIN public.companies c ON c.id = s.company_id
    WHERE s.environment = 'live' AND s.status IN ('past_due','paused')
    ORDER BY s.updated_at DESC
    LIMIT 20
  ) t;

  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO v_new_enquiries
  FROM (
    SELECT id, name, email, company_name, phone, message, created_at, status
    FROM public.contact_enquiries
    WHERE status::text = 'new'
    ORDER BY created_at DESC
    LIMIT 20
  ) t;

  SELECT jsonb_agg(row_to_json(d) ORDER BY d.day) INTO v_growth FROM (
    SELECT g.day::date AS day,
      (SELECT count(*) FROM public.companies c WHERE date_trunc('day', c.created_at)::date = g.day) AS customers,
      (SELECT count(*) FROM public.subscriptions s WHERE date_trunc('day', s.created_at)::date = g.day AND s.environment='live' AND s.status IN ('active','trialing')) AS paid,
      (SELECT COALESCE(SUM(CASE s.product_id WHEN 'starter_plan' THEN 49 WHEN 'growth_plan' THEN 99 WHEN 'pro_plan' THEN 199 WHEN 'business_plan' THEN 299 ELSE 0 END),0)
        FROM public.subscriptions s
        WHERE s.environment='live' AND s.status IN ('active','trialing','past_due')
          AND date_trunc('day', s.created_at)::date <= g.day) AS mrr,
      (SELECT count(DISTINCT visitor_id) FROM public.platform_visitors v WHERE date_trunc('day', v.created_at)::date = g.day) AS visitors,
      (SELECT count(*) FROM public.prestart_checks p WHERE date_trunc('day', p.completed_at)::date = g.day) AS prestarts
    FROM generate_series(date_trunc('day', v_now) - interval '29 days', date_trunc('day', v_now), interval '1 day') AS g(day)
  ) d;

  SELECT
    (SELECT count(*) FROM public.asset_photos)
    + (SELECT count(*) FROM public.defect_photos)
    INTO v_media_count;

  RETURN jsonb_build_object(
    'now', v_now,
    'visits_30d', v_visits_30d,
    'unique_visitors_30d', v_unique_visitors_30d,
    'demo_visits_30d', v_demo_visits_30d,
    'trials', v_trials,
    'paid', v_paid,
    'canceled', v_canceled,
    'past_due', v_past_due,
    'mrr', v_mrr,
    'arr', v_mrr * 12,
    'total_customers', v_total_customers,
    'active_users_24h', v_active_users_24h,
    'inactive_customers', v_inactive_customers,
    'failed_payments', v_failed_payments,
    'new_enquiries', v_new_enquiries,
    'growth', COALESCE(v_growth, '[]'::jsonb),
    'media_count', v_media_count
  );
END;
$function$;