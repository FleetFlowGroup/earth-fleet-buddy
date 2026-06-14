CREATE OR REPLACE FUNCTION public.preview_company_invite(_code text)
RETURNS TABLE(company_name text, role text, invited_email text, invited_name text, status text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  inv public.company_invites%ROWTYPE;
  c_name text;
BEGIN
  SELECT * INTO inv FROM public.company_invites WHERE code = _code;
  IF inv.id IS NULL THEN
    company_name := NULL; role := NULL; invited_email := NULL; invited_name := NULL;
    status := 'invalid';
    RETURN NEXT; RETURN;
  END IF;
  SELECT name INTO c_name FROM public.companies WHERE id = inv.company_id;
  company_name := c_name;
  role := inv.role::text;
  invited_email := inv.email;
  invited_name := inv.invited_name;
  status := CASE
    WHEN inv.revoked_at IS NOT NULL THEN 'revoked'
    WHEN inv.used_at IS NOT NULL THEN 'used'
    WHEN inv.expires_at < now() THEN 'expired'
    ELSE 'active'
  END;
  RETURN NEXT;
END;
$$;

GRANT EXECUTE ON FUNCTION public.preview_company_invite(text) TO anon, authenticated;