ALTER TABLE public.tickets
  ADD COLUMN IF NOT EXISTS ticket_type text,
  ADD COLUMN IF NOT EXISTS ticket_number text,
  ADD COLUMN IF NOT EXISTS issue_date date,
  ADD COLUMN IF NOT EXISTS expiry_date date,
  ADD COLUMN IF NOT EXISTS notes text;