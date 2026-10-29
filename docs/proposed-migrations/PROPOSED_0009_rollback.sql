-- PROPOSED ONLY — NOT APPLIED. Only valid if no provider='apple' rows exist.
BEGIN;
DROP TABLE IF EXISTS public.store_products;
DROP TABLE IF EXISTS public.billing_events;
DROP INDEX IF EXISTS public.subscriptions_apple_otid_uq;
ALTER TABLE public.subscriptions DROP CONSTRAINT IF EXISTS subscriptions_provider_ids_chk;
ALTER TABLE public.subscriptions ALTER COLUMN paddle_subscription_id SET NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN paddle_customer_id SET NOT NULL;
ALTER TABLE public.subscriptions DROP COLUMN IF EXISTS last_event_at, DROP COLUMN IF EXISTS last_event_id,
  DROP COLUMN IF EXISTS store_product_id, DROP COLUMN IF EXISTS revenuecat_app_user_id,
  DROP COLUMN IF EXISTS store_original_transaction_id, DROP COLUMN IF EXISTS provider;
COMMIT;
