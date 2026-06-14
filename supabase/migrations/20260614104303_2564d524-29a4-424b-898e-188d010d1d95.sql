
-- 1) One role per user per company
ALTER TABLE public.user_roles
  DROP CONSTRAINT IF EXISTS user_roles_user_id_company_id_role_key;

ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_user_company_unique UNIQUE (user_id, company_id);

-- 2) Auto-bind a brand new auth user to any pending invite for their email
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  inv public.company_invites%ROWTYPE;
  email_lc text := lower(NEW.email);
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'))
  ON CONFLICT (id) DO NOTHING;

  -- Pick the most recent active invite for this email, if any
  SELECT * INTO inv
  FROM public.company_invites
  WHERE email = email_lc
    AND used_at IS NULL
    AND revoked_at IS NULL
    AND expires_at > now()
  ORDER BY created_at DESC
  LIMIT 1;

  IF inv.id IS NOT NULL THEN
    -- Bind role (replace any existing — defensive)
    DELETE FROM public.user_roles WHERE user_id = NEW.id AND company_id = inv.company_id;
    INSERT INTO public.user_roles (user_id, company_id, role)
    VALUES (NEW.id, inv.company_id, inv.role);

    UPDATE public.profiles SET company_id = inv.company_id
      WHERE id = NEW.id AND company_id IS NULL;

    UPDATE public.company_invites
      SET used_at = now(), used_by = NEW.id
      WHERE id = inv.id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Ensure trigger exists on auth.users
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3) Tighten invite acceptance: replace, never stack; respect 1-role-per-company
CREATE OR REPLACE FUNCTION public.accept_company_invite(_code text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  inv public.company_invites%ROWTYPE;
  user_email text;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO inv FROM public.company_invites WHERE code = _code;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked'; END IF;
  IF inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'invite_used'; END IF;
  IF inv.expires_at < now() THEN RAISE EXCEPTION 'invite_expired'; END IF;

  IF inv.email IS NOT NULL THEN
    SELECT lower(email) INTO user_email FROM public.profiles WHERE id = uid;
    IF user_email IS DISTINCT FROM inv.email THEN
      RAISE EXCEPTION 'invite_email_mismatch';
    END IF;
  END IF;

  DELETE FROM public.user_roles WHERE user_id = uid AND company_id = inv.company_id;
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (uid, inv.company_id, inv.role);

  UPDATE public.profiles
    SET company_id = inv.company_id
    WHERE id = uid AND company_id IS NULL;

  UPDATE public.company_invites
    SET used_at = now(), used_by = uid
    WHERE id = inv.id;

  RETURN inv.company_id;
END;
$function$;

-- 4) Prevent a company admin from elevating an operator: update_member_role
--    blocks changing AWAY from 'operator' so an invited operator stays operator.
CREATE OR REPLACE FUNCTION public.update_member_role(_user_id uuid, _company_id uuid, _new_role app_role)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  uid uuid := auth.uid();
  existing app_role;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.can_edit_company(uid, _company_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _user_id = uid THEN RAISE EXCEPTION 'cannot_change_own_role'; END IF;

  SELECT role INTO existing FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
    LIMIT 1;

  -- Operator role is permanent: once an operator, always an operator (for this company).
  IF existing = 'operator' AND _new_role <> 'operator' THEN
    RAISE EXCEPTION 'operator_role_is_permanent';
  END IF;

  -- Cannot promote anyone TO operator either (operators must come from an invite).
  IF _new_role = 'operator' AND (existing IS NULL OR existing <> 'operator') THEN
    RAISE EXCEPTION 'operator_role_must_come_from_invite';
  END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id;
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (_user_id, _company_id, _new_role);
END;
$function$;
