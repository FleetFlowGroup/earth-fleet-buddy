-- Allow operators to see tickets assigned to any operator row whose email matches their auth email
DROP POLICY IF EXISTS tickets_operator_select ON public.tickets;
CREATE POLICY tickets_operator_select ON public.tickets
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.ticket_assignments ta
      JOIN public.operators o ON o.id = ta.operator_id
      LEFT JOIN auth.users u ON u.id = auth.uid()
      WHERE ta.ticket_id = tickets.id
        AND (
          o.user_id = auth.uid()
          OR (o.email IS NOT NULL AND u.email IS NOT NULL AND lower(o.email) = lower(u.email))
        )
    )
  );

DROP POLICY IF EXISTS ticket_assignments_operator_select ON public.ticket_assignments;
CREATE POLICY ticket_assignments_operator_select ON public.ticket_assignments
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.operators o
      LEFT JOIN auth.users u ON u.id = auth.uid()
      WHERE o.id = ticket_assignments.operator_id
        AND (
          o.user_id = auth.uid()
          OR (o.email IS NOT NULL AND u.email IS NOT NULL AND lower(o.email) = lower(u.email))
        )
    )
  );