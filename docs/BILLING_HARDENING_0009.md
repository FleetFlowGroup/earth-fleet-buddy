# Billing hardening + Apple IAP (branch feat/ios-app)

Web billing stays on **Paddle** (checkout, plan change, portal unchanged). Apple IAP via RevenueCat is
an *additional* provider used only inside the iOS app. Source audit: BILLING_AUDIT_t57.

## Deploy order (nothing below has been done to live)
1. Review and apply `supabase/proposed/20261029090000_0009_billing_hardening_iap.sql` once (rollback file alongside).
   Kept out of `supabase/migrations/` on purpose so nothing applies it implicitly.
   Code is backward compatible: before 0009 the Paddle webhook runs in legacy mode (no dedupe/ledger)
   and the RevenueCat webhook returns 500 (RevenueCat retries until 0009 exists).
2. Server secret `REVENUECAT_WEBHOOK_AUTH` (random string; same value in RevenueCat webhook Authorization).
3. Build-time public key `VITE_REVENUECAT_IOS_KEY` (RevenueCat Apple public SDK key, `appl_...`).
4. App Store Connect: subscription group with products `group.fleetflow.app.{starter,growth,pro,business}.monthly`;
   RevenueCat: add those products, App Store Server Notifications → RevenueCat, webhook URL
   `https://fleetflow.group/api/public/payments/revenuecat-webhook`.
5. Paddle: keep `?env=live` on the live notification destination (missing env now falls back to signature detection, live first).

## Audit items
| # | Status | How |
|---|---|---|
| 1 DB errors | fixed | `BillingDb` throws on every error; route returns 500 so Paddle retries; bad signature 400 |
| 2 admin grant from customData | fixed | webhook never writes `user_roles`; payer stored as `created_by` only if already admin; otherwise note in `billing_events` |
| 3 env default | fixed | missing `?env` → verify with live secret, then sandbox |
| 4 dedupe/ordering/upsert | fixed | `billing_events` claim (failed attempts retryable), `last_event_at` guard, `updated` upserts if row missing |
| 5 cancel period end | fixed | canceled → `current_period_end = currentBillingPeriod.endsAt ?? canceledAt ?? occurredAt` |
| 6 transactions/adjustments | fixed | `transaction.completed`, `transaction.payment_failed`, `adjustment.*` → `payments`; chargebacks flagged needs_review (access not auto-revoked) |
| 7 server-side paywall | partial | `company_has_access(company, env)` SQL helper added. RLS enforcement deferred (risk of locking out operators/prestarts mid-shift). Proposed next step: add `AND public.company_has_access(company_id)` to INSERT policies on assets/prestarts after a staged rollout. |
| 8 MRR | fixed | `platform_subscription_stats` and `platform_owner_dashboard`: 49/99/199/299 AUD, `active` only |
| 9 orphan/demo data | documented only | Nothing deleted. Candidates to review manually: subscriptions whose company no longer exists or is DEMO-SUMMIT, sandbox rows in live reporting, user_roles created by the old webhook admin grant (compare `user_roles.created_at` with `subscriptions.created_at` for the same user/company). |

## Unified entitlement
`company_billing_state` / `company_asset_limit` were already provider-agnostic (best row by status per company+env),
so Apple rows grant access identically. `company_billing_provider()` tells the UI who bills: web hides Paddle
plan change/portal for Apple-billed companies (link to App Store instead); the iOS app shows Apple plans,
and for Paddle-billed companies just says it is managed on the web (no link, per App Store rules).
