create policy "Members upload own prestart signatures"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'asset-photos'
  and (storage.foldername(name))[2] = 'prestarts'
  and (storage.foldername(name))[3] = 'signatures'
  and array_length(storage.foldername(name), 1) = 3
  and owner = auth.uid()
  and is_company_member(auth.uid(), ((storage.foldername(name))[1])::uuid)
  and (
    can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
    or exists (select 1 from public.operators o where o.user_id = auth.uid() and o.company_id = ((storage.foldername(name))[1])::uuid)
  )
);