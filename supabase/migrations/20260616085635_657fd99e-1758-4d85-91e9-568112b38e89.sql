DO $$
DECLARE
  v_key text;
BEGIN
  SELECT decrypted_secret INTO v_key
  FROM vault.decrypted_secrets
  WHERE name = 'email_queue_service_role_key'
  LIMIT 1;

  IF v_key IS NULL THEN
    RAISE EXCEPTION 'email_queue_service_role_key not found in vault';
  END IF;

  PERFORM cron.unschedule('fleetflow-daily-expiry-check');

  PERFORM cron.schedule(
    'fleetflow-daily-expiry-check',
    '0 22 * * *',
    format($job$
      SELECT net.http_post(
        url := 'https://fleetflow.group/api/public/hooks/check-expiries',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'Authorization', 'Bearer %s'
        ),
        body := '{}'::jsonb
      );
    $job$, v_key)
  );
END $$;