
ALTER TABLE public.reminder_log ADD COLUMN IF NOT EXISTS operator_licence_id UUID REFERENCES public.operator_licences(id) ON DELETE CASCADE;
ALTER TABLE public.reminder_log ALTER COLUMN compliance_id DROP NOT NULL;
-- Drop legacy unique constraint if it exists, then add partial uniques
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reminder_log_compliance_id_days_before_recipient_email_key') THEN
    ALTER TABLE public.reminder_log DROP CONSTRAINT reminder_log_compliance_id_days_before_recipient_email_key;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_compliance_unique
  ON public.reminder_log (compliance_id, days_before, recipient_email)
  WHERE compliance_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS reminder_log_operator_licence_unique
  ON public.reminder_log (operator_licence_id, days_before, recipient_email)
  WHERE operator_licence_id IS NOT NULL;
