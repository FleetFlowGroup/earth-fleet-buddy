
-- Create both tables first (no cross-referencing policies yet)
CREATE TABLE public.tickets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_path TEXT NOT NULL,
  file_type TEXT,
  file_size BIGINT,
  uploaded_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX tickets_company_idx ON public.tickets(company_id);

CREATE TABLE public.ticket_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  operator_id UUID NOT NULL REFERENCES public.operators(id) ON DELETE CASCADE,
  assigned_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ticket_id, operator_id)
);
CREATE INDEX ticket_assignments_ticket_idx ON public.ticket_assignments(ticket_id);
CREATE INDEX ticket_assignments_operator_idx ON public.ticket_assignments(operator_id);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tickets TO authenticated;
GRANT ALL ON public.tickets TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ticket_assignments TO authenticated;
GRANT ALL ON public.ticket_assignments TO service_role;

-- Enable RLS
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_assignments ENABLE ROW LEVEL SECURITY;

-- Tickets policies
CREATE POLICY "tickets_admin_all" ON public.tickets
  FOR ALL TO authenticated
  USING (public.can_edit_company(auth.uid(), company_id))
  WITH CHECK (public.can_edit_company(auth.uid(), company_id));

CREATE POLICY "tickets_operator_select" ON public.tickets
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.ticket_assignments ta
    JOIN public.operators o ON o.id = ta.operator_id
    WHERE ta.ticket_id = tickets.id
      AND o.user_id = auth.uid()
  ));

CREATE TRIGGER tickets_set_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Assignment policies
CREATE POLICY "ticket_assignments_admin_all" ON public.ticket_assignments
  FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_assignments.ticket_id
      AND public.can_edit_company(auth.uid(), t.company_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_assignments.ticket_id
      AND public.can_edit_company(auth.uid(), t.company_id)
  ));

CREATE POLICY "ticket_assignments_operator_select" ON public.ticket_assignments
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.operators o
    WHERE o.id = ticket_assignments.operator_id
      AND o.user_id = auth.uid()
  ));

-- Storage policies (reuse asset-photos bucket under "{company_id}/tickets/...")
CREATE POLICY "tickets_storage_admin_all" ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[2] = 'tickets'
    AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
  )
  WITH CHECK (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[2] = 'tickets'
    AND public.can_edit_company(auth.uid(), ((storage.foldername(name))[1])::uuid)
  );

CREATE POLICY "tickets_storage_operator_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'asset-photos'
    AND (storage.foldername(name))[2] = 'tickets'
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      JOIN public.ticket_assignments ta ON ta.ticket_id = t.id
      JOIN public.operators o ON o.id = ta.operator_id
      WHERE o.user_id = auth.uid()
        AND t.file_path = storage.objects.name
    )
  );

-- Reminder log dedupe
CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_compliance_unique_idx
  ON public.reminder_log (compliance_id, days_before, recipient_email)
  WHERE compliance_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_licence_unique_idx
  ON public.reminder_log (operator_licence_id, days_before, recipient_email)
  WHERE operator_licence_id IS NOT NULL;
