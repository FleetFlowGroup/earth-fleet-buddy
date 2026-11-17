# FleetFlow iOS — App Store readiness

Branch: `feat/ios-app` only. Nothing in this change was deployed, published, or applied to a database. No pull request was opened. Web Paddle checkout, plan change, portal and the Paddle webhook code paths are unchanged.

The iOS binary is a Capacitor 8 hosted shell (`server.url = https://fleetflow.group`). Native plist, splash, privacy manifest and plugin wiring ship inside the binary. Account deletion, Sign in with Apple, the paywall copy and the client-side IAP guard ship only when this branch is published to fleetflow.group. That publish was not done.

## Single source of truth (no double charge)

`company_billing_state` remains the access check: one row per company and environment, best status. Purchase rights are stricter.

- A **current Paddle entitlement blocks a second Apple entitlement** for that company and environment.
- In the iOS app the billing screen does not offer an in-app purchase. It says the company is already subscribed and that the subscription is managed on the web. It does not name Paddle, show a web price, or link to checkout.
- `purchaseIapPlan` throws if the displayed provider is `paddle`.
- The RevenueCat webhook refuses to insert or extend an Apple row while Paddle is current (`needs_review`, HTTP 200, no second active row). Apple expiration and cancellation of a row that already exists are still applied so that access can end. The webhook does not delete an Apple row that was stored earlier.
- If both providers would be current, Paddle wins the "may this company buy in the app?" decision. `resolveDisplayedBillingProvider` also treats a current `paddle_subscription_id` row as Paddle when migration 0009 is not applied yet, so the iOS app does not offer IAP against a live Paddle subscription.
- Web users still see Paddle controls unless the displayed provider is `apple` (that Apple-managed state was already on this branch). Complimentary access is not a Paddle subscription.
- Neither account deletion nor the webhook cancels a Paddle or Apple subscription.

## A. Account deletion (guideline 5.1.1(v))

Reachable from **Settings** and from the operator **Profile** screen.

- Confirmation requires typing `DELETE`.
- Email/password accounts must sign in again with the current password. Google or Apple accounts must retype the account email. The server function checks that email against the signed-in user.
- The handler is `deleteOwnAccount` (`src/lib/delete-account.functions.ts`). It uses `requireSupabaseAuth` and the caller's JWT client. It does not use the service role.
- The database function `delete_own_account` acts only on `auth.uid()`. It does not take another user's id.
- A member who is not the only Company Admin (`admin` or `super_admin`) is removed with their login. The company and its records stay.
- The only Company Admin cannot leave the company behind. They must confirm company deletion. Other people's logins are kept; they lose that company. A company with no other members is deleted with the account.
- The shared demo company (`ABN = DEMO-SUMMIT`) cannot be deleted by its only admin. Platform-owner accounts cannot be deleted here.
- Apple subscribers are told to cancel in Settings → Apple ID → Subscriptions. Deleting the FleetFlow account does not cancel Apple billing.
- Website (Paddle) subscribers are told the website subscription is not cancelled. On iOS that copy does not name Paddle or link to a checkout. On the website it names Paddle.
- Storage files are not purged. A foreign key that cannot be cleared rolls the transaction back, so a failed delete removes nothing.

Migration (NOT APPLIED, not under `supabase/migrations/`):

- `supabase/proposed/20261117010000_0010_account_deletion.sql`
- `supabase/proposed/20261117010000_0010_account_deletion_rollback.sql`

Until 0010 is applied by the owner, the button is visible and the call fails closed with "Account deletion isn't switched on yet." Apply 0009 first if Apple subscription columns are required for the billing label; 0010 detects the `provider` column and still works without it (Paddle-only).

The demo write-guard functions are replaced only inside 0010, and only to honour a transaction-local setting while the caller's own rows are removed. With that setting unset, the guards behave as they do today.

## B. Native shell (guideline 4.2)

- Splash background is the FleetFlow navy (`#0b1220`) in `LaunchScreen.storyboard`. The 1024 app icon is already in `AppIcon.appiconset`.
- Status bar does not overlay the web view. `viewport-fit=cover` plus `html.ff-native` bottom padding covers the home indicator.
- Bundled offline screen: `ios-shell/offline.html` (`server.errorPath`). A second offline banner listens to `@capacitor/network` only inside the native app.
- Pull down at the top of the page refreshes route and query data, with a light haptic (`@capacitor/haptics`). No-op on the website.
- Prestart, defect and meter photos try the native camera first (`@capacitor/camera`) and fall back to the file input. The website still uses the file input only.
- `Info.plist` usage strings: camera, photo library, add to library, location when in use (prestart GPS). `ITSAppUsesNonExemptEncryption` is `false`.
- Push is wired (AppDelegate forwards the APNs token, plugin is installed) but **permission is not requested at launch**. There is no `device_tokens` table. Do not prompt until that store is approved.
- Links that leave `fleetflow.group` open in `SFSafariViewController` (`@capacitor/browser`). FleetFlow URLs stay in the web view. `allowNavigation` also includes `appleid.apple.com`, `idmsa.apple.com` and `czsvzcysnppmzlyfzrhv.supabase.co` so Sign in with Apple can return to the app.
- User agent token `FleetFlowiOS/1` is how the server and the client agree the shell is native, so pricing can be omitted from the first HTML without a hydration mismatch.

