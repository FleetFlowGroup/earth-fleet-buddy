create or replace function public.is_assigned_ticket_operator(_ticket_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.ticket_assignments ta
    join public.operators o on o.id = ta.operator_id
    where ta.ticket_id = _ticket_id and o.user_id = auth.uid()
  );
$$;
revoke execute on function public.is_assigned_ticket_operator(uuid) from public, anon;
grant execute on function public.is_assigned_ticket_operator(uuid) to authenticated;

alter policy tickets_operator_select on public.tickets
  using (public.is_assigned_ticket_operator(id));