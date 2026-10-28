-- Read-only live regression checks. All rows must return passed=true.
-- No customer session, messages, or test records are created.
WITH target AS (
 SELECT r.company_id FROM public.user_roles r
 JOIN auth.users u ON u.id = r.user_id
 WHERE lower(u.email) = 'fleetflow.group@gmail.com'
 AND r.company_id = 'fec54447-f64b-4369-bc0b-b93e945b52b5'
), billing AS (
 SELECT b.* FROM target t
 CROSS JOIN LATERAL public.company_billing_state(t.company_id, 'live') b
)
SELECT 'Starter grants 25 assets' AS rule,
 (SELECT asset_limit = 25 AND product_id = 'starter_plan' FROM billing) AS passed
UNION ALL SELECT 'Free until revoked',
 (SELECT state = 'subscribed' AND status = 'complimentary' AND period_end IS NULL FROM billing)
UNION ALL SELECT 'Grant is company-scoped and unrevoked',
 (SELECT count(*) = 1 FROM public.company_complimentary_access ca JOIN target t USING (company_id) WHERE ca.revoked_at IS NULL)
UNION ALL SELECT 'Paid subscription remains canceled',
 (SELECT count(*) = 1 AND bool_and(status = 'canceled') FROM public.subscriptions s JOIN target t USING (company_id) WHERE environment = 'live');