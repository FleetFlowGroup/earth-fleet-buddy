DROP FUNCTION IF EXISTS public.create_company_invite(public.app_role, text);

CREATE OR REPLACE FUNCTION public.create_company_invite(_role public.app_role, _email text DEFAULT NULL)
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

  new_code := upper(substr(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), 1, 10));
  new_code := replace(replace(new_code, '+', 'X'), '=', 'Y');

  INSERT INTO public.company_invites (company_id, code, role, email, created_by)
  VALUES (cid, new_code, _role, NULLIF(trim(lower(_email)), ''), uid)
  RETURNING company_invites.id INTO new_id;

  invite_id := new_id;
  invite_code := new_code;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_invite(public.app_role, text) TO authenticated;