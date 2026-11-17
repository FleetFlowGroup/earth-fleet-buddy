-- 0010 Account deletion (Apple guideline 5.1.1(v)).
-- STATUS: NOT APPLIED. Do not run this file. Do not copy it into supabase/migrations/
-- until the owner has reviewed it and applies it manually, once.
-- Next number after proposed 0009. It does not change Paddle checkout, plan change,
-- the Paddle portal, or Paddle webhook behaviour.
-- Rollback: 20261117010000_0010_account_deletion_rollback.sql
--
-- The function deletes only auth.uid(). It never accepts another user's id.
-- A sole Company Admin (only admin/super_admin) must pass mode delete_companies,
-- which deletes that company. The shared demo (ABN DEMO-SUMMIT) and platform
-- owner accounts are refused. Apple and Paddle subscriptions are not cancelled.
--
-- Demo write-guards gain a transaction-local bypass used only while this function
-- is deleting the caller's own membership. With the setting unset, those guards
-- behave as they do today.

BEGIN;

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
  -- Set only by delete_own_account, local to that transaction.
  IF current_setting('fleetflow.account_deletion', true) = 'on' THEN
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
  IF current_setting('fleetflow.account_deletion', true) = 'on' THEN
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

-- Billing label for the caller's own companies. Not granted to clients.
CREATE OR REPLACE FUNCTION public.account_company_billing(_company_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  has_provider boolean;
  has_paddle boolean;
  has_apple boolean := false;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'subscriptions' AND column_name = 'provider'
  ) INTO has_provider;

  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions s
    WHERE s.company_id = _company_id
      AND s.paddle_subscription_id IS NOT NULL
      AND (
        (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
        OR (s.status = 'canceled' AND s.current_period_end > now())
      )
  ) INTO has_paddle;

  IF has_provider THEN
    EXECUTE $q$
      SELECT EXISTS (
        SELECT 1 FROM public.subscriptions s
        WHERE s.company_id = $1
          AND s.provider = 'apple'
          AND (
            (s.status IN ('active', 'trialing', 'past_due') AND (s.current_period_end IS NULL OR s.current_period_end > now()))
            OR (s.status = 'canceled' AND s.current_period_end > now())
          )
      )
    $q$ INTO has_apple USING _company_id;
  END IF;

  IF has_paddle AND has_apple THEN RETURN 'both'; END IF;
  IF has_paddle THEN RETURN 'paddle'; END IF;
  IF has_apple THEN RETURN 'apple'; END IF;
  RETURN 'none';
END;
$$;

REVOKE ALL ON FUNCTION public.account_company_billing(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.preview_own_account_deletion()
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  RETURN jsonb_build_object(
    'is_platform_admin', EXISTS (SELECT 1 FROM public.platform_admins p WHERE p.user_id = uid),
    'companies', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'company_id', c.id,
        'name', c.name,
        'is_demo', (c.abn = 'DEMO-SUMMIT'),
        'is_admin', EXISTS (
          SELECT 1 FROM public.user_roles me
          WHERE me.user_id = uid AND me.company_id = c.id AND me.role::text IN ('admin', 'super_admin')
        ),
        'admin_count', (
          SELECT count(DISTINCT ur.user_id)::int FROM public.user_roles ur
          WHERE ur.company_id = c.id AND ur.role::text IN ('admin', 'super_admin')
        ),
        'member_count', (
          SELECT count(DISTINCT ur.user_id)::int FROM public.user_roles ur
          WHERE ur.company_id = c.id
        ),
        'billing', public.account_company_billing(c.id)
      ))
      FROM public.companies c
      WHERE c.id IN (SELECT ur.company_id FROM public.user_roles ur WHERE ur.user_id = uid)
    ), '[]'::jsonb)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.preview_own_account_deletion() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.preview_own_account_deletion() TO authenticated;

