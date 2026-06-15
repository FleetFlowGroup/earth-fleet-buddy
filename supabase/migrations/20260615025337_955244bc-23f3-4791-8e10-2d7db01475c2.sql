
-- 1. Fix asset-photos delete policy to align with upload (use can_edit_company)
DROP POLICY IF EXISTS "Editors delete asset photos" ON storage.objects;
CREATE POLICY "Editors delete asset photos" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'asset-photos'
  AND can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
);

-- 2. Scope email_send_log policies to service_role role only (not public)
DROP POLICY IF EXISTS "Service role can insert send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can read send log" ON public.email_send_log;
DROP POLICY IF EXISTS "Service role can update send log" ON public.email_send_log;

CREATE POLICY "Service role manages send log" ON public.email_send_log
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- 3. reminder_log — add explicit restrictive policy ensuring only service_role can write
CREATE POLICY "Service role manages reminder_log" ON public.reminder_log
FOR ALL TO service_role
USING (true) WITH CHECK (true);

-- Add a restrictive policy blocking authenticated writes (defense in depth)
CREATE POLICY "Block authenticated writes to reminder_log" ON public.reminder_log
AS RESTRICTIVE
FOR INSERT TO authenticated
WITH CHECK (false);

CREATE POLICY "Block authenticated updates to reminder_log" ON public.reminder_log
AS RESTRICTIVE
FOR UPDATE TO authenticated
USING (false);

CREATE POLICY "Block authenticated deletes from reminder_log" ON public.reminder_log
AS RESTRICTIVE
FOR DELETE TO authenticated
USING (false);
