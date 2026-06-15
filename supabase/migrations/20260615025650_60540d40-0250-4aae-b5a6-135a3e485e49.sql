
CREATE OR REPLACE FUNCTION public.set_active_company(_company_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT public.is_company_member(uid, _company_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  UPDATE public.profiles
    SET company_id = _company_id, updated_at = now()
    WHERE id = uid;
END;
$$;