-- Null NO ACTION / RESTRICT references to auth.users for this user only.
CREATE OR REPLACE FUNCTION public._null_auth_user_references(_uid uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r record;
BEGIN
  IF _uid IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;
  FOR r IN
    SELECT ns.nspname AS schema_name, cl.relname AS table_name, att.attname AS column_name
    FROM pg_constraint con
    JOIN pg_class cl ON cl.oid = con.conrelid
    JOIN pg_namespace ns ON ns.oid = cl.relnamespace
    JOIN pg_attribute att ON att.attrelid = cl.oid AND att.attnum = con.conkey[1]
    WHERE con.contype = 'f'
      AND con.confrelid = 'auth.users'::regclass
      AND ns.nspname = 'public'
      AND con.confdeltype IN ('a', 'r')
      AND array_length(con.conkey, 1) = 1
  LOOP
    BEGIN
      EXECUTE format(
        'UPDATE %I.%I SET %I = NULL WHERE %I = $1',
        r.schema_name, r.table_name, r.column_name, r.column_name
      ) USING _uid;
    EXCEPTION
      WHEN not_null_violation THEN
        RAISE EXCEPTION 'account_delete_blocked' USING DETAIL = r.table_name || '.' || r.column_name;
    END;
  END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public._null_auth_user_references(uuid) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.delete_own_account(_mode text, _confirmation text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  deleted_companies uuid[] := ARRAY[]::uuid[];
  sole_count int;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF _confirmation IS DISTINCT FROM 'DELETE' THEN RAISE EXCEPTION 'confirmation_required'; END IF;
  IF _mode IS DISTINCT FROM 'leave' AND _mode IS DISTINCT FROM 'delete_companies' THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;
  IF EXISTS (SELECT 1 FROM public.platform_admins WHERE user_id = uid) THEN
    RAISE EXCEPTION 'platform_admin';
  END IF;
  IF EXISTS (
    SELECT 1
    FROM public.user_roles ur
    JOIN public.companies c ON c.id = ur.company_id
    WHERE ur.user_id = uid
      AND ur.role::text IN ('admin', 'super_admin')
      AND c.abn = 'DEMO-SUMMIT'
      AND (
        SELECT count(DISTINCT ur2.user_id) FROM public.user_roles ur2
        WHERE ur2.company_id = c.id AND ur2.role::text IN ('admin', 'super_admin')
      ) <= 1
  ) THEN
    RAISE EXCEPTION 'demo_company';
  END IF;

  SELECT count(*) INTO sole_count FROM (
    SELECT c.id
    FROM public.companies c
    JOIN public.user_roles ur
      ON ur.company_id = c.id AND ur.user_id = uid AND ur.role::text IN ('admin', 'super_admin')
    WHERE c.abn IS DISTINCT FROM 'DEMO-SUMMIT'
      AND (
        SELECT count(DISTINCT ur2.user_id) FROM public.user_roles ur2
        WHERE ur2.company_id = c.id AND ur2.role::text IN ('admin', 'super_admin')
      ) <= 1
    GROUP BY c.id
  ) s;

  IF sole_count > 0 AND _mode IS DISTINCT FROM 'delete_companies' THEN
    RAISE EXCEPTION 'sole_admin';
  END IF;
  IF sole_count = 0 AND _mode = 'delete_companies' THEN
    RAISE EXCEPTION 'invalid_mode';
  END IF;

  -- Lets the caller's own demo membership row be removed. Does not run for a refused demo admin.
  PERFORM set_config('fleetflow.account_deletion', 'on', true);

  IF _mode = 'delete_companies' THEN
    FOR cid IN
      SELECT c.id
      FROM public.companies c
      JOIN public.user_roles ur
        ON ur.company_id = c.id AND ur.user_id = uid AND ur.role::text IN ('admin', 'super_admin')
      WHERE c.abn IS DISTINCT FROM 'DEMO-SUMMIT'
        AND (
          SELECT count(DISTINCT ur2.user_id) FROM public.user_roles ur2
          WHERE ur2.company_id = c.id AND ur2.role::text IN ('admin', 'super_admin')
        ) <= 1
      GROUP BY c.id
    LOOP
      UPDATE public.companies SET created_by = NULL WHERE id = cid AND created_by = uid;
      DELETE FROM public.companies WHERE id = cid;
      deleted_companies := array_append(deleted_companies, cid);
    END LOOP;
  END IF;

  PERFORM public._null_auth_user_references(uid);
  DELETE FROM auth.users WHERE id = uid;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'account_delete_blocked';
  END IF;

  RETURN jsonb_build_object('deleted', true, 'company_ids', to_jsonb(deleted_companies));
END;
$$;

REVOKE ALL ON FUNCTION public.delete_own_account(text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_own_account(text, text) TO authenticated;

COMMENT ON FUNCTION public.delete_own_account(text, text) IS
  'NOT APPLIED until this migration is run manually. Deletes auth.uid() only. Does not cancel Apple or Paddle billing.';

COMMIT;
