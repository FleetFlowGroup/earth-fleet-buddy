
-- Invites table
CREATE TABLE public.company_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id uuid NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  code text NOT NULL UNIQUE,
  role public.app_role NOT NULL,
  email text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '30 days'),
  used_at timestamptz,
  used_by uuid,
  revoked_at timestamptz
);

CREATE INDEX company_invites_company_idx ON public.company_invites(company_id);
CREATE INDEX company_invites_code_idx ON public.company_invites(code);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.company_invites TO authenticated;
GRANT ALL ON public.company_invites TO service_role;

ALTER TABLE public.company_invites ENABLE ROW LEVEL SECURITY;

-- Admins/managers can manage invites for their own company
CREATE POLICY "company admins manage invites"
ON public.company_invites
FOR ALL
TO authenticated
USING (public.can_edit_company(auth.uid(), company_id))
WITH CHECK (public.can_edit_company(auth.uid(), company_id));

-- Any signed-in user can read an invite row to preview/accept (code is the secret)
CREATE POLICY "authenticated can read invites by code"
ON public.company_invites
FOR SELECT
TO authenticated
USING (true);

-- Create invite (admins/managers only)
CREATE OR REPLACE FUNCTION public.create_company_invite(_role public.app_role, _email text DEFAULT NULL)
RETURNS TABLE(id uuid, code text)
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
  SELECT company_id INTO cid FROM public.profiles WHERE id = uid;
  IF cid IS NULL THEN RAISE EXCEPTION 'no_company'; END IF;
  IF NOT public.can_edit_company(uid, cid) THEN RAISE EXCEPTION 'not_authorised'; END IF;

  -- 10-char URL-safe code
  new_code := upper(substr(replace(encode(gen_random_bytes(8), 'base64'), '/', ''), 1, 10));
  new_code := replace(replace(new_code, '+', 'X'), '=', 'Y');

  INSERT INTO public.company_invites (company_id, code, role, email, created_by)
  VALUES (cid, new_code, _role, NULLIF(trim(lower(_email)), ''), uid)
  RETURNING company_invites.id INTO new_id;

  id := new_id;
  code := new_code;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_company_invite(public.app_role, text) TO authenticated;

-- Accept invite
CREATE OR REPLACE FUNCTION public.accept_company_invite(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Add role (no-op if already present)
  INSERT INTO public.user_roles (user_id, company_id, role)
  VALUES (uid, inv.company_id, inv.role)
  ON CONFLICT (user_id, company_id, role) DO NOTHING;

  -- Link primary company if none set
  UPDATE public.profiles
    SET company_id = inv.company_id
    WHERE id = uid AND company_id IS NULL;

  UPDATE public.company_invites
    SET used_at = now(), used_by = uid
    WHERE id = inv.id;

  RETURN inv.company_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_company_invite(text) TO authenticated;
