
-- Allow operator to insert a licence row tied to their own operator record
DROP POLICY IF EXISTS operator_licences_self_insert ON public.operator_licences;
CREATE POLICY operator_licences_self_insert ON public.operator_licences
FOR INSERT TO authenticated
WITH CHECK (
  public.is_company_member(auth.uid(), company_id)
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id = operator_licences.operator_id
      AND o.company_id = operator_licences.company_id
      AND (
        o.user_id = auth.uid()
        OR (o.email IS NOT NULL AND lower(o.email) = public.current_user_email())
      )
  )
);

-- Allow operator to update their own licence rows (e.g. add/replace certificate)
DROP POLICY IF EXISTS operator_licences_self_update ON public.operator_licences;
CREATE POLICY operator_licences_self_update ON public.operator_licences
FOR UPDATE TO authenticated
USING (
  public.is_company_member(auth.uid(), company_id)
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id = operator_licences.operator_id
      AND (
        o.user_id = auth.uid()
        OR (o.email IS NOT NULL AND lower(o.email) = public.current_user_email())
      )
  )
)
WITH CHECK (
  public.is_company_member(auth.uid(), company_id)
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id = operator_licences.operator_id
      AND (
        o.user_id = auth.uid()
        OR (o.email IS NOT NULL AND lower(o.email) = public.current_user_email())
      )
  )
);

-- Storage: allow operators to upload/replace/delete their own ticket files under compliance-docs/{company_id}/operators/{operator_id}/...
DROP POLICY IF EXISTS "Operators upload own ticket docs" ON storage.objects;
CREATE POLICY "Operators upload own ticket docs" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'compliance-docs'
  AND (storage.foldername(name))[2] = 'operators'
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id::text = (storage.foldername(name))[3]
      AND o.company_id::text = (storage.foldername(name))[1]
      AND (
        o.user_id = auth.uid()
        OR (o.email IS NOT NULL AND lower(o.email) = public.current_user_email())
      )
  )
);

DROP POLICY IF EXISTS "Operators delete own ticket docs" ON storage.objects;
CREATE POLICY "Operators delete own ticket docs" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'compliance-docs'
  AND (storage.foldername(name))[2] = 'operators'
  AND EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id::text = (storage.foldername(name))[3]
      AND o.company_id::text = (storage.foldername(name))[1]
      AND (
        o.user_id = auth.uid()
        OR (o.email IS NOT NULL AND lower(o.email) = public.current_user_email())
      )
  )
);
