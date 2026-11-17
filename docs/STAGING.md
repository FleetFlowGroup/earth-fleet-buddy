# FleetFlow staging (do not point this at production)

Production is `https://fleetflow.group` and Supabase project `czsvzcysnppmzlyfzrhv`. Nothing in this file should be run against those. Do not apply proposed migrations 0009 or 0010 to production from here. Do not put live Paddle, RevenueCat, or service-role keys in git.

The iOS shell bakes its site URL at `npx cap sync` time (`capacitor.config.ts`: `CAP_SERVER_URL`, default `https://fleetflow.group`). `allowNavigation` always includes the production hosts and also adds the host from `CAP_SERVER_URL` and `CAP_SUPABASE_HOST` when those are set. The web app reads `VITE_SUPABASE_URL` at build time (`src/routes/__root.tsx`). If that variable is unset, the preconnect stays the production Supabase origin.

## 1. Supabase staging project

In the Supabase dashboard, create a **new** project. Do not reuse `czsvzcysnppmzlyfzrhv`.

1. Apply the SQL in `supabase/migrations/` in filename order. Skip any file whose header says it was already applied manually and must not be replayed; those are archival records of production, not staging. On an empty staging database, apply the historical migrations once so the tables exist.
2. Apply `supabase/proposed/20261029090000_0009_billing_hardening_iap.sql` to **staging only**.
3. Apply `supabase/proposed/20261117010000_0010_account_deletion.sql` to **staging only**.
4. Authentication → Users: create `redgum.admin@example.test` and `redgum.operator@example.test` with passwords you keep outside git.
5. In the staging SQL editor, run `supabase/seed/staging_seed.sql`. It inserts the fake company **Red Gum Civil**, two machines, one prestart and one defect, then links those users if they exist. It does not contain real customer data.

Copy the staging project URL and the publishable and service-role keys. They are only for the staging host.

## 2. Cloudflare worker (staging)

`npm run build` writes a Nitro Cloudflare bundle. This repo does not commit production routes.

```bash
npm run build
npx wrangler deploy --config wrangler.staging.toml
```

`wrangler.staging.toml` names the worker `fleetflow-staging` and has **no** route for `fleetflow.group`. Attach a staging hostname in the Cloudflare dashboard if you want one. Do not add `fleetflow.group`.

Set variables on that worker only (dashboard or `npx wrangler secret put --config wrangler.staging.toml`). Never commit the values.

| Name | Staging value |
|---|---|
| `SUPABASE_URL` | staging project URL |
| `SUPABASE_PUBLISHABLE_KEY` | staging anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | staging service role |
| `VITE_SUPABASE_URL` | same staging URL (rebuild so the client bundle picks it up) |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | staging publishable key |
| `VITE_PAYMENTS_CLIENT_TOKEN` | Paddle **sandbox** client token (`test_…`) |
| `VITE_REVENUECAT_IOS_KEY` | RevenueCat **sandbox** public iOS key |
| `REVENUECAT_WEBHOOK_AUTH` | random string, same value as the sandbox webhook |
| Paddle server secrets | sandbox API keys only, same names the live worker already uses |

`VITE_*` values are baked at `npm run build`. Set them in the environment before the build, then deploy the output. A rebuild is required after they change.

## 3. RevenueCat sandbox

Create a separate RevenueCat project (or its sandbox app), not the live one.

- iOS app bundle id can stay `group.fleetflow.app` for sandbox testing.
- Webhook URL: `https://<staging-host>/api/public/payments/revenuecat-webhook`
- Authorization header: the same `REVENUECAT_WEBHOOK_AUTH` as the staging worker.
- Do not send the sandbox webhook to `https://fleetflow.group`.

## 4. Paddle sandbox

Use Paddle sandbox keys on the staging worker only. The live worker keeps live keys. `getPaddleEnvironment()` treats a `test_` client token as sandbox.

## 5. App Store sandbox testers

App Store Connect → Users and Access → Sandbox. Create testers there. Do not use a production Apple ID to buy against staging.

## 6. Xcode staging build

On a Mac, from this repo:

```bash
export CAP_SERVER_URL="https://<staging-host>"
export CAP_SUPABASE_HOST="<staging-project-ref>.supabase.co"
npm run ios:sync:staging
npx cap open ios
```

`npm run ios:sync:staging` refuses to run if `CAP_SERVER_URL` is missing or contains `fleetflow.group`, or if `CAP_SUPABASE_HOST` is missing or is the production project. Then pick the team and run on a simulator or a device with a sandbox Apple ID.

A build without those variables (`npm run cap:sync`) still loads `https://fleetflow.group`. That is the production shell. Do not use it to test staging data.

## What stays on production

Do not deploy `wrangler.staging.toml` to the live worker. Do not change the live Supabase project. Do not point RevenueCat or Paddle live webhooks at staging, and do not point staging webhooks at `fleetflow.group`.