## C. Sign in with Apple (guideline 4.8)

The app offers **email/password** and **Continue with Google** on `/auth`. Google is a third-party login, including inside the iOS shell, because the shell loads the live site. Sign in with Apple is therefore required.

It is implemented with Supabase `signInWithOAuth({ provider: "apple" })` and is shown only when the shell user agent or Capacitor reports iOS. The website does not show the button, so a provider that is not configured yet cannot break web sign-in. Google remains on iOS, with a note that Google often rejects the embedded web view (`disallowed_useragent`). Email and Apple are the reliable iOS methods.

No Supabase dashboard or Apple Developer setting was changed.

### What the owner must configure later

Apple Developer (Identifiers):

1. App ID `group.fleetflow.app` with Sign in with Apple, In-App Purchase, and (when push is wanted) Push Notifications.
2. Services ID, for example `group.fleetflow.app.signin`. Enable Sign in with Apple. Domains: `fleetflow.group` and the Supabase host `czsvzcysnppmzlyfzrhv.supabase.co`. Return URL: `https://czsvzcysnppmzlyfzrhv.supabase.co/auth/v1/callback`.
3. Key with Sign in with Apple enabled. Download the `.p8` once. Note the Key ID and the Team ID.

Supabase Dashboard → Authentication → Providers → Apple (do this in the dashboard, not from this repo):

- Enable Apple.
- Client IDs: the Services ID, and the App ID if you later add the native Apple sheet.
- Secret: generated from the Team ID, Key ID, Services ID and the `.p8` (Supabase docs describe the JWT). Rotate before Apple's 6-month secret expiry.
- Redirect allow list must include `https://fleetflow.group/auth` (the app sends `https://fleetflow.group/auth?oauth=apple`, plus an invite query when present). A prefix or wildcard for `https://fleetflow.group/**` covers that.

Until this is saved, the iOS button returns Apple's or Supabase's error and does not create an account.

## D. Review compliance

Inside the iOS shell only:

- Marketing prices, the `$9.99` FAQ, the pricing nav and the Paddle checkout on `/pricing` are not shown. `/pricing` explains that subscriptions are purchased with the Apple ID from Billing.
- Asset-limit upgrades in the app go to `/billing` and do not call the Paddle plan-change function or show AUD prices.
- Terms, privacy and refund pages in the shell describe Apple billing and do not link to Paddle. The website copies are unchanged.
- The in-app paywall includes the auto-renew disclosure, Restore purchases, Terms and Privacy Notice. Prices come from StoreKit (`priceString`), not from the web price table.
- `PrivacyInfo.xcprivacy` is in the app target. Tracking is false. Collected data: email, name, photos, user id, precise location, all for app functionality. Required-reason APIs: UserDefaults `CA92.1`, file timestamps `C617.1`. Confirm the Xcode privacy report before upload; plugin manifests are merged by Xcode.
- Export compliance: `ITSAppUsesNonExemptEncryption = false` (HTTPS only, no custom encryption).
- Demo notes for App Review: do not hand the reviewer the shared `DEMO-SUMMIT` company if they might try to delete it (the only admin is blocked). Create a normal review company with one admin and one operator, plus a second admin if you want them to try "leave" rather than company deletion. Put those logins in App Review notes. Billing is already disabled when `companies.abn = DEMO-SUMMIT`.

## Tests and checks

| Check | Result |
|---|---|
| `npx vitest run` | 15 files, 377 tests passed (includes new entitlement, RevenueCat double-charge, account-deletion and iOS-copy tests) |
| `npx tsx --test src/lib/company-membership.test.ts` | 7 passed. `bun` is not installed here; `node --test` cannot resolve the extensionless import. Vitest excludes this file on purpose. |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed (`vite build`, Nitro output). Not deployed. |
| `npm run lint` | Still fails across the repo on pre-existing Prettier issues (thousands of errors in files this change did not need to edit, including `src/routes/unsubscribe.tsx` and `src/components/app-shell.tsx`). ESLint is clean on the new account, entitlement, iOS-copy and native modules after formatting those files. |
| Database | No migration was executed. No production Supabase connection was opened. |

