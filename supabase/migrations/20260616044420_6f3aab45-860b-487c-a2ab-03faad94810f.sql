CREATE OR REPLACE FUNCTION public.enforce_asset_quota()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  cap integer;
  used integer;
  is_demo boolean;
BEGIN
  SELECT (abn = 'DEMO-SUMMIT') INTO is_demo FROM public.companies WHERE id = NEW.company_id;
  IF COALESCE(is_demo, false) THEN
    RETURN NEW;
  END IF;

  cap := public.company_asset_limit(NEW.company_id);
  SELECT count(*) INTO used FROM public.assets WHERE company_id = NEW.company_id;
  IF used >= cap THEN
    RAISE EXCEPTION 'asset_quota_exceeded: company % is at its asset limit (% / %). Upgrade the plan to add more.', NEW.company_id, used, cap
      USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$function$;