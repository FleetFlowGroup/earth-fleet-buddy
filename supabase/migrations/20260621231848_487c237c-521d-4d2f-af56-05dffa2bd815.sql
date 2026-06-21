
CREATE OR REPLACE FUNCTION public.platform_owner_dashboard()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_now timestamptz := now();
  v_30d timestamptz := now() - interval '30 days';
  v_visitors_30d int;
  v_demo_visits_30d int;
  v_trials int;
  v_paid int;
  v_canceled int;
  v_past_due int;
  v_mrr numeric := 0;
  v_total_customers int;
  v_active_users_24h int;
  v_inactive_customers jsonb;
  v_failed_payments jsonb;
  v_new_enquiries jsonb;
  v_growth jsonb;
  v_photos int;
BEGIN
  PERFORM public.require_platform_admin();

  SELECT count(DISTINCT visitor_id) INTO v_visitors_30d
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
      WHEN 'starter_plan'  THEN 99
      WHEN 'growth_plan'   THEN 199
      WHEN 'pro_plan'      THEN 299
      WHEN 'business_plan' THEN 499
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
      (SELECT COALESCE(SUM(CASE s.product_id WHEN 'starter_plan' THEN 99 WHEN 'growth_plan' THEN 199 WHEN 'pro_plan' THEN 299 WHEN 'business_plan' THEN 499 ELSE 0 END),0)
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
    + (SELECT count(*) FROM public.service_photos)
    + (SELECT count(*) FROM public.prestart_photos)
  INTO v_photos;

  RETURN jsonb_build_object(
    'mrr_aud', v_mrr,
    'arr_aud', v_mrr * 12,
    'total_customers', v_total_customers,
    'trials', v_trials,
    'paid', v_paid,
    'canceled', v_canceled,
    'past_due', v_past_due,
    'visitors_30d', v_visitors_30d,
    'demo_visits_30d', v_demo_visits_30d,
    'conversion_visitor_to_trial_pct', CASE WHEN v_visitors_30d > 0 THEN round((v_trials::numeric / v_visitors_30d) * 100, 2) ELSE 0 END,
    'conversion_trial_to_paid_pct', CASE WHEN (v_trials + v_paid) > 0 THEN round((v_paid::numeric / (v_trials + v_paid)) * 100, 2) ELSE 0 END,
    'conversion_demo_to_trial_pct', CASE WHEN v_demo_visits_30d > 0 THEN round((v_trials::numeric / v_demo_visits_30d) * 100, 2) ELSE 0 END,
    'contact_enquiries_total', (SELECT count(*) FROM public.contact_enquiries),
    'contact_enquiries_new', (SELECT count(*) FROM public.contact_enquiries WHERE status::text = 'new'),
    'active_users_24h', v_active_users_24h,
    'total_machines', (SELECT count(*) FROM public.assets),
    'total_operators', (SELECT count(*) FROM public.operators),
    'total_prestarts', (SELECT count(*) FROM public.prestart_checks),
    'qr_scans_total', (SELECT count(*) FROM public.audit_log WHERE action = 'qr.scan'),
    'photos_uploaded', v_photos,
    'funnel', jsonb_build_object(
      'visitors', v_visitors_30d,
      'demo', v_demo_visits_30d,
      'trials', v_trials,
      'paid', v_paid
    ),
    'growth', COALESCE(v_growth, '[]'::jsonb),
    'inactive_customers', v_inactive_customers,
    'failed_payments', v_failed_payments,
    'new_enquiries', v_new_enquiries
  );
END;
$$;
