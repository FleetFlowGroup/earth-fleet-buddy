-- PROPOSED ONLY — NOT APPLIED. Do not place in supabase/migrations or run via tooling
-- until Brody approves and the BILLING_AUDIT_t57 must-fixes 1–5 are done.
-- Purpose: let `subscriptions` hold Paddle OR Apple (via RevenueCat) rows and unify entitlement.
BEGIN;

-- 1. Provider column; Paddle ids become nullable for Apple rows.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paddle'
    CHECK (provider IN ('paddle','apple')),
  ADD COLUMN IF NOT EXISTS store_original_transaction_id text,   -- Apple originalTransactionId
  ADD COLUMN IF NOT EXISTS revenuecat_app_user_id text,           -- = company_id (see plan)
  ADD COLUMN IF NOT EXISTS store_product_id text,                 -- e.g. group.fleetflow.app.starter.monthly
  ADD COLUMN IF NOT EXISTS last_event_id text,
  ADD COLUMN IF NOT EXISTS last_event_at timestamptz;             -- ordering guard (audit fix 4)
ALTER TABLE public.subscriptions ALTER COLUMN paddle_subscription_id DROP NOT NULL;
ALTER TABLE public.subscriptions ALTER COLUMN paddle_customer_id DROP NOT NULL;
ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_provider_ids_chk CHECK (
  (provider = 'paddle' AND paddle_subscription_id IS NOT NULL)
  OR (provider = 'apple' AND store_original_transaction_id IS NOT NULL));
CREATE UNIQUE INDEX IF NOT EXISTS subscriptions_apple_otid_uq
  ON public.subscriptions(store_original_transaction_id) WHERE provider = 'apple';

-- 2. Idempotency log for all billing webhooks (Paddle + RevenueCat). service_role only.
CREATE TABLE IF NOT EXISTS public.billing_events (
  id text PRIMARY KEY,                 -- provider event id
  provider text NOT NULL CHECK (provider IN ('paddle','apple')),
  event_type text NOT NULL,
  occurred_at timestamptz NOT NULL,
  company_id uuid REFERENCES public.companies(id) ON DELETE SET NULL,
  environment text NOT NULL,
  payload jsonb NOT NULL,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;  -- no policies: service_role only
REVOKE ALL ON public.billing_events FROM anon, authenticated;
GRANT ALL ON public.billing_events TO service_role;

-- 3. Store product ↔ plan map (same plan keys as Paddle: starter/growth/pro/business).
CREATE TABLE IF NOT EXISTS public.store_products (
  provider text NOT NULL, store_product_id text NOT NULL,
  plan text NOT NULL CHECK (plan IN ('starter','growth','pro','business')),
  PRIMARY KEY (provider, store_product_id)
);
ALTER TABLE public.store_products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "read store products" ON public.store_products FOR SELECT TO authenticated USING (true);

-- 4. company_billing_state: unchanged signature; its subscription lookup must
--    consider rows of either provider and pick the best active one. A company
--    must not hold two active rows (enforced in the webhook: if a Paddle sub is
--    active, the app hides IAP; if Apple active, web hides Paddle checkout).
--    (Function body to be rewritten against the then-current definition.)
COMMIT;
