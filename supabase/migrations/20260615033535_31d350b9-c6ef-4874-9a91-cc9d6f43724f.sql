CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
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

    UPDATE public.operators
      SET user_id = NEW.id,
          updated_at = now()
      WHERE company_id = inv.company_id
        AND user_id IS NULL
        AND email IS NOT NULL
        AND lower(email) = email_lc;

    UPDATE public.company_invites
      SET used_at = now(), used_by = NEW.id
      WHERE id = inv.id;
  ELSE
    UPDATE public.operators o
      SET user_id = NEW.id,
          updated_at = now()
    FROM public.profiles p
    WHERE p.id = NEW.id
      AND p.company_id = o.company_id
      AND o.user_id IS NULL
      AND o.email IS NOT NULL
      AND lower(o.email) = email_lc;
  END IF;

  RETURN NEW;
END;
$function$;

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

  UPDATE public.operators
    SET user_id = uid,
        updated_at = now()
    WHERE company_id = inv.company_id
      AND user_id IS NULL
      AND email IS NOT NULL
      AND lower(email) = user_email;

  UPDATE public.company_invites
    SET used_at = COALESCE(used_at, now()), used_by = uid
    WHERE id = inv.id;

  RETURN inv.company_id;
END;
$function$;