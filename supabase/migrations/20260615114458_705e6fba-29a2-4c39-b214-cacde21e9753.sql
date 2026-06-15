-- 1. Fix tickets_operator_select: drop email fallback, use user_id only
DROP POLICY IF EXISTS "tickets_operator_select" ON public.tickets;
CREATE POLICY "tickets_operator_select" ON public.tickets
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.ticket_assignments ta
    JOIN public.operators o ON o.id = ta.operator_id
    WHERE ta.ticket_id = tickets.id
      AND o.user_id = auth.uid()
  )
);

-- 2. Fix compliance-docs storage policies: remove email fallback
DROP POLICY IF EXISTS "Operators upload own ticket docs" ON storage.objects;
CREATE POLICY "Operators upload own ticket docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-docs'
  AND (storage.foldername(name))[1] = 'tickets'
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Operators delete own ticket docs" ON storage.objects;
CREATE POLICY "Operators delete own ticket docs" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND (storage.foldername(name))[1] = 'tickets'
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id::text = (storage.foldername(name))[2]
      AND o.user_id = auth.uid()
  )
);

-- 3. Fix email_send_state: target service_role role directly
DROP POLICY IF EXISTS "Service role can manage send state" ON public.email_send_state;
CREATE POLICY "Service role can manage send state" ON public.email_send_state
FOR ALL TO service_role
USING (true) WITH CHECK (true);
