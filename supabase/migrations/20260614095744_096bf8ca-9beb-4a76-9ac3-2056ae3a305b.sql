-- Update the company edit guard to include the new roles
CREATE OR REPLACE FUNCTION public.can_edit_company(_user_id uuid, _company_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND company_id = _company_id
      AND role::text IN ('admin','manager','super_admin','supervisor')
  );
$$;

-- create_company_invite: now accepts name + phone, returns them
CREATE OR REPLACE FUNCTION public.create_company_invite(
  _role public.app_role,
  _email text DEFAULT NULL,
  _name text DEFAULT NULL,
  _phone text DEFAULT NULL
)
RETURNS TABLE(invite_id uuid, invite_code text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  new_code text;
  new_id uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT p.company_id INTO cid FROM public.profiles p WHERE p.id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'no_company'; END IF;
  IF NOT public.can_edit_company(uid, cid) THEN RAISE EXCEPTION 'not_authorised'; END IF;

  new_code := upper(substr(replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 1, 10));

  INSERT INTO public.company_invites (company_id, code, role, email, invited_name, invited_phone, created_by)
  VALUES (cid, new_code, _role, NULLIF(trim(lower(_email)), ''), NULLIF(trim(_name), ''), NULLIF(trim(_phone), ''), uid)
  RETURNING company_invites.id INTO new_id;

  invite_id := new_id;
  invite_code := new_code;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_invite(public.app_role, text, text, text) TO authenticated;

-- Mark an invite as sent (called by email-sending flow)
CREATE OR REPLACE FUNCTION public.mark_invite_email_sent(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT company_id INTO cid FROM public.company_invites WHERE id = _invite_id;
  IF cid IS NULL THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF NOT public.can_edit_company(uid, cid) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  UPDATE public.company_invites SET email_sent_at = now() WHERE id = _invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mark_invite_email_sent(uuid) TO authenticated;

-- Resend: bump expiry on an active invite so the email link is valid again
CREATE OR REPLACE FUNCTION public.resend_company_invite(_invite_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  cid uuid;
  inv public.company_invites%ROWTYPE;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT * INTO inv FROM public.company_invites WHERE id = _invite_id;
  IF inv.id IS NULL THEN RAISE EXCEPTION 'invite_not_found'; END IF;
  IF NOT public.can_edit_company(uid, inv.company_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF inv.used_at IS NOT NULL THEN RAISE EXCEPTION 'invite_used'; END IF;
  IF inv.revoked_at IS NOT NULL THEN RAISE EXCEPTION 'invite_revoked'; END IF;

  UPDATE public.company_invites
    SET expires_at = now() + interval '30 days',
        email_sent_at = now()
    WHERE id = _invite_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.resend_company_invite(uuid) TO authenticated;

-- Change a member's role
CREATE OR REPLACE FUNCTION public.update_member_role(_user_id uuid, _company_id uuid, _new_role public.app_role)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.can_edit_company(uid, _company_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  -- Replace existing role rows for the member with the new role
  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id;
  INSERT INTO public.user_roles (user_id, company_id, role) VALUES (_user_id, _company_id, _new_role);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_member_role(uuid, uuid, public.app_role) TO authenticated;

-- Remove a member from the company
CREATE OR REPLACE FUNCTION public.remove_member(_user_id uuid, _company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.can_edit_company(uid, _company_id) THEN RAISE EXCEPTION 'not_authorised'; END IF;
  IF _user_id = uid THEN RAISE EXCEPTION 'cannot_remove_self'; END IF;

  DELETE FROM public.user_roles WHERE user_id = _user_id AND company_id = _company_id;
  UPDATE public.profiles SET company_id = NULL
    WHERE id = _user_id AND company_id = _company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.remove_member(uuid, uuid) TO authenticated;