
-- 1. Grants on subscriptions
GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- 2. Environment-aware billing state
CREATE OR REPLACE FUNCTION public.company_billing_state(_company_id uuid, _env text DEFAULT 'live')
 RETURNS TABLE(state text, asset_limit integer, trial_ends_at timestamp with time zone, period_end timestamp with time zone, product_id text, status text, cancel_at_period_end boolean)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  sub_row public.subscriptions%ROWTYPE;
  company_created timestamptz;
BEGIN
  SELECT * INTO sub_row FROM public.subscriptions
  WHERE company_id = _company_id AND environment = _env
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

  asset_limit := public.company_asset_limit(_company_id, _env);
  RETURN NEXT;
END;
$function$;

CREATE OR REPLACE FUNCTION public.company_asset_limit(_company_id uuid, _env text DEFAULT 'live')
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
BEGIN
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
      WHEN 'starter_plan'  THEN 10
      WHEN 'growth_plan'   THEN 25
      WHEN 'pro_plan'      THEN 50
      WHEN 'business_plan' THEN 100
      ELSE 0
    END;
  END IF;

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

  SELECT created_at INTO company_created FROM public.companies WHERE id = _company_id;
  IF company_created IS NOT NULL AND company_created > (now() - interval '14 days') THEN
    RETURN 10;
  END IF;

  RETURN 0;
END;
$function$;

-- Keep legacy single-arg signature working for any caller (enforce_asset_quota trigger calls it)
CREATE OR REPLACE FUNCTION public.company_asset_limit(_company_id uuid)
 RETURNS integer
 LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT public.company_asset_limit(_company_id, 'live') $$;

-- 3. Operator-permanence escalation guard
CREATE OR REPLACE FUNCTION public.accept_company_invite(_code text)
 RETURNS uuid
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  inv public.company_invites%ROWTYPE;
  user_email text;
  is_existing_operator boolean;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  SELECT * INTO inv FROM public.company_invites WHERE code = _code;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked'; END IF;
  IF inv.used_at IS NOT NULL AND inv.used_by IS DISTINCT FROM uid THEN RAISE EXCEPTION 'invite_used'; END IF;
  IF inv.used_at IS NULL AND inv.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;

  SELECT lower(COALESCE(u.email, p.email)) INTO user_email
  FROM auth.users u
  LEFT JOIN public.profiles p ON p.id = u.id
  WHERE u.id = uid;

  IF inv.email IS NOT NULL AND user_email IS DISTINCT FROM lower(inv.email) THEN
    RAISE EXCEPTION 'invite_email_mismatch';
  END IF;

  -- Operator role is permanent: if this user is an operator anywhere, refuse to grant any other role.
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = uid AND role = 'operator') INTO is_existing_operator;
  IF is_existing_operator AND inv.role <> 'operator' THEN
    RAISE EXCEPTION 'operator_role_is_permanent';
  END IF;

  INSERT INTO public.profiles (id, email, full_name, company_id)
  SELECT uid, COALESCE(u.email, inv.email), COALESCE(u.raw_user_meta_data->>'full_name', u.raw_user_meta_data->>'name'), inv.company_id
  FROM auth.users u
  WHERE u.id = uid
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        company_id = inv.company_id,
        updated_at = now();

  IF inv.role = 'operator' THEN
    DELETE FROM public.user_roles WHERE user_id = uid AND role <> 'operator';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = uid AND company_id = inv.company_id;
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (uid, inv.company_id, inv.role);

  UPDATE public.company_invites
    SET used_at = COALESCE(used_at, now()), used_by = uid
    WHERE id = inv.id;

  RETURN inv.company_id;
END;
$function$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  inv public.company_invites%ROWTYPE;
  email_lc text := lower(NEW.email);
  is_existing_operator boolean;
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        full_name = COALESCE(public.profiles.full_name, EXCLUDED.full_name),
        updated_at = now();

  SELECT * INTO inv
  FROM public.company_invites
  WHERE email = email_lc
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.id IS NOT NULL THEN
    SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = NEW.id AND role = 'operator') INTO is_existing_operator;
    -- If user is already an operator anywhere, only accept operator invites
    IF is_existing_operator AND inv.role <> 'operator' THEN
      RETURN NEW;
    END IF;

    IF inv.role = 'operator' THEN
      DELETE FROM public.user_roles WHERE user_id = NEW.id AND role <> 'operator';
    END IF;

    DELETE FROM public.user_roles WHERE user_id = NEW.id AND company_id = inv.company_id;
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (NEW.id, inv.company_id, inv.role);

    UPDATE public.profiles
      SET company_id = inv.company_id,
          updated_at = now()
      WHERE id = NEW.id;

    UPDATE public.company_invites
      SET used_at = now(), used_by = NEW.id
      WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$function$;