## Files

New:

- `src/lib/account-deletion.ts`, `src/lib/account-deletion.test.ts`
- `src/lib/delete-account.functions.ts`
- `src/components/delete-account-card.tsx`
- `src/lib/billing/entitlement.ts`, `src/lib/billing/entitlement.test.ts`
- `src/lib/ios-store-copy.ts`, `src/lib/ios-store-copy.test.ts`
- `src/lib/native-shell.functions.ts`, `src/lib/use-native-shell.ts`
- `src/components/native-photo-input.tsx`
- `ios/App/App/PrivacyInfo.xcprivacy`
- `supabase/proposed/20261117010000_0010_account_deletion.sql` and its rollback
- this document

Updated:

- Billing guard: `src/lib/billing/revenuecat.ts`, `types.ts`, `billing-db.server.ts`, `fake-db.test-util.ts`, tests, `src/lib/iap.ts`, `src/hooks/use-subscription.ts`, `src/components/billing/iap-billing-panel.tsx`, `docs/BILLING_HARDENING_0009.md`
- Shell and copy: `src/lib/native.ts`, `src/routes/__root.tsx`, `src/router.tsx`, `src/styles.css`, `src/routes/auth.tsx`, `index.tsx`, `pricing.tsx`, `contact.tsx`, `terms.tsx`, `privacy.tsx`, `refund.tsx`, `assets/index.tsx`, operator prestart/defect/hours/profile, settings
- iOS project: `capacitor.config.ts`, `Info.plist`, `LaunchScreen.storyboard`, `project.pbxproj`, `Package.swift`, `ios-shell/offline.html`, `package.json`, `package-lock.json`

`Package.swift` is generated by `npx cap sync ios`. It now includes Browser, Haptics and Network, and the Capacitor Swift package pin moved from 8.5.3 to 8.6.0 to match the installed Capacitor 8 CLI.

## Outstanding checklist for the owner

Do these yourself. This branch did not do them.

1. **Apple Developer Program** as an organisation (D-U-N-S) for FleetFlow. Accept the Paid Apps agreement. Complete banking and tax.
2. **App ID** `group.fleetflow.app` (or tell engineering if the id changes before the first release). Enable Sign in with Apple and In-App Purchase.
3. **App Store Connect** app record: name FleetFlow, bundle id `group.fleetflow.app`, SKU, primary language, privacy policy `https://fleetflow.group/privacy`, support URL.
4. **Subscriptions:** one group, four auto-renewable products `group.fleetflow.app.{starter,growth,pro,business}.monthly`, localisation, review screenshot for each. Introductory offer only if you still want the first-month discount on iOS (the app does not advertise the web $9.99 price).
5. **Sign in with Apple** Services ID, key and Supabase Apple provider, as in section C. Do this in the dashboards.
6. **RevenueCat:** iOS app, public SDK key `appl_…` as build env `VITE_REVENUECAT_IOS_KEY`, entitlements `starter|growth|pro|business`, offering `default`, App Store Server Notifications pointed at RevenueCat, webhook `https://fleetflow.group/api/public/payments/revenuecat-webhook` with `REVENUECAT_WEBHOOK_AUTH`.
7. **Migrations, manually, after review:** `supabase/proposed/20261029090000_0009_billing_hardening_iap.sql`, then `supabase/proposed/20261117010000_0010_account_deletion.sql`. Both are NOT APPLIED. Do not replay them through tooling. Account deletion does nothing until 0010 is applied. Apple rows cannot be stored until 0009 is applied (the webhook returns 500 and RevenueCat retries).
8. **Publish this branch to fleetflow.group** only when you are ready. The hosted shell will keep showing today's production site until then, including web pricing. Do not submit the binary for review before that publish, or the guideline fixes in the web UI will not be what the reviewer sees.
9. **Xcode on a Mac:** `npm install && npx cap sync ios && npx cap open ios`. Select the team, signing, and capabilities (Sign in with Apple, In-App Purchase). Confirm the privacy report. Archive and upload to TestFlight. This environment cannot build or sign the iOS app.
10. **App Review notes:** demo admin and operator logins on a normal company, plus a note that subscriptions in the app use Apple IAP and an existing website subscription is not sold again inside the app. Sandbox Apple IDs for purchase testing.
11. **Export compliance** in App Store Connect: answer that the app only uses exempt encryption, matching `ITSAppUsesNonExemptEncryption = false`.
12. **Push** stays off until a `device_tokens` design is approved. Do not turn on the permission prompt before then.
