
-- ============================================================
-- Mission Control Centre — secure schema + RPCs
-- ============================================================

-- ---------- platform_sessions (presence) ----------
CREATE TABLE IF NOT EXISTS public.platform_sessions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  company_id    uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  role          text,
  current_path  text,
  ip            text,
  country       text,
  city          text,
  user_agent    text,
  device        text,            -- mobile | tablet | desktop
  browser       text,
  os            text,
  started_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT platform_sessions_user_unique UNIQUE (user_id)
);

CREATE INDEX IF NOT EXISTS platform_sessions_last_seen_idx ON public.platform_sessions(last_seen_at DESC);
CREATE INDEX IF NOT EXISTS platform_sessions_company_idx   ON public.platform_sessions(company_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.platform_sessions TO authenticated;
GRANT ALL ON public.platform_sessions TO service_role;

ALTER TABLE public.platform_sessions ENABLE ROW LEVEL SECURITY;

-- Users may upsert/read only their own row
CREATE POLICY "Own session read"   ON public.platform_sessions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Own session insert" ON public.platform_sessions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own session update" ON public.platform_sessions FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Own session delete" ON public.platform_sessions FOR DELETE TO authenticated USING (user_id = auth.uid());
-- Platform admins read all
CREATE POLICY "Platform admins read all sessions" ON public.platform_sessions FOR SELECT TO authenticated USING (public.is_platform_admin());

-- ---------- platform_visitors (anonymous pings) ----------
CREATE TABLE IF NOT EXISTS public.platform_visitors (
  id          bigserial PRIMARY KEY,
  visitor_id  text NOT NULL,             -- anon cookie id (uuid string)
  path        text,
  referrer    text,
  ip          text,
  country     text,
  city        text,
  user_agent  text,
  device      text,
  browser     text,
  os          text,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS platform_visitors_created_idx ON public.platform_visitors(created_at DESC);
CREATE INDEX IF NOT EXISTS platform_visitors_visitor_idx ON public.platform_visitors(visitor_id, created_at DESC);

GRANT SELECT ON public.platform_visitors TO authenticated;
GRANT ALL    ON public.platform_visitors TO service_role;
-- inserts go through SECURITY DEFINER RPC; no direct grant

ALTER TABLE public.platform_visitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Platform admins read visitors" ON public.platform_visitors FOR SELECT TO authenticated USING (public.is_platform_admin());

-- ============================================================
-- Helper: hard gate for every Mission Control RPC
-- ============================================================
CREATE OR REPLACE FUNCTION public.require_platform_admin()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_platform_admin() THEN
    RAISE EXCEPTION 'forbidden: platform admin required' USING ERRCODE = 'insufficient_privilege';
  END IF;
END;
$$;

-- ============================================================
-- Presence: heartbeat (used by signed-in users)
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_session_heartbeat(
  _path text,
  _device text,
  _browser text,
  _os text,
  _user_agent text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  rl  text;
BEGIN
  IF uid IS NULL THEN RETURN; END IF;
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  SELECT role::text INTO rl FROM public.user_roles WHERE user_id = uid LIMIT 1;

  INSERT INTO public.platform_sessions (user_id, company_id, role, current_path, device, browser, os, user_agent, last_seen_at)
  VALUES (uid, cid, rl, left(_path, 200), _device, _browser, _os, left(_user_agent, 500), now())
  ON CONFLICT (user_id) DO UPDATE
    SET company_id = EXCLUDED.company_id,
        role = COALESCE(EXCLUDED.role, public.platform_sessions.role),
        current_path = EXCLUDED.current_path,
        device = EXCLUDED.device,
        browser = EXCLUDED.browser,
        os = EXCLUDED.os,
        user_agent = EXCLUDED.user_agent,
        last_seen_at = now();
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_session_heartbeat(text,text,text,text,text) TO authenticated;

-- Anonymous visitor ping
CREATE OR REPLACE FUNCTION public.platform_record_visit(
  _visitor_id text,
  _path text,
  _referrer text,
  _device text,
  _browser text,
  _os text,
  _user_agent text
) RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF _visitor_id IS NULL OR length(_visitor_id) < 6 THEN RETURN; END IF;
  INSERT INTO public.platform_visitors (visitor_id, path, referrer, device, browser, os, user_agent)
  VALUES (left(_visitor_id, 64), left(_path, 300), left(_referrer, 500), _device, _browser, _os, left(_user_agent, 500));
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_record_visit(text,text,text,text,text,text,text) TO anon, authenticated;

-- ============================================================
-- Business KPIs (single row, fast aggregates)
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_business_kpis()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_platform_admin();
  SELECT jsonb_build_object(
    'companies',                (SELECT count(*) FROM public.companies),
    'operators',                (SELECT count(*) FROM public.operators),
    'admins',                   (SELECT count(DISTINCT user_id) FROM public.user_roles WHERE role::text IN ('admin','manager','super_admin','supervisor')),
    'assets',                   (SELECT count(*) FROM public.assets),
    'trucks',                   (SELECT count(*) FROM public.assets WHERE type::text IN ('truck','prime_mover','dump_truck','water_cart','ute','vehicle','car')),
    'machines',                 (SELECT count(*) FROM public.assets WHERE type::text IN ('excavator','loader','skid_steer','dozer','grader','roller','machinery','generator','compressor','attachment','trailer','other')),
    'prestarts_today',          (SELECT count(*) FROM public.prestart_checks WHERE completed_at >= date_trunc('day', now())),
    'prestarts_week',           (SELECT count(*) FROM public.prestart_checks WHERE completed_at >= date_trunc('week', now())),
    'defects_open',             (SELECT count(*) FROM public.defect_reports WHERE status <> 'resolved'),
    'defects_total',            (SELECT count(*) FROM public.defect_reports),
    'services_overdue',         (SELECT count(*) FROM public.assets WHERE last_service_date IS NOT NULL AND service_interval_days IS NOT NULL AND (last_service_date + (service_interval_days || ' days')::interval) < now()),
    'registrations_expiring',   (SELECT count(*) FROM public.compliance_records WHERE type::text = 'registration' AND expiry_date <= (now() + interval '30 days')::date),
    'licences_expiring',        (SELECT count(*) FROM public.operator_licences WHERE expiry_date IS NOT NULL AND expiry_date <= (now() + interval '30 days')::date),
    'qr_scans_total',           (SELECT count(*) FROM public.audit_log WHERE action = 'qr.scan'),
    'qr_scans_today',           (SELECT count(*) FROM public.audit_log WHERE action = 'qr.scan' AND created_at >= date_trunc('day', now())),
    'operator_logins_today',    (SELECT count(DISTINCT user_id) FROM public.audit_log WHERE action = 'auth.signin' AND created_at >= date_trunc('day', now()) AND user_id IN (SELECT user_id FROM public.user_roles WHERE role::text = 'operator')),
    'visitors_today',           (SELECT count(DISTINCT visitor_id) FROM public.platform_visitors WHERE created_at >= date_trunc('day', now())),
    'visitors_week',            (SELECT count(DISTINCT visitor_id) FROM public.platform_visitors WHERE created_at >= date_trunc('week', now())),
    'visitors_month',           (SELECT count(DISTINCT visitor_id) FROM public.platform_visitors WHERE created_at >= date_trunc('month', now())),
    'contact_enquiries_new',    (SELECT count(*) FROM public.contact_enquiries WHERE status::text = 'new'),
    'contact_enquiries_total',  (SELECT count(*) FROM public.contact_enquiries),
    'tickets_open',             (SELECT count(*) FROM public.tickets WHERE status::text <> 'closed')
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_business_kpis() TO authenticated;

-- ============================================================
-- Subscription stats
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_subscription_stats(_env text DEFAULT 'live')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
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
$$;
GRANT EXECUTE ON FUNCTION public.platform_subscription_stats(text) TO authenticated;

-- ============================================================
-- Company health
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_company_health(_env text DEFAULT 'live')
RETURNS TABLE (
  company_id uuid,
  company_name text,
  created_at timestamptz,
  sub_status text,
  sub_product text,
  sub_period_end timestamptz,
  last_login timestamptz,
  asset_count int,
  operator_count int,
  admin_count int,
  open_defects int,
  services_overdue int,
  reg_expiring int,
  licence_expiring int,
  last_prestart timestamptz,
  compliance_score int
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  SELECT
    c.id,
    c.name,
    c.created_at,
    s.status,
    s.product_id,
    s.current_period_end,
    (SELECT max(al.created_at) FROM public.audit_log al WHERE al.company_id = c.id AND al.action = 'auth.signin'),
    (SELECT count(*)::int FROM public.assets a WHERE a.company_id = c.id),
    (SELECT count(*)::int FROM public.operators o WHERE o.company_id = c.id),
    (SELECT count(DISTINCT ur.user_id)::int FROM public.user_roles ur WHERE ur.company_id = c.id AND ur.role::text IN ('admin','manager','super_admin','supervisor')),
    (SELECT count(*)::int FROM public.defect_reports d WHERE d.company_id = c.id AND d.status <> 'resolved'),
    (SELECT count(*)::int FROM public.assets a WHERE a.company_id = c.id AND a.last_service_date IS NOT NULL AND a.service_interval_days IS NOT NULL AND (a.last_service_date + (a.service_interval_days || ' days')::interval) < now()),
    (SELECT count(*)::int FROM public.compliance_records cr WHERE cr.company_id = c.id AND cr.type::text = 'registration' AND cr.expiry_date <= (now() + interval '30 days')::date),
    (SELECT count(*)::int FROM public.operator_licences ol WHERE ol.company_id = c.id AND ol.expiry_date IS NOT NULL AND ol.expiry_date <= (now() + interval '30 days')::date),
    (SELECT max(p.completed_at) FROM public.prestart_checks p WHERE p.company_id = c.id),
    -- compliance score = 100 - 10*(open defects + expiring) clamped to 0..100
    GREATEST(0, LEAST(100,
      100 - 8 * COALESCE((SELECT count(*) FROM public.defect_reports d WHERE d.company_id = c.id AND d.status <> 'resolved'), 0)::int
          - 5 * COALESCE((SELECT count(*) FROM public.compliance_records cr WHERE cr.company_id = c.id AND cr.expiry_date <= (now() + interval '30 days')::date), 0)::int
          - 5 * COALESCE((SELECT count(*) FROM public.operator_licences ol WHERE ol.company_id = c.id AND ol.expiry_date IS NOT NULL AND ol.expiry_date <= (now() + interval '30 days')::date), 0)::int
    ))::int
  FROM public.companies c
  LEFT JOIN LATERAL (
    SELECT * FROM public.subscriptions s2
    WHERE s2.company_id = c.id AND s2.environment = _env
    ORDER BY CASE s2.status WHEN 'active' THEN 1 WHEN 'trialing' THEN 2 WHEN 'past_due' THEN 3 WHEN 'paused' THEN 4 WHEN 'canceled' THEN 5 ELSE 9 END, s2.created_at DESC
    LIMIT 1
  ) s ON true
  ORDER BY c.created_at DESC;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_company_health(text) TO authenticated;

-- ============================================================
-- Signups time-series
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_signups_timeseries(_days int DEFAULT 30)
RETURNS TABLE (day date, companies int, users int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(date_trunc('day', now()) - ((_days - 1) || ' days')::interval, date_trunc('day', now()), interval '1 day')::date AS d
  )
  SELECT d.d,
    (SELECT count(*)::int FROM public.companies c WHERE date_trunc('day', c.created_at)::date = d.d),
    (SELECT count(*)::int FROM public.profiles p WHERE date_trunc('day', p.created_at)::date = d.d)
  FROM days d
  ORDER BY d.d;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_signups_timeseries(int) TO authenticated;

-- ============================================================
-- Event feed (cross-company)
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_event_feed(_limit int DEFAULT 100)
RETURNS TABLE (
  id text,
  created_at timestamptz,
  action text,
  company_id uuid,
  company_name text,
  user_id uuid,
  user_email text,
  ip text,
  user_agent text,
  metadata jsonb
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  SELECT al.id::text, al.created_at, al.action,
         al.company_id, c.name,
         al.user_id, (SELECT email FROM auth.users u WHERE u.id = al.user_id),
         al.ip, al.user_agent, al.metadata
  FROM public.audit_log al
  LEFT JOIN public.companies c ON c.id = al.company_id
  ORDER BY al.created_at DESC
  LIMIT GREATEST(1, LEAST(_limit, 500));
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_event_feed(int) TO authenticated;

-- ============================================================
-- Live activity (online users right now)
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_live_activity(_window_sec int DEFAULT 90)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_platform_admin();
  SELECT jsonb_build_object(
    'online_total',     (SELECT count(*) FROM public.platform_sessions WHERE last_seen_at > now() - make_interval(secs => _window_sec)),
    'online_operators', (SELECT count(*) FROM public.platform_sessions WHERE last_seen_at > now() - make_interval(secs => _window_sec) AND role = 'operator'),
    'online_admins',    (SELECT count(*) FROM public.platform_sessions WHERE last_seen_at > now() - make_interval(secs => _window_sec) AND role IN ('admin','manager','super_admin','supervisor')),
    'online_companies', (SELECT count(DISTINCT company_id) FROM public.platform_sessions WHERE last_seen_at > now() - make_interval(secs => _window_sec) AND company_id IS NOT NULL),
    'visitors_now',     (SELECT count(DISTINCT visitor_id) FROM public.platform_visitors WHERE created_at > now() - interval '5 minutes'),
    'by_device',        (SELECT jsonb_object_agg(COALESCE(device, 'unknown'), c) FROM (SELECT device, count(*) c FROM public.platform_sessions WHERE last_seen_at > now() - make_interval(secs => _window_sec) GROUP BY device) x),
    'sessions',         COALESCE((
                          SELECT jsonb_agg(jsonb_build_object(
                            'user_id', s.user_id,
                            'email', (SELECT email FROM auth.users WHERE id = s.user_id),
                            'company_id', s.company_id,
                            'company_name', (SELECT name FROM public.companies WHERE id = s.company_id),
                            'role', s.role,
                            'current_path', s.current_path,
                            'device', s.device,
                            'browser', s.browser,
                            'os', s.os,
                            'started_at', s.started_at,
                            'last_seen_at', s.last_seen_at,
                            'duration_sec', EXTRACT(EPOCH FROM (s.last_seen_at - s.started_at))::int
                          ) ORDER BY s.last_seen_at DESC)
                          FROM public.platform_sessions s
                          WHERE s.last_seen_at > now() - make_interval(secs => _window_sec)
                        ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_live_activity(int) TO authenticated;

-- ============================================================
-- Security stats
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_security_stats()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE result jsonb;
BEGIN
  PERFORM public.require_platform_admin();
  SELECT jsonb_build_object(
    'access_denied_24h',  (SELECT count(*) FROM public.audit_log WHERE action = 'platform.access_denied' AND created_at >= now() - interval '24 hours'),
    'signins_24h',        (SELECT count(*) FROM public.audit_log WHERE action = 'auth.signin'           AND created_at >= now() - interval '24 hours'),
    'signouts_24h',       (SELECT count(*) FROM public.audit_log WHERE action = 'auth.signout'          AND created_at >= now() - interval '24 hours'),
    'role_changes_7d',    (SELECT count(*) FROM public.audit_log WHERE action LIKE 'role.%'             AND created_at >= now() - interval '7 days'),
    'multi_ip_users_24h', (
      SELECT count(*) FROM (
        SELECT user_id FROM public.audit_log
        WHERE created_at >= now() - interval '24 hours' AND ip IS NOT NULL
        GROUP BY user_id HAVING count(DISTINCT ip) > 1
      ) x
    ),
    'recent_admin_events', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'action', action, 'created_at', created_at, 'user_id', user_id,
        'ip', ip, 'metadata', metadata
      ) ORDER BY created_at DESC)
      FROM (SELECT * FROM public.audit_log WHERE action IN ('platform.access_denied','platform.viewed','role.change','user.delete') ORDER BY created_at DESC LIMIT 25) y
    ), '[]'::jsonb)
  ) INTO result;
  RETURN result;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_security_stats() TO authenticated;

-- ============================================================
-- Visitors time-series (for charts)
-- ============================================================
CREATE OR REPLACE FUNCTION public.platform_visitors_timeseries(_days int DEFAULT 14)
RETURNS TABLE (day date, visitors int, pageviews int)
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  PERFORM public.require_platform_admin();
  RETURN QUERY
  WITH days AS (
    SELECT generate_series(date_trunc('day', now()) - ((_days - 1) || ' days')::interval, date_trunc('day', now()), interval '1 day')::date AS d
  )
  SELECT d.d,
    (SELECT count(DISTINCT visitor_id)::int FROM public.platform_visitors v WHERE date_trunc('day', v.created_at)::date = d.d),
    (SELECT count(*)::int FROM public.platform_visitors v WHERE date_trunc('day', v.created_at)::date = d.d)
  FROM days d
  ORDER BY d.d;
END;
$$;
GRANT EXECUTE ON FUNCTION public.platform_visitors_timeseries(int) TO authenticated;
