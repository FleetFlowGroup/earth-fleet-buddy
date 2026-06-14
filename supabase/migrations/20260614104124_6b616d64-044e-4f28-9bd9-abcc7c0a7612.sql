
-- 1) Make accepting an invite replace existing roles for that user/company
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

  -- Replace any existing roles for this user in this company with the invited role.
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

-- 2) Clean up the stacked admin role for bfairbrother18@gmail.com on smith earthmoving
DELETE FROM public.user_roles
WHERE user_id = '507ed2b6-79c6-4b00-99be-35aef4f03ebb'
  AND company_id = 'd02831b1-5d97-4ac5-80f1-06e47ae960d9'
  AND role = 'admin';
