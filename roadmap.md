# Prestart submission repair
## Email update
- [x] Replace legacy email delivery while preserving invitation authorisation, atomic quotas, templates and existing feature triggers.
- [x] Replace suppression/unsubscribe reactions with the signed events receiver, retain user data and remove legacy scaffolds from source only.
- [x] Offline suite: 340 Vitest and 7 company-isolation tests passed; automatic preview compilation checked. No emails, SQL, data changes or publishing; live sending intentionally untested.
## Preview-only operator query security Fix A
- [x] Fix loaded no-company onboarding access and login/layout redirects; match the operator path segment exactly for rendering, redirects and subscription exemptions.
- [x] Full Vitest: 282 passed across 6 files (48 access-guard tests); automatic preview build OK. No live navigation because existing telemetry can write data; no SQL, data changes, emails, accounts or publishing.
- [x] Block child rendering while identity loads/errors and during operator redirects; resolve login destinations through the existing membership query.
- [x] Gate non-operator page and shared admin reads on a known non-operator role; preserve operator/QR reads and billing behaviour.
- [x] Full Vitest: 266 passed across 6 files; automatic preview build OK. Existing owner/operator session: dashboard and feedback resolve to /operator with no dashboard stats or feedback list reads; signed-in auth redirect resolves to /operator. Credential-entry login and live non-operator checks not executed.
## Preview-only AI support assistant
- [x] Add static support articles, authenticated read-only retrieval, link sanitisation, memory-only limits/history and the four authorised mount/prefill changes.
- [x] Full Vitest: 154 passed; Bun isolation: 7 passed; automatic compilation OK. Verified live owner/operator guidance and desktop/mobile panel, with no submissions or publishing.
- [ ] Verify admin header and feedback prefills with a real admin session — owner's current session has operator access; do not impersonate another customer or change permissions.
## Scoped signature repair
- [x] Add only the authorised signature INSERT storage policy; existing policies and buckets unchanged.
- [x] Require confirmed signature upload before prestart insert and show signed URLs or explicit missing/unavailable states in admin details.
- [x] Offline signature/invitation and company-isolation suites pass; automatic preview build/type check passes. No customer submissions or publishing.
- [ ] Verify a live operator upload and saved signature read-back — blocked by no permission for customer test submissions; mocked flow verified instead.
## Applied invitation SQL record
- [x] Recorded the exact owner-confirmed Variant 2 SQL in supabase/migrations/20261028074200_reserve_team_invite_email.sql with a manually-applied/do-not-reexecute header and no outer transaction; proposal superseded. No SQL execution, migration-tool use, emails, data changes or publishing.
- [x] Full offline Vitest suite: 84 passed, 0 failed across 2 files (31 security + 53 handler tests); Bun isolation suite: 7 passed, 0 failed across 1 file.
- [x] No separate staging/test database is configured: project context states preview and published share one backend; local environment configuration is consistent and draft listing shows no drafts. Payment test/live modes do not isolate the database. External unconfigured databases are not independently verifiable.
## Phase 1 browser email security
- [x] Saved atomic reservation and both index variants under supabase/proposed only; sender fails closed on missing RPC. Offline tests: 84 Vitest + 7 existing isolation tests passed; automatic build OK. No DDL, emails, data changes or publishing; real database concurrency remains untested until separately approved SQL application.
- [x] Final hardening: verified emails, new-company controls, sanitised names and last-moment state/permission checks; 65 mocked/pure invitation tests and 7 existing isolation tests passed; automatic build OK. Atomic reservation and indexes proposed as text only, not applied.
- [x] Restrict browser sends to verified, authorised team invitations and log-backed limits; no sends, deployment, policies, or migrations.
- [x] Audit callers and trusted server imports; 31 offline authorisation/limit tests and 7 existing isolation tests passed.

## Previous repair
- [x] Investigate membership, operator links, and policies without contacting the separate customer company.
- [x] Apply secure submission policies and future operator provisioning; isolation tests pass.
- [ ] Verify the affected user's saved prestart and QR flow — blocked by no permission to impersonate or submit customer test records.
- [x] Apply required package security update.
- [x] Record the instruction not to send the separate company anything.
- [x] Repair the existing affected customer's missing operator link without changing their role or contacting them; verified an active operator linked to their user and company.