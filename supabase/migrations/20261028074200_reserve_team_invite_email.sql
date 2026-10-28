-- APPLIED MANUALLY on 2026-10-28 and verified by the project owner.
-- ARCHIVAL RECORD ONLY: must not be re-executed by tooling.
-- Do not run this file through migration tools, database push, or automatic replay.
-- Records exactly the applied Variant 2 plain indexes, function, and REVOKE/GRANT.
-- Statements are idempotent; outer BEGIN/COMMIT are intentionally omitted.

CREATE INDEX IF NOT EXISTS email_team_invite_company_created_idx
  ON public.email_send_log ((metadata->>'company_id'), created_at)
  WHERE template_name = 'team-invite';
CREATE INDEX IF NOT EXISTS email_team_invite_user_created_idx
  ON public.email_send_log ((metadata->>'user_id'), created_at)
  WHERE template_name = 'team-invite';
CREATE INDEX IF NOT EXISTS email_team_invite_invite_created_idx
  ON public.email_send_log ((metadata->>'invite_id'), created_at)
  WHERE template_name = 'team-invite';

CREATE OR REPLACE FUNCTION public.reserve_team_invite_email(
  _invite_id pg_catalog.uuid,
  _user_id pg_catalog.uuid,
  _company_id pg_catalog.uuid,
  _message_id pg_catalog.text,
  _company_daily_cap pg_catalog.int4,
  _cooldown_minutes pg_catalog.int4 DEFAULT 10
)
RETURNS pg_catalog.text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  _initial_company_id pg_catalog.uuid;
  _invite public.company_invites%ROWTYPE;
  _company_created_at pg_catalog.timestamptz;
  _now pg_catalog.timestamptz;
BEGIN
  IF _invite_id IS NULL OR _user_id IS NULL OR _company_id IS NULL
     OR _message_id IS NULL OR pg_catalog.btrim(_message_id) = '' THEN
    RETURN 'invalid_invite';
  END IF;
  -- Only a trusted server may choose a tier. Never accept these from the browser.
  -- Fix the cooldown at the existing 10-minute rule to prevent bypass parameters.
  IF _company_daily_cap IS NULL OR _company_daily_cap NOT IN (5, 50)
     OR _cooldown_minutes IS DISTINCT FROM 10 THEN
    RETURN 'forbidden';
  END IF;

  -- Plain read FIRST; do not hold a row lock while waiting for advisory locks.
  SELECT ci.company_id INTO _initial_company_id
  FROM public.company_invites AS ci WHERE ci.id = _invite_id;
  IF NOT FOUND OR _initial_company_id IS DISTINCT FROM _company_id THEN
    RETURN 'invalid_invite';
  END IF;

  -- Fixed order: company, then user, then invitation row. Shared user lock
  -- also serialises the hourly user quota across different companies.
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'team-invite:company:' || _initial_company_id::pg_catalog.text, 0));
  PERFORM pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(
    'team-invite:user:' || _user_id::pg_catalog.text, 1));
  SELECT ci.* INTO _invite FROM public.company_invites AS ci
  WHERE ci.id = _invite_id FOR UPDATE;
  IF NOT FOUND OR _invite.company_id IS DISTINCT FROM _initial_company_id THEN
    RETURN 'invalid_invite';
  END IF;
  -- Use wall time AFTER waiting, not the transaction's earlier start time.
  _now := pg_catalog.clock_timestamp();

  IF NOT EXISTS (SELECT 1 FROM auth.users AS u
    WHERE u.id = _user_id AND u.email_confirmed_at IS NOT NULL) THEN
    RETURN 'unverified';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.user_roles AS ur
      WHERE ur.user_id = _user_id AND ur.company_id = _initial_company_id)
     OR public.can_edit_company(_user_id, _initial_company_id) IS DISTINCT FROM TRUE THEN
    RETURN 'forbidden';
  END IF;
  IF _invite.used_at IS NOT NULL OR _invite.revoked_at IS NOT NULL
     OR _invite.expires_at IS NULL OR _invite.expires_at <= _now
     OR _invite.email IS NULL OR pg_catalog.btrim(_invite.email) = '' THEN
    RETURN 'invalid_invite';
  END IF;

  SELECT c.created_at INTO _company_created_at FROM public.companies AS c
  WHERE c.id = _initial_company_id;
  IF NOT FOUND OR _company_created_at IS NULL THEN
    RETURN 'invalid_invite';
  END IF;
  -- Cap 50 is server-derived established/active-paid tier; cap 5 applies
  -- the new-company cooldown even when billing lookup fell back conservatively.
  IF _company_daily_cap = 5 AND
     _company_created_at + _cooldown_minutes * INTERVAL '1 minute' > _now THEN
    RETURN 'cooldown';
  END IF;

  IF (SELECT pg_catalog.count(DISTINCT l.message_id)
    FROM public.email_send_log AS l
    WHERE l.template_name = 'team-invite'
      AND (l.metadata->>'invite_id') = _invite_id::pg_catalog.text
      AND l.created_at >= _now - INTERVAL '1 hour'
      AND l.status <> 'failed') >= 5 THEN
    RETURN 'limit_invite';
  END IF;
  IF (SELECT pg_catalog.count(DISTINCT l.message_id)
    FROM public.email_send_log AS l
    WHERE l.template_name = 'team-invite'
      AND (l.metadata->>'user_id') = _user_id::pg_catalog.text
      AND l.created_at >= _now - INTERVAL '1 hour'
      AND l.status <> 'failed') >= 20 THEN
    RETURN 'limit_user';
  END IF;
  IF (SELECT pg_catalog.count(DISTINCT l.message_id)
    FROM public.email_send_log AS l
    WHERE l.template_name = 'team-invite'
      AND (l.metadata->>'company_id') = _initial_company_id::pg_catalog.text
      AND l.created_at >= _now - INTERVAL '1 day'
      AND l.status <> 'failed') >= _company_daily_cap THEN
    RETURN 'limit_company';
  END IF;

  INSERT INTO public.email_send_log
    (message_id, template_name, recipient_email, status, metadata, created_at)
  VALUES (_message_id, 'team-invite', _invite.email, 'pending',
    pg_catalog.jsonb_build_object('invite_id', _invite_id::pg_catalog.text,
      'user_id', _user_id::pg_catalog.text,
      'company_id', _initial_company_id::pg_catalog.text), _now);
  RETURN 'ok';
END;
$function$;

REVOKE ALL ON FUNCTION public.reserve_team_invite_email(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text,
  pg_catalog.int4, pg_catalog.int4) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_team_invite_email(
  pg_catalog.uuid, pg_catalog.uuid, pg_catalog.uuid, pg_catalog.text,
  pg_catalog.int4, pg_catalog.int4) TO service_role;
