-- Rollback for 0009 (PROPOSED, not applied). Restores the pre-0009 function bodies captured
-- read-only from live on 2026-10-29. Refuses to run if Apple rows exist (they would violate
-- the restored NOT NULL Paddle-id columns). Drops billing_events/payments: export them first.
BEGIN;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM public.subscriptions WHERE provider <> 'paddle') THEN
    RAISE EXCEPTION 'rollback refused: non-paddle subscriptions exist';
  END IF;
END $$;
DROP FUNCTION IF EXISTS public.company_has_access(uuid, text);
DROP FUNCTION IF EXISTS public.company_billing_provider(uuid, text);
DROP TABLE IF EXISTS public.payments;
DROP TABLE IF EXISTS public.billing_events;
DROP INDEX IF EXISTS public.subscriptions_apple_otid_env_uq;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_ids_chk;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_chk;
ALTER TABLE public.subscriptions ALTER COLUMN paddle_subscription_id SET NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN paddle_customer_id SET NOT NULL;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS last_event_at, DROP COLUMN IF EXISTS last_event_id,
  DROP COLUMN IF EXISTS store_product_id, DROP COLUMN IF EXISTS store_original_transaction_id,
  DROP COLUMN IF EXISTS provider;
CREATE OR REPLACE FUNCTION public.platform_subscription_stats(_env text DEFAULT 'live'::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  active_count int;
  trial_count int;
  canceled_count int;
  past_due_count int;
  expired_count int;
  mrr numeric := 0;
  per_plan jsonb;
  churn_30d numeric := 0;
  trial_to_paid numeric := 0;
BEGIN
  PERFORM public.require_platform_admin();
  SELECT count(*) FILTER (WHERE status = 'active')                       INTO active_count   FROM public.subscriptions WHERE environment = _env;
  SELECT count(*) FILTER (WHERE status = 'trialing')                     INTO trial_count    FROM public.subscriptions WHERE environment = _env;
  SELECT count(*) FILTER (WHERE status = 'canceled')                     INTO canceled_count FROM public.subscriptions WHERE environment = _env;
  SELECT count(*) FILTER (WHERE status = 'past_due')                     INTO past_due_count FROM public.subscriptions WHERE environment = _env;
  SELECT count(*) FILTER (WHERE status = 'canceled' AND (current_period_end IS NULL OR current_period_end < now())) INTO expired_count FROM public.subscriptions WHERE environment = _env;

  -- MRR — sum plan prices for active/trialing/past_due subs
  SELECT COALESCE(SUM(
    CASE product_id
      WHEN 'starter_plan'  THEN 99
      WHEN 'growth_plan'   THEN 199
      WHEN 'pro_plan'      THEN 299
      WHEN 'business_plan' THEN 499
      ELSE 0
    END), 0)
  INTO mrr
  FROM public.subscriptions
  WHERE environment = _env AND status IN ('active','trialing','past_due');

  -- Per plan counts
  SELECT jsonb_object_agg(product_id, c) INTO per_plan
  FROM (SELECT product_id, count(*) c FROM public.subscriptions WHERE environment = _env AND status IN ('active','trialing','past_due') GROUP BY product_id) p;

  -- Churn last 30d = canceled in 30d / active 30d ago (rough)
  SELECT CASE WHEN active_count > 0 THEN
    (SELECT count(*)::numeric FROM public.subscriptions WHERE environment = _env AND status = 'canceled' AND updated_at >= now() - interval '30 days')
    / NULLIF(active_count, 0) * 100 ELSE 0 END INTO churn_30d;

  RETURN jsonb_build_object(
    'active', active_count,
    'trialing', trial_count,
    'canceled', canceled_count,
    'past_due', past_due_count,
    'expired', expired_count,
    'mrr_aud', mrr,
    'arr_aud', mrr * 12,
    'arpu_aud', CASE WHEN active_count + trial_count > 0 THEN round(mrr / (active_count + trial_count), 2) ELSE 0 END,
    'churn_30d_pct', round(churn_30d, 2),
    'ltv_aud', CASE WHEN churn_30d > 0 THEN round(mrr / (active_count + trial_count) * (100 / churn_30d), 2) ELSE 0 END,
    'per_plan', COALESCE(per_plan, '{}'::jsonb)
  );
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

COMMIT;
